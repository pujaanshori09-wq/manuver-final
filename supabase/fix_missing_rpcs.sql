-- ============================================================================
-- FIX: fungsi get_my_profile & complete_user_onboarding tidak ditemukan
-- Jalankan SELURUH file ini sekali di Supabase SQL Editor.
-- Aman dijalankan ulang (idempotent).
-- Isi: migrasi 20260913 (bagian kolom & tabel), 20260918140000, 20261116120000
-- ============================================================================

-- A. Kolom profil yang dipakai complete_user_onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tanggal_lahir DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 1. Ensure required onboarding columns exist on public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_onboarding BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS primary_sport TEXT DEFAULT 'badminton',
  ADD COLUMN IF NOT EXISTS age_pref_min INT DEFAULT 18,
  ADD COLUMN IF NOT EXISTS age_pref_max INT DEFAULT 35,
  ADD COLUMN IF NOT EXISTS gender_pref TEXT DEFAULT 'all' CHECK (gender_pref IN ('all', 'men', 'women')),
  ADD COLUMN IF NOT EXISTS location_permission_granted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;

-- 2. Create user_sports table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport_id TEXT NOT NULL,
  experience_level TEXT NOT NULL DEFAULT '1-3 thn',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_sports_unique_user_sport UNIQUE (user_id, sport_id)
);

-- 3. Create index for fast matching queries
CREATE INDEX IF NOT EXISTS idx_user_sports_user_id ON public.user_sports(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sports_sport_id ON public.user_sports(sport_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_sports ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for user_sports
DROP POLICY IF EXISTS "Public can view user sports" ON public.user_sports;
CREATE POLICY "Public can view user sports"
  ON public.user_sports FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own sports" ON public.user_sports;
CREATE POLICY "Users can insert own sports"
  ON public.user_sports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sports" ON public.user_sports;
CREATE POLICY "Users can update own sports"
  ON public.user_sports FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sports" ON public.user_sports;
CREATE POLICY "Users can delete own sports"
  ON public.user_sports FOR DELETE
  USING (auth.uid() = user_id);


-- B. complete_user_onboarding (10 parameter, sesuai app/onboarding/flow.tsx)
DROP FUNCTION IF EXISTS public.complete_user_onboarding(TEXT, JSONB, INT, INT, TEXT, BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION);
CREATE OR REPLACE FUNCTION public.complete_user_onboarding(
  p_primary_sport TEXT,
  p_sports JSONB,
  p_age_pref_min INT,
  p_age_pref_max INT,
  p_gender_pref TEXT,
  p_location_granted BOOLEAN DEFAULT false,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_birthdate DATE DEFAULT NULL,
  p_gender TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item JSONB;
BEGIN
  -- Authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Update Profile Settings
  UPDATE public.profiles
  SET
    has_completed_onboarding = true,
    onboarding_complete = true, -- Also update old column just in case
    terms_accepted_at = COALESCE(terms_accepted_at, now()),
    primary_sport = p_primary_sport,
    age_pref_min = p_age_pref_min,
    age_pref_max = p_age_pref_max,
    gender_pref = p_gender_pref,
    location_permission_granted = p_location_granted,
    last_latitude = COALESCE(p_latitude, last_latitude),
    last_longitude = COALESCE(p_longitude, last_longitude),
    tanggal_lahir = COALESCE(p_birthdate, tanggal_lahir),
    gender = COALESCE(p_gender, gender),
    updated_at = now()
  WHERE id = v_user_id;

  -- 2. Clear previous sports for this user to avoid stale records
  DELETE FROM public.user_sports WHERE user_id = v_user_id;

  -- 3. Insert each sport with experience level from the JSONB array
  IF p_sports IS NOT NULL AND jsonb_array_length(p_sports) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_sports)
    LOOP
      INSERT INTO public.user_sports (user_id, sport_id, experience_level)
      VALUES (
        v_user_id,
        v_item->>'sport_id',
        COALESCE(v_item->>'experience', '1-3 thn')
      )
      ON CONFLICT (user_id, sport_id) DO UPDATE
      SET experience_level = EXCLUDED.experience_level;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- C. Security hardening + get_my_profile
-- ============================================================================
-- Security hardening (audit 2026-11-16)
-- Idempotent: aman dijalankan ulang di SQL Editor.
--
-- Isi:
--   1. Self-swipe / self-match ditolak (constraint + handle_swipe)
--   2. Fungsi SECURITY DEFINER: auth.uid(), SET search_path, EXECUTE hanya authenticated
--   3. profiles: pisah kolom publik/privat (GRANT per kolom) + RPC get_my_profile()
--   4. Perketat RLS: profiles UPDATE, sparing_invites, blocks, open_sessions,
--      event_registrations
--   5. Tabel push_dedupe untuk mencegah push ganda dari edge function
--   6. delete_user_account tidak lagi menyentuh storage.objects
--
-- PERLU RILIS KLIEN BERSAMAAN: app/_layout.tsx (select('*') pada profiles akan
-- gagal setelah migrasi ini) dan delete-account (hapus file lewat Storage API).
-- Jalankan migrasi ini SETELAH build klien baru tersedia, atau terima bahwa
-- klien lama tidak bisa memuat profil sampai di-update.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Self-swipe / self-match
-- ----------------------------------------------------------------------------
DELETE FROM public.matches WHERE user_a_id = user_b_id;
DELETE FROM public.swipes  WHERE user_id   = target_user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'swipes_no_self_swipe' AND conrelid = 'public.swipes'::regclass
  ) THEN
    ALTER TABLE public.swipes
      ADD CONSTRAINT swipes_no_self_swipe CHECK (user_id <> target_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_no_self_match' AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_no_self_match CHECK (user_a_id <> user_b_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_swipe(
  target_id UUID,
  swipe_action TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  is_mutual_match BOOLEAN := false;
  new_match_id UUID := null;
  requester_id UUID := auth.uid();
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Target tidak valid';
  END IF;

  IF target_id = requester_id THEN
    RAISE EXCEPTION 'Tidak dapat melakukan swipe ke diri sendiri';
  END IF;

  IF swipe_action IS NULL OR swipe_action NOT IN ('like', 'pass') THEN
    RAISE EXCEPTION 'Aksi swipe tidak valid';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id) THEN
    RAISE EXCEPTION 'Pengguna tidak ditemukan';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = requester_id AND blocked_id = target_id)
       OR (blocker_id = target_id AND blocked_id = requester_id)
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: Tidak dapat berinteraksi dengan pengguna yang diblokir';
  END IF;

  INSERT INTO public.swipes (user_id, target_user_id, action)
  VALUES (requester_id, target_id, swipe_action)
  ON CONFLICT (user_id, target_user_id) DO UPDATE
  SET action = EXCLUDED.action, updated_at = NOW();

  IF swipe_action = 'like' THEN
    IF EXISTS (
      SELECT 1 FROM public.swipes
      WHERE user_id = target_id
        AND target_user_id = requester_id
        AND action = 'like'
    ) THEN
      is_mutual_match := true;

      INSERT INTO public.matches (user_a_id, user_b_id)
      VALUES (
        LEAST(requester_id, target_id),
        GREATEST(requester_id, target_id)
      )
      ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET updated_at = NOW()
      RETURNING id INTO new_match_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'is_match', is_mutual_match,
    'match_id', new_match_id
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. Fungsi SECURITY DEFINER lain
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_blocked_id IS NULL OR p_blocked_id = v_uid THEN
    RAISE EXCEPTION 'Target tidak valid';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_uid, p_blocked_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_user(
  p_reported_id UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_reported_id IS NULL OR p_reported_id = v_uid THEN
    RAISE EXCEPTION 'Target tidak valid';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Alasan wajib diisi';
  END IF;

  INSERT INTO public.reports (reporter_id, reported_id, reason, details)
  VALUES (v_uid, p_reported_id, left(btrim(p_reason), 200), left(p_details, 2000));
END;
$$;

-- Hitung pelapor berbeda, bukan jumlah baris: satu akun tidak boleh
-- menyembunyikan akun lain dari discovery dengan melapor 3x.
CREATE OR REPLACE FUNCTION public.check_report_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  reporter_count INT;
BEGIN
  SELECT COUNT(DISTINCT reporter_id) INTO reporter_count
  FROM public.reports
  WHERE reported_id = NEW.reported_id
    AND created_at > NOW() - INTERVAL '30 days';

  IF reporter_count >= 3 THEN
    UPDATE public.profiles SET flagged_for_review = true WHERE id = NEW.reported_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  score INT := 0;
  profile_row RECORD;
  photo_count INT := 0;
  sport_count INT := 0;
BEGIN
  -- Pemanggil dengan JWT hanya boleh menghitung profilnya sendiri.
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  SELECT * INTO profile_row FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF profile_row.bio IS NOT NULL AND LENGTH(profile_row.bio) >= 10 THEN score := score + 20; END IF;
  IF profile_row.skill_level IS NOT NULL THEN score := score + 10; END IF;
  IF profile_row.looking_for IS NOT NULL THEN score := score + 10; END IF;
  IF profile_row.availability IS NOT NULL THEN score := score + 10; END IF;

  SELECT COUNT(*) INTO photo_count FROM public.profile_photos WHERE profile_id = p_user_id;
  score := score + LEAST(photo_count * 10, 30);

  SELECT COUNT(*) INTO sport_count FROM public.user_sports WHERE user_id = p_user_id;
  score := score + LEAST(sport_count * 5, 20);

  RETURN LEAST(score, 100);
END;
$$;

-- Penghapusan file storage dipindah ke klien (Storage API). Fungsi ini hanya
-- menghapus akun auth; baris lain ikut terhapus lewat ON DELETE CASCADE.
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Tidak terautentikasi';
  END IF;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Data profil milik sendiri (termasuk kolom privat yang tidak lagi bisa
-- di-SELECT langsung oleh klien).
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
  SELECT p.* FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- Semua fungsi SECURITY DEFINER di schema public yang belum punya search_path
-- (termasuk yang dibuat di luar folder migrations) diberi search_path tetap.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp', r.sig);
  END LOOP;
END $$;

-- RPC SECURITY DEFINER hanya boleh dipanggil user login, bukan anon/PUBLIC.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;

-- Laporan audit (hanya NOTICE): fungsi SECURITY DEFINER non-trigger yang tidak
-- menyebut auth.uid() di badan fungsinya. Tinjau manual tiap nama yang muncul
-- (mis. claim_emergency_slot, yang definisinya tidak ada di repo).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
      AND p.prosrc !~* 'auth\.uid\(\)'
  LOOP
    RAISE NOTICE 'SECURITY DEFINER tanpa auth.uid(): %', r.sig;
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 3. profiles: kolom publik vs privat
--    Publik (boleh dibaca user login lain): daftar putih di bawah.
--    Privat (hanya lewat get_my_profile / RPC): push_token, no_hp,
--    tanggal_lahir, last_latitude/longitude, location, alamat, gender,
--    preferensi, flag moderasi, dsb. Kolom baru otomatis privat sampai
--    di-GRANT eksplisit.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_public_cols CONSTANT text[] := ARRAY[
    'id', 'nama', 'foto_url', 'photos', 'bio', 'skill_level', 'hobi',
    'pendidikan', 'pekerjaan', 'negara', 'domisili', 'availability',
    'looking_for', 'overall_frequency', 'preferred_time', 'home_venue',
    'height_cm', 'sport_role', 'primary_sport', 'created_at'
  ];
  v_readonly_cols CONSTANT text[] := ARRAY[
    'id', 'created_at', 'flagged_for_review', 'profile_completeness',
    'location', 'last_active'
  ];
  v_select_cols text;
  v_update_cols text;
BEGIN
  REVOKE ALL ON TABLE public.profiles FROM anon;
  REVOKE SELECT, UPDATE ON TABLE public.profiles FROM authenticated;

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_select_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = ANY (v_public_cols);

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_update_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND NOT (column_name = ANY (v_readonly_cols));

  EXECUTE format('GRANT SELECT (%s) ON TABLE public.profiles TO authenticated', v_select_cols);
  EXECUTE format('GRANT UPDATE (%s) ON TABLE public.profiles TO authenticated', v_update_cols);
END $$;


-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users." ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users."
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);  -- dibatasi ke kolom publik lewat GRANT per kolom

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- sparing_invites: pengirim/penerima harus pasangan match yang sama
DROP POLICY IF EXISTS "Users can create invites" ON public.sparing_invites;
CREATE POLICY "Users can create invites"
  ON public.sparing_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = sparing_invites.match_id
        AND ((m.user_a_id = sparing_invites.sender_id AND m.user_b_id = sparing_invites.receiver_id)
          OR (m.user_a_id = sparing_invites.receiver_id AND m.user_b_id = sparing_invites.sender_id))
    )
  );

DROP POLICY IF EXISTS "Users can update their own invites" ON public.sparing_invites;
CREATE POLICY "Users can update their own invites"
  ON public.sparing_invites FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (
    (auth.uid() = sender_id OR auth.uid() = receiver_id)
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = sparing_invites.match_id
        AND ((m.user_a_id = sparing_invites.sender_id AND m.user_b_id = sparing_invites.receiver_id)
          OR (m.user_a_id = sparing_invites.receiver_id AND m.user_b_id = sparing_invites.sender_id))
    )
  );

-- blocks: yang diblokir tidak boleh tahu siapa yang memblokirnya.
-- Filter blokir dua arah tetap berjalan di fungsi SECURITY DEFINER.
DROP POLICY IF EXISTS "Users can view their own blocks" ON public.blocks;
CREATE POLICY "Users can view their own blocks"
  ON public.blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

-- open_sessions: creator_id tidak boleh dialihkan ke user lain
DROP POLICY IF EXISTS "Creators can update their own sessions" ON public.open_sessions;
CREATE POLICY "Creators can update their own sessions"
  ON public.open_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- event_registrations: daftar peserta hanya untuk diri sendiri dan pembuat event
DROP POLICY IF EXISTS "Users can view participants of events they are attending or created"
  ON public.event_registrations;
DROP POLICY IF EXISTS "Event creators can view registrations" ON public.event_registrations;
CREATE POLICY "Event creators can view registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_registrations.event_id AND e.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can cancel their registrations" ON public.event_registrations;
CREATE POLICY "Users can cancel their registrations"
  ON public.event_registrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 5. push_dedupe: dipakai edge function notify-message / notify-match
--    Hanya service role yang bisa mengakses (RLS aktif, tanpa policy).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_dedupe (
  dedupe_key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_dedupe_created_at ON public.push_dedupe (created_at);
ALTER TABLE public.push_dedupe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_dedupe FROM anon, authenticated;


NOTIFY pgrst, 'reload schema';

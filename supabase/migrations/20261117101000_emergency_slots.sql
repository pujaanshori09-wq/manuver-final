-- ============================================================================
-- SOS "Darurat Kurang 1" (audit 2026-11-17)
-- Idempotent. JALANKAN FASE 0 DULU: tabel emergency_slots dan fungsi
-- claim_emergency_slot sudah dipakai klien tetapi tidak ada di repo, jadi
-- mungkin sudah ada di database live. Skrip ini memakai IF NOT EXISTS untuk
-- tabel, tetapi MENGGANTI fungsi claim_emergency_slot dan policy-nya.
-- Cek dulu: select pg_get_functiondef('public.claim_emergency_slot(uuid)'::regprocedure);
--
-- Nomor WhatsApp (contact_wa) tidak bisa di-SELECT oleh klien. Nomor hanya
-- dikembalikan oleh claim_emergency_slot() kepada orang yang berhasil mengambil
-- slot.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emergency_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  venue_name TEXT NOT NULL,
  play_time TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  slots_needed INTEGER NOT NULL CHECK (slots_needed BETWEEN 0 AND 20),
  fee_per_person INTEGER NOT NULL DEFAULT 0 CHECK (fee_per_person >= 0),
  contact_wa TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'filled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.emergency_slot_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.emergency_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slot_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_emergency_slots_active
  ON public.emergency_slots (status, expires_at, play_time);

ALTER TABLE public.emergency_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_slot_claims ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- Hak akses kolom: contact_wa tidak pernah terbaca langsung oleh klien.
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.emergency_slots FROM anon, authenticated;
REVOKE ALL ON TABLE public.emergency_slot_claims FROM anon, authenticated;

GRANT SELECT (id, creator_id, sport, venue_name, play_time, expires_at,
              slots_needed, fee_per_person, note, status, created_at)
  ON public.emergency_slots TO authenticated;

GRANT INSERT (creator_id, sport, venue_name, play_time, expires_at,
              slots_needed, fee_per_person, contact_wa, note)
  ON public.emergency_slots TO authenticated;

-- Pembuat boleh membatalkan slot miliknya (status saja).
GRANT UPDATE (status) ON public.emergency_slots TO authenticated;

GRANT SELECT ON public.emergency_slot_claims TO authenticated;


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
-- Blokir dua arah antara pemanggil dan user lain. SECURITY DEFINER karena
-- blocks hanya terbaca oleh pemblokir (policy hardening 16 Nov).
CREATE OR REPLACE FUNCTION public.is_blocked_with(p_other UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p_other)
       OR (b.blocker_id = p_other AND b.blocked_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.is_blocked_with(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_with(UUID) TO authenticated;

DROP POLICY IF EXISTS "Active slots are visible to signed-in users" ON public.emergency_slots;
CREATE POLICY "Active slots are visible to signed-in users"
  ON public.emergency_slots FOR SELECT
  TO authenticated
  USING (
    creator_id = auth.uid()
    OR (
      status = 'active'
      AND expires_at > now()
      AND NOT public.is_blocked_with(emergency_slots.creator_id)
    )
  );

DROP POLICY IF EXISTS "Users can post their own slots" ON public.emergency_slots;
CREATE POLICY "Users can post their own slots"
  ON public.emergency_slots FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND expires_at > now()
  );

DROP POLICY IF EXISTS "Creators can cancel their own slots" ON public.emergency_slots;
CREATE POLICY "Creators can cancel their own slots"
  ON public.emergency_slots FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid() AND status IN ('active', 'cancelled'));

DROP POLICY IF EXISTS "Users can see their own claims" ON public.emergency_slot_claims;
CREATE POLICY "Users can see their own claims"
  ON public.emergency_slot_claims FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- Ambil slot: atomik, satu klaim per orang, nomor WA hanya dibuka di sini.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_emergency_slot(p_slot_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_slot public.emergency_slots%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Kunci baris: dua orang yang menekan "Ambil" bersamaan tidak bisa sama-sama menang.
  SELECT * INTO v_slot FROM public.emergency_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'not_found');
  END IF;
  IF v_slot.creator_id = v_uid THEN
    RETURN json_build_object('success', false, 'message', 'own_slot');
  END IF;
  IF v_slot.status <> 'active' OR v_slot.expires_at <= now() OR v_slot.slots_needed <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'unavailable');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = v_uid AND b.blocked_id = v_slot.creator_id)
       OR (b.blocker_id = v_slot.creator_id AND b.blocked_id = v_uid)
  ) THEN
    RETURN json_build_object('success', false, 'message', 'unavailable');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.emergency_slot_claims c
    WHERE c.slot_id = p_slot_id AND c.user_id = v_uid
  ) THEN
    RETURN json_build_object('success', false, 'message', 'already_claimed');
  END IF;

  INSERT INTO public.emergency_slot_claims (slot_id, user_id) VALUES (p_slot_id, v_uid);

  UPDATE public.emergency_slots
  SET slots_needed = slots_needed - 1,
      status = CASE WHEN slots_needed - 1 <= 0 THEN 'filled' ELSE status END
  WHERE id = p_slot_id;

  RETURN json_build_object(
    'success', true,
    'message', 'claimed',
    'contact_wa', v_slot.contact_wa,
    'venue_name', v_slot.venue_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_emergency_slot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_emergency_slot(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- Realtime untuk papan SOS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'emergency_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_slots;
  END IF;
END $$;


NOTIFY pgrst, 'reload schema';

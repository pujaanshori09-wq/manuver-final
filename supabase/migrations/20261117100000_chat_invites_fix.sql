-- ============================================================================
-- Chat & ajakan sparing (audit 2026-11-17)
-- Idempotent: aman dijalankan ulang di SQL Editor.
--
--   1. respond_to_sparing_invite(): terima/tolak ajakan lewat RPC. Sebelumnya
--      klien meng-UPDATE messages.metadata, tetapi messages tidak punya policy
--      UPDATE, sehingga perubahan status tidak pernah tersimpan.
--   2. messages.type dibatasi ke nilai yang dikenal klien.
--   3. Policy INSERT messages: pengirim tidak boleh sedang diblokir (dua arah)
--      oleh lawan bicaranya.
--
-- Tidak ada policy UPDATE langsung pada messages: satu-satunya jalur ubah status
-- adalah RPC di bawah, yang memeriksa siapa yang boleh menjawab.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Jawab ajakan sparing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_sparing_invite(
  p_message_id UUID,
  p_status TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_msg RECORD;
  v_match RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Status tidak valid';
  END IF;

  -- Kunci baris agar dua jawaban bersamaan tidak saling menimpa.
  SELECT id, match_id, sender_id, type, metadata
  INTO v_msg
  FROM public.messages
  WHERE id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ajakan tidak ditemukan';
  END IF;

  IF v_msg.type IS DISTINCT FROM 'sparing_invite' THEN
    RAISE EXCEPTION 'Pesan ini bukan ajakan sparing';
  END IF;

  SELECT user_a_id, user_b_id INTO v_match
  FROM public.matches
  WHERE id = v_msg.match_id;

  IF NOT FOUND OR v_uid NOT IN (v_match.user_a_id, v_match.user_b_id) THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  -- Hanya penerima yang boleh menjawab; pengirim tidak bisa menerima ajakannya sendiri.
  IF v_msg.sender_id = v_uid THEN
    RAISE EXCEPTION 'Pengirim tidak dapat menjawab ajakannya sendiri';
  END IF;

  IF COALESCE(v_msg.metadata->>'status', 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'Ajakan ini sudah dijawab';
  END IF;

  UPDATE public.messages
  SET metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object('status', p_status, 'responded_at', now())
  WHERE id = p_message_id;

  RETURN json_build_object('message_id', p_message_id, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_sparing_invite(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_sparing_invite(UUID, TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. messages.type
--    NOT VALID: baris lama tidak diperiksa (tidak gagal bila ada nilai lama),
--    semua INSERT/UPDATE baru tetap wajib lolos.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_type_check' AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_type_check
      CHECK (type IN ('text', 'sparing_invite')) NOT VALID;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. INSERT messages: peserta match dan tidak ada blokir ke arah mana pun
-- ----------------------------------------------------------------------------
-- blocks hanya terbaca oleh pemblokir (policy hardening 16 Nov), jadi subquery di
-- dalam policy tidak akan melihat blokir dari arah sebaliknya. Pemeriksaan dua
-- arah dilakukan di fungsi SECURITY DEFINER ini.
CREATE OR REPLACE FUNCTION public.match_is_blocked(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.blocks b
      ON (b.blocker_id = m.user_a_id AND b.blocked_id = m.user_b_id)
      OR (b.blocker_id = m.user_b_id AND b.blocked_id = m.user_a_id)
    WHERE m.id = p_match_id
      AND (m.user_a_id = auth.uid() OR m.user_b_id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.match_is_blocked(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_is_blocked(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can send messages to their matches." ON public.messages;
CREATE POLICY "Users can send messages to their matches."
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = messages.match_id
        AND (m.user_a_id = auth.uid() OR m.user_b_id = auth.uid())
    )
    AND NOT public.match_is_blocked(messages.match_id)
  );


NOTIFY pgrst, 'reload schema';

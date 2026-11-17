-- ============================================================================
-- get_public_profile(): profil lengkap pemain yang sudah match denganmu
-- (audit 2026-11-17)
-- Idempotent.
--
-- Layar profil lawan bicara (app/user/[id].tsx) sebelumnya menampilkan data
-- tiruan karena umur (tanggal_lahir) adalah kolom privat dan tidak bisa dibaca
-- langsung setelah hardening 16 Nov. RPC ini membuka hanya yang perlu:
--   - hanya untuk pemain yang punya match dengan pemanggil,
--   - tidak untuk pemain yang saling memblokir,
--   - umur dihitung di server; tanggal lahir, alamat lengkap, koordinat,
--     no. HP, dan push token tidak pernah dikembalikan.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Target tidak valid';
  END IF;

  -- Profil sendiri selalu boleh.
  IF p_user_id <> v_uid THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.matches m
      WHERE (m.user_a_id = v_uid AND m.user_b_id = p_user_id)
         OR (m.user_a_id = p_user_id AND m.user_b_id = v_uid)
    ) THEN
      RAISE EXCEPTION 'Akses ditolak';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = v_uid AND b.blocked_id = p_user_id)
         OR (b.blocker_id = p_user_id AND b.blocked_id = v_uid)
    ) THEN
      RAISE EXCEPTION 'Akses ditolak';
    END IF;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN json_build_object(
    'id', v_profile.id,
    'nama', v_profile.nama,
    'umur', CASE WHEN v_profile.tanggal_lahir IS NULL THEN NULL
                 ELSE EXTRACT(YEAR FROM AGE(CURRENT_DATE, v_profile.tanggal_lahir))::INT END,
    'foto_url', v_profile.foto_url,
    'photos', to_jsonb(v_profile.photos),
    'bio', v_profile.bio,
    'skill_level', v_profile.skill_level,
    'pekerjaan', v_profile.pekerjaan,
    'domisili', v_profile.domisili,
    'looking_for', v_profile.looking_for,
    'overall_frequency', v_profile.overall_frequency,
    'preferred_time', v_profile.preferred_time,
    'home_venue', v_profile.home_venue,
    'height_cm', v_profile.height_cm,
    'sport_role', v_profile.sport_role,
    'availability', to_jsonb(v_profile.availability),
    'sports', COALESCE((
      SELECT json_agg(json_build_object('sport_id', us.sport_id, 'experience_level', us.experience_level)
                      ORDER BY us.created_at)
      FROM public.user_sports us
      WHERE us.user_id = p_user_id
    ), '[]'::json),
    'prompts', COALESCE((
      SELECT json_agg(json_build_object('question_text', pq.question_text, 'answer_text', pp.answer_text)
                      ORDER BY pp.display_order)
      FROM public.profile_prompts pp
      JOIN public.prompt_questions pq ON pq.id = pp.question_id
      WHERE pp.user_id = p_user_id
    ), '[]'::json)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

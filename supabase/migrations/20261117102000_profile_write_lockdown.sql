-- ============================================================================
-- profiles: kunci kolom status onboarding (audit 2026-11-17)
-- Idempotent.
--
-- JALANKAN SETELAH klien baru terpasang. Klien lama (layar onboarding lama)
-- masih menulis terms_accepted / onboarding_complete langsung ke profiles dan
-- akan gagal setelah migrasi ini. Klien baru hanya memakai RPC
-- complete_user_onboarding (SECURITY DEFINER), yang tidak terpengaruh GRANT
-- kolom ini.
--
-- Alasannya: setelah hardening 16 Nov, semua kolom non-readonly masih boleh
-- di-UPDATE oleh pemilik profil. Pengguna tidak boleh bisa melewati onboarding
-- dengan menulis onboarding_complete = true sendiri.
-- ============================================================================

DO $$
DECLARE
  v_col text;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['onboarding_complete', 'terms_accepted', 'location_asked', 'has_completed_onboarding']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = v_col
    ) THEN
      EXECUTE format('REVOKE UPDATE (%I) ON TABLE public.profiles FROM authenticated', v_col);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

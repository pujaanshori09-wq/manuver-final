-- ============================================================================
-- FASE 0 — Cek kondisi database live (READ-ONLY, tidak mengubah apa pun)
-- Tempel seluruh isi file ini di Supabase SQL Editor, jalankan, lalu kirim
-- hasil tiap bagian ke saya sebelum menjalankan migrasi 20261117*.
-- ============================================================================

-- 1. Apakah SOS sudah ada di database?
select
  to_regclass('public.emergency_slots')            as emergency_slots_table,
  to_regclass('public.emergency_slot_claims')      as claims_table,
  to_regprocedure('public.claim_emergency_slot(uuid)') as claim_fn;

-- 2. Jika fungsi claim_emergency_slot ada, tampilkan definisinya
--    (abaikan error "does not exist" bila belum ada).
-- select pg_get_functiondef('public.claim_emergency_slot(uuid)'::regprocedure);

-- 3. Policy yang berlaku pada messages dan emergency_slots
select tablename, policyname, cmd
from pg_policies
where tablename in ('messages', 'emergency_slots', 'emergency_slot_claims')
order by tablename, cmd;

-- 4. Apakah migrasi security_hardening (16 Nov) sudah dijalankan?
--    Harus false setelah hardening: klien tidak boleh membaca push_token langsung.
select has_column_privilege('authenticated', 'public.profiles', 'push_token', 'SELECT')
  as can_read_push_token;

-- 5. Kolom status onboarding di profiles
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('onboarding_complete', 'terms_accepted', 'location_asked', 'has_completed_onboarding');

-- 6. Nilai messages.type yang sudah ada (migrasi 20261117100000 membatasi ke text/sparing_invite)
select type, count(*) from public.messages group by type order by 2 desc;

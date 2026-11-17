# Manuver — status proyek

_Diperbarui 17 November 2026._ Catatan lama ("jangan ubah UI") sudah tidak berlaku: UI didesain ulang atas permintaan pemilik produk. Aturan desain ada di [DESIGN.md](DESIGN.md), konteks produk di [PRODUCT.md](PRODUCT.md).

## Ringkas
- Expo SDK 58, React Native 0.88, expo-router, Supabase, React Query.
- Tema terang/gelap mengikuti sistem (Discover dan layar match selalu gelap). Token di `lib/theme/tokens.ts`, komponen di `components/ui/`.
- Bahasa EN (default) / ID: `lib/i18n/{en,id}.ts`.
- `npx tsc --noEmit` → 0 error.

## Migrasi database yang harus dijalankan
Semua file ada di `supabase/migrations/`, idempotent, dijalankan lewat Supabase **SQL Editor**.

1. **Cek dulu (read-only):** jalankan `supabase/checks/phase0_inspect.sql` dan simpan hasilnya.
   - Kalau `emergency_slots` atau `claim_emergency_slot` **sudah ada** di database, bandingkan dengan `20261117101000_emergency_slots.sql` sebelum menjalankannya (file itu mengganti fungsi dan policy-nya).
   - Kalau `messages.type` berisi nilai selain `text`/`sparing_invite`, beri tahu developer sebelum menjalankan migrasi 1.
2. `20261116120000_security_hardening.sql`, kalau belum (cek bagian 4 di skrip Fase 0). Klien sekarang sudah memakai `get_my_profile`.
3. `20261117100000_chat_invites_fix.sql`: RPC `respond_to_sparing_invite`, batas `messages.type`, insert pesan menolak pasangan yang saling blokir.
4. `20261117101000_emergency_slots.sql`: tabel SOS, klaim atomik `claim_emergency_slot`, nomor WA hanya untuk yang berhasil klaim.
5. `20261117103000_public_profile_rpc.sql`: `get_public_profile` untuk layar profil lawan bicara.
6. **Setelah build baru terpasang di semua penguji:** `20261117102000_profile_write_lockdown.sql` (klien tidak bisa lagi menulis `onboarding_complete`/`terms_accepted` sendiri).

Langkah 3–5 aditif dan aman dijalankan sebelum rilis klien. Klien lama tetap jalan, tetapi tombol terima/tolak ajakan baru berfungsi dengan klien baru.

## Variabel lingkungan
`.env` (tidak masuk git) berisi `EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_SENTRY_DSN`, dan `EXPO_PUBLIC_FIREBASE_*`. **EAS Build tidak mengunggah `.env`** (ada di `.gitignore`), jadi set nilai yang sama sebagai EAS environment variables sebelum `eas build`. Tanpa DSN, Sentry otomatis mati, bukan crash.

## Yang berubah pada 17 Nov (perbaikan bug, bukan fitur)
- Chat: pesan tidak lagi ganda; pesan gagal ditandai "Belum terkirim · Ketuk untuk coba lagi"; terima/tolak ajakan tersimpan lewat RPC.
- Daftar chat: avatar "Match baru" dulu membuka obrolan dengan id yang salah, sekarang memakai id match.
- Profil lawan bicara: data sungguhan dari database, bukan profil contoh.
- Discover: tidak lagi mengarang umur/lokasi/jarak; feed menambah halaman saat kartu tinggal ≤ 3; ada pesan error dan tombol coba lagi.
- SOS "Darurat Kurang 1" dan Open sparing tampil di tab Jelajah (segmen Event | Open sparing).
- Hapus akun: alur palsu di layar Filter (yang tidak menghapus apa pun) dibuang. Hapus akun hanya lewat Pengaturan → Hapus akun.
- Sentry: 20% tracing, mati di mode dev; kunci dipindah ke `.env`.
- Kode mati dihapus (cadangan di luar repo).

## Masalah yang diketahui (belum dikerjakan)
- **Dua sumber data olahraga.** Onboarding mengisi tabel `user_sports` (dibaca Discover), sedangkan Edit profil menulis `profiles.hobi`. Mengubah olahraga di Edit profil belum mengubah apa yang dilihat orang lain di Discover. Perlu keputusan model data.
- Belum ada jumlah pesan belum dibaca, status dibaca, pagination chat, atau daftar chat realtime.
- Event dibuat langsung berstatus `approved` dari klien.
- Analytics GA4 memakai `cid` acak per event (tidak ada sesi pengguna).
- Pro/Elite masih tampilan saja (tanpa pembayaran).
- Super ajak dicatat sebagai `like` biasa di server.

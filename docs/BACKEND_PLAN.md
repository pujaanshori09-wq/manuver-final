# Backend Manuver — Express + PostgreSQL + Prisma

Menggantikan Supabase sepenuhnya: login, database, upload foto, dan realtime.
Keputusan: TypeScript, JWT sendiri + Google, Socket.IO, foto di disk (bisa pindah ke S3/R2),
mulai dari database kosong, pindah bertahap per fitur.

## Struktur
```
manuverpro-main/
├─ app/, components/, lib/ …      ← app Expo (tetap di root)
└─ server/                         ← backend
   ├─ prisma/schema.prisma         ← satu sumber kebenaran skema
   ├─ src/
   │  ├─ index.ts                  ← HTTP + Socket.IO
   │  ├─ app.ts                    ← Express (helmet, cors, rate limit, error handler)
   │  ├─ config/env.ts             ← env divalidasi Zod; server menolak start bila salah
   │  ├─ lib/                      ← prisma, jwt, password, storage, errors
   │  ├─ middleware/               ← requireAuth, validate (Zod), error
   │  ├─ modules/<fitur>/          ← routes + service per fitur
   │  └─ realtime/                 ← Socket.IO (room per match)
   ├─ tests/                       ← Vitest + Supertest, DB uji terpisah
   └─ docker-compose.yml           ← Postgres 16 lokal
```

## Model data (Prisma)
User (+ RefreshToken), Profile, ProfilePhoto, UserSport (satu-satunya sumber olahraga — menyelesaikan
masalah `hobi` vs `user_sports`), PromptQuestion/ProfilePrompt, Swipe, Match, Message
(type `TEXT | SPARING_INVITE`, status ajakan), Block, Report, OpenSession/SessionParticipant,
EmergencySlot/EmergencySlotClaim, Event/EventRegistration.
Aturan yang dulu ada di RLS/RPC Supabase dipindah ke service + transaksi Prisma.

## API (REST, prefix `/v1`)
| Fitur | Endpoint utama |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/google`, `GET /auth/me` |
| Profil | `GET/PATCH /me/profile`, `POST /me/onboarding`, `POST/DELETE /me/photos`, `PUT /me/prompts`, `GET /users/:id` (hanya bila sudah match) |
| Discover | `GET /discover` (jarak, umur, olahraga; cursor), `POST /swipes` → `{ isMatch, matchId }` |
| Chat | `GET /matches`, `GET /matches/:id/messages?before=`, `POST /matches/:id/messages`, `POST /messages/:id/respond` |
| Sesi | `GET/POST /sessions`, `POST/DELETE /sessions/:id/join` |
| SOS | `GET/POST /sos`, `POST /sos/:id/claim` (nomor WA hanya untuk yang berhasil klaim) |
| Event | `GET/POST /events`, `POST /events/:id/register` |
| Keamanan | `POST /blocks`, `DELETE /blocks/:id`, `POST /reports`, `DELETE /me` (hapus akun + file) |

Realtime Socket.IO (token JWT saat connect): `message:new`, `message:updated`, `match:new`, `sos:changed`.

## Keamanan
bcrypt untuk password, access token 15 menit + refresh token 30 hari (disimpan hash, dirotasi, bisa dicabut),
rate limit di auth, Zod di setiap input, otorisasi per resource di service (bukan di klien),
upload dibatasi tipe & ukuran, tidak ada data privat (tanggal lahir, koordinat, no. HP, WA) di respons publik.

## Tahapan (tiap tahap dicek di HP)
1. **Fondasi + auth** — scaffold, skema lengkap, Postgres Docker, register/login/refresh/Google, tes.
2. **App: auth & profil** — app login lewat backend baru; onboarding, profil, edit profil, foto, prompt.
3. **Discover & match** — feed jarak/umur/olahraga, swipe, match, layar match.
4. **Chat realtime** — daftar chat, pesan, ajakan sparing, Socket.IO.
5. **Sesi, SOS, event** — Jelajah.
6. **Keamanan & akun** — blokir/lapor, hapus akun, push notification (Expo push dari server).
7. **Lepas Supabase** — hapus `@supabase/supabase-js`, deploy server (Render/Railway/VPS) + Postgres terkelola.

## Catatan
- HP tidak bisa menjangkau laptop lewat Wi-Fi kos (isolasi). Untuk uji di HP, server dibuka lewat tunnel (ngrok) seperti app Expo.
- Folder `supabase/` dibiarkan sampai tahap 7 sebagai referensi aturan lama.

## Aturan swipe & anti-bot (MVP, disepakati 19 Nov 2026)
Semua dihitung di server dari tabel `swipe_events` (`server/src/modules/discover/quota.ts`); app hanya menampilkan.
| | Free | Premium (`users.premiumUntil` > sekarang) |
|---|---|---|
| Like per hari (reset 00.00 WIB) | 20 | tanpa batas |
| Super Like per minggu (reset Senin 00.00 WIB, terpisah dari Like) | 1 | 5 |
| Skip/Pass | bebas | bebas |
| Semua swipe | 60/menit, 500/jam | 60/menit, 500/jam |

Penolakan: HTTP 429 `swipe_limit_reached` (kuota) atau `swipe_rate_limited` (kecepatan), `details.resetsAt`.
Premium sementara diisi manual lewat Prisma Studio; pembayaran (Play Billing / Apple IAP) setelah MVP.

Tanda bot → `profiles.flaggedForReview = true` (hilang dari Discover, tidak diblokir) + baris `abuse_events`:
3× kena batas swipe dalam sehari; 50 swipe dengan jeda nyaris sama; >95% Like dari 200 swipe terakhir;
pesan ≥20 huruf yang sama ke 5 match dalam 24 jam. Tinjau di Prisma Studio.

Privasi: lokasi disimpan dibulatkan ke grid 0,005° (~550 m) dan hanya diganti paling sering tiap 5 menit;
foto selalu di-encode ulang (sharp): tegak, maks 1600 px, JPEG, tanpa EXIF/GPS.
Rate limit & PKCE Google disimpan di memori → server dijalankan 1 instance sampai dipindah ke Redis.

## Blokir, lapor, push (Tahap B)
- `POST /v1/blocks {userId}`, `DELETE /v1/blocks/:userId`, `GET /v1/blocks`: blokir menyembunyikan dua arah
  (Discover, chat, profil, aktivitas); match tetap ada, jadi buka blokir mengembalikan chat.
- `POST /v1/reports {userId, reason: RUDE|SPAM|FAKE|INAPPROPRIATE|UNDERAGE|OTHER, details?}`: satu laporan per
  pemain per hari; email terlapor disimpan. Ditinjau di Prisma Studio (`reports.status`).
- `PUT/DELETE /v1/me/push-token {token}`: tabel `push_tokens` (satu baris per HP). Push dikirim **hanya oleh server**
  lewat Expo (`server/src/lib/push.ts`): match baru (ke orang satunya), pesan, ajakan sparing, jawaban ajakan;
  teks dalam bahasa penerima (`pushText.ts`). Token yang `DeviceNotRegistered` dihapus otomatis.
- Push tidak jalan di Expo Go (Android); perlu development build (EAS) untuk uji di HP.

## Sesi, SOS, event (Tahap C) — Supabase sudah dilepas dari app
- `/v1/sessions`: daftar (hanya yang akan datang, blokir disembunyikan), buat (tuan rumah otomatis peserta #1,
  maks 5 sesi aktif), `POST/DELETE /:id/join` (kuota & preferensi gender dicek server, FULL/OPEN otomatis),
  `DELETE /:id` (tuan rumah membatalkan).
- `/v1/sos`: daftar (nomor WA tidak pernah ikut), buat (waktu main default +2 jam, hilang 2 jam setelah main,
  maks 3 aktif), `POST /:id/claim` (mengembalikan nomor WA hanya untuk yang dapat slot), `DELETE /:id`.
- `/v1/events`: tanggal = `startsAt` (DateTime), harga = `priceIdr` (angka, 0 = gratis). Event baru PENDING dan
  hanya terlihat pembuatnya sampai di-APPROVE di Prisma Studio. `POST/DELETE /:id/register` dengan kuota.
- Kunci advisory per baris membuat slot/kuota tidak pernah terlampaui walau diklik bersamaan.
- `@supabase/supabase-js` dan `lib/supabase.js` dihapus; folder `supabase/` tetap sebagai arsip aturan lama.
- Catatan: `components/SessionsFeed.tsx` (berisi papan SOS) belum dipasang di layar mana pun (lihat "Langkah B").

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

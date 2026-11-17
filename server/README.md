# Manuver API

Express 5 + PostgreSQL 16 + Prisma 7, TypeScript. Rencana lengkap: [../docs/BACKEND_PLAN.md](../docs/BACKEND_PLAN.md).

## Menjalankan di laptop
Butuh Node 22+ dan Docker Desktop.

```bash
cd server
npm install
cp .env.example .env        # lalu isi JWT_*_SECRET dengan string acak panjang
npm run db:up               # Postgres di Docker (port 5432)
npm run db:migrate          # terapkan migrasi ke database development
npm run dev                 # http://localhost:4000, restart otomatis saat file berubah
```

Cek: `curl http://localhost:4000/health` → `{"ok":true}`.

## Perintah
| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server development (watch) |
| `npm test` | Tes otomatis di database `manuver_test` (terpisah dari data development) |
| `npm run typecheck` | Cek tipe TypeScript |
| `npm run db:migrate` | Buat & terapkan migrasi setelah mengubah `prisma/schema.prisma` |
| `npm run db:studio` | Lihat isi database di browser |
| `npm run db:down` | Matikan Postgres (data tetap tersimpan) |
| `npm run build` / `npm start` | Build dan jalankan versi produksi |

## API yang sudah tersedia (tahap 1)
Semua di bawah `/v1`. Respons error selalu `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/register` | `{ email, password, name? }` → `{ user, accessToken, refreshToken, expiresIn }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/google` | `{ idToken }` dari Google Sign-In (butuh `GOOGLE_CLIENT_IDS`) |
| POST | `/auth/refresh` | `{ refreshToken }` → token baru; token lama tidak berlaku lagi |
| POST | `/auth/logout` | `{ refreshToken }` |
| POST | `/auth/password/forgot` | `{ email }` → selalu 202 (di development, link reset tampil di log server) |
| POST | `/auth/password/reset` | `{ token, password }` |
| GET | `/auth/me` | Header `Authorization: Bearer <accessToken>` |

Access token berlaku 15 menit; app memperbaruinya dengan refresh token (30 hari, dirotasi setiap kali dipakai).

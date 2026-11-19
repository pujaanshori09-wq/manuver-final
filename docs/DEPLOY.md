# Deploy Manuver (MVP)

The API ships as one Docker image (`server/Dockerfile`). On every start it applies pending database
migrations, then serves on `$PORT`. Health check: `GET /health`.

> Run **one** instance. Rate limits and the Google sign-in handshake live in memory until they move to Redis.

## 1. What you need (accounts you create yourself)
| Piece | Suggested | Notes |
|---|---|---|
| PostgreSQL 16 | Neon, Supabase Postgres, Railway, or your VPS | Copy the connection string with `?sslmode=require` if the host asks for SSL. Turn on daily backups. |
| API hosting | Railway, Render, Fly.io, or a VPS with Docker | Point it at `server/` (Dockerfile). |
| Photo bucket | Supabase Storage (free, no card) — or Backblaze B2 / Cloudflare R2 | Any S3-compatible bucket with public read; see "Photo bucket" below. |
| Email | Resend | Verify your domain so emails reach everyone, not only your own address. |
| Push | Expo (EAS) | Needed for the app build; see step 4. |

## 2. Environment variables (set them in the hosting dashboard, never commit them)
```
NODE_ENV=production
DATABASE_URL=postgresql://…
JWT_ACCESS_SECRET=<48+ random characters>
JWT_REFRESH_SECRET=<a different 48+ random characters>
PUBLIC_BASE_URL=https://api.yourdomain.com
OAUTH_ORIGINS=https://api.yourdomain.com
CORS_ORIGINS=                      # empty unless a website calls the API
RESEND_API_KEY=re_…
EMAIL_FROM=Manuver <noreply@yourdomain.com>
GOOGLE_CLIENT_ID=… / GOOGLE_CLIENT_SECRET=…   # optional; register https://api.yourdomain.com/v1/auth/google/callback
STORAGE_DRIVER=s3
S3_ENDPOINT=…  S3_REGION=…  S3_BUCKET=manuver-photos
S3_ACCESS_KEY_ID=… / S3_SECRET_ACCESS_KEY=…
S3_PUBLIC_URL=…  S3_FORCE_PATH_STYLE=…        # values per provider below
```

### Photo bucket (pick one)
**Supabase Storage — free (about 1 GB), no card.** About 3,000 profile photos at 1600 px.
1. supabase.com → New project (region Singapore). Only Storage is used; the app does not use Supabase otherwise.
2. Storage → New bucket `manuver-photos` → **Public bucket** on.
3. Project Settings → Storage → **S3 Connection**: copy the endpoint and region, then **New access key**
   (the secret is shown once).
```
S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
S3_REGION=<region shown there, e.g. ap-southeast-1>
S3_BUCKET=manuver-photos
S3_PUBLIC_URL=https://<project-ref>.supabase.co/storage/v1/object/public/manuver-photos
S3_FORCE_PATH_STYLE=true
```

**Backblaze B2 — free tier, more room.** Check on their pricing page whether a card is asked.
Bucket `manuver-photos` set to Public; App Keys → Add key with Read and Write on that bucket (keyID = access key,
applicationKey = secret). The S3 endpoint is on the bucket page.
```
S3_ENDPOINT=https://s3.<region>.backblazeb2.com
S3_REGION=<region, e.g. us-west-004>
S3_PUBLIC_URL=https://manuver-photos.s3.<region>.backblazeb2.com
S3_FORCE_PATH_STYLE=false
```

**Cloudflare R2 — free tier, may ask for a payment method.**
```
S3_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_PUBLIC_URL=https://pub-xxxx.r2.dev
S3_FORCE_PATH_STYLE=false
```
Switching later only means new photos go to the new bucket; move existing files across before switching.
Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
The server refuses to start in production with the example secrets, two equal secrets, a plain-http
`PUBLIC_BASE_URL`, no `RESEND_API_KEY`, or an incomplete bucket setup, and lists what is wrong.

## Render (ready-made: `render.yaml`)
1. render.com → sign in with GitHub → **New** → **Blueprint** → pick `manuver-final`.
2. Render reads `render.yaml` (service `manuver-api`, Docker, Singapore, free plan, health check `/health`,
   deploys only commits whose CI passed). The two JWT secrets are generated for you.
3. It asks once for: `DATABASE_URL`, `PUBLIC_BASE_URL` and `OAUTH_ORIGINS` (both `https://manuver-api.onrender.com`,
   or the address Render shows if that name is taken), `RESEND_API_KEY`, `EMAIL_FROM`, and the Supabase Storage values
   `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`. Later changes: the
   service's **Environment** tab (Render only asks during the first Blueprint setup).
4. After the deploy turns green, from `server/`: `npm run smoke -- https://manuver-api.onrender.com`.
   It signs up a throwaway account, uploads a photo, checks it is public and GPS-free, then deletes the account.
5. Free plan: sleeps after 15 idle minutes and takes about a minute to wake. Switch the plan before launch.

## 3. First deploy
1. Create the database and the bucket; set the variables above.
2. Deploy the `server/` folder (Dockerfile). The first start creates every table.
3. `curl https://api.yourdomain.com/health` → `{"ok":true}`.
4. Never run `npm run db:seed:demo` against production (the script refuses anyway).

## 4. The app
- Set `EXPO_PUBLIC_API_URL=https://api.yourdomain.com` for builds (read by `lib/api/config.ts`).
- Push notifications need a development/production build, not Expo Go: `eas init` (adds the EAS project id),
  then `eas build`. The server sends pushes through Expo with the tokens the app registers.

## 5. Day-to-day moderation (Prisma Studio)
Open with the production `DATABASE_URL` from your own computer: `npx prisma studio` in `server/`.
- `reports` with status `OPEN` → review, then set `REVIEWED`, `ACTIONED` or `DISMISSED`.
- `profiles.flaggedForReview = true` → hidden from Discover; the reason is in `abuse_events`.
- `events` with status `PENDING` → set `APPROVED` or `REJECTED`.
- Premium: set `users.premiumUntil` to the end date.

## 6. Every change
GitHub Actions (`.github/workflows/ci.yml`) runs the API typecheck and tests against PostgreSQL, builds the
Docker image, and typechecks the app on every push. Deploy only from a green commit.

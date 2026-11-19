// Checks a deployed API end to end, then cleans up after itself.
//   npm run smoke -- https://manuver-api.onrender.com
// Creates a throwaway account, uploads a photo with GPS data, checks the stored copy has none,
// and deletes the account again (with its photos). Nothing else on the server is touched.
import sharp from 'sharp';

const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: npm run smoke -- https://your-api-address');
  process.exit(1);
}

let failed = false;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => {
  failed = true;
  console.log(`  ✗ ${msg}`);
};
async function call(path, init = {}) {
  const res = await fetch(base + path, { ...init, signal: AbortSignal.timeout(90_000) });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

console.log(`Checking ${base}`);
console.log('  (a free Render service may need about a minute to wake up)');

const health = await call('/health');
if (health.status === 200 && health.body?.ok) ok('server is up and reaches the database');
else {
  bad(`/health answered ${health.status}: ${JSON.stringify(health.body).slice(0, 200)}`);
  process.exit(1);
}

// .invalid can never receive mail, so the welcome email goes nowhere.
const email = `smoke-${Date.now()}@manuver.invalid`;
const reg = await call('/v1/auth/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'smoke-test-password-1', name: 'Smoke Test' }),
});
if (reg.status !== 201) {
  bad(`sign-up answered ${reg.status}: ${JSON.stringify(reg.body).slice(0, 200)}`);
  process.exit(1);
}
ok('sign-up works and issues tokens');
const auth = { Authorization: `Bearer ${reg.body.accessToken}` };

try {
  const prompts = await call('/v1/prompts/questions', { headers: auth });
  if (prompts.status === 200 && prompts.body.length > 0) ok(`${prompts.body.length} profile questions are seeded`);
  else bad('no profile questions: run the seed (docs/DEPLOY.md)');

  const photo = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#ff5a1f' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '6/1 54/1 0/1' } })
    .toBuffer();
  const form = new FormData();
  form.append('photo', new Blob([photo], { type: 'image/jpeg' }), 'smoke.jpg');
  const up = await call('/v1/me/photos', { method: 'POST', headers: auth, body: form });
  if (up.status !== 201) bad(`photo upload answered ${up.status}: ${JSON.stringify(up.body).slice(0, 300)}`);
  else {
    const url = up.body.photos[0].url;
    const full = url.startsWith('http') ? url : base + url;
    ok(`photo uploaded (${url.startsWith('http') ? 'bucket' : 'server disk'})`);
    const res = await fetch(full, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) bad(`the photo address does not open (${res.status}): is the bucket public? ${full}`);
    else {
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
      if (meta.exif) bad('stored photo still carries EXIF/GPS data');
      else ok(`photo is public, ${meta.width}×${meta.height}, no GPS data`);
    }
    if (!url.startsWith('http')) bad('photos are stored on the server disk: set STORAGE_DRIVER=s3 for production');
  }
} finally {
  const del = await call('/v1/me', { method: 'DELETE', headers: auth });
  if (del.status === 204) ok('test account and its photos deleted');
  else bad(`could not delete the test account (${del.status}); remove ${email} by hand`);
}

console.log(failed ? '\nSome checks failed (see ✗ above).' : '\nAll checks passed.');
process.exit(failed ? 1 : 0);

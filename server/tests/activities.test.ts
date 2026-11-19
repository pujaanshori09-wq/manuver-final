import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { decode, encode, metersBetween, trimEnds, type LatLng } from '../src/lib/polyline.js';
import { prisma } from '../src/lib/prisma.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function player(name: string) {
  const reg = await registerUser();
  await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({
      name,
      birthDate: '1995-06-01',
      gender: 'OTHER',
      genderPreference: 'ALL',
      ageMin: 18,
      ageMax: 60,
      language: 'EN',
      sports: [{ sportId: 'lari' }],
      acceptTerms: true,
    });
  return { id: reg.user.id, token: reg.accessToken };
}
type P = Awaited<ReturnType<typeof player>>;

async function match(a: P, b: P) {
  await api().post('/v1/swipes').set(auth(a.token)).send({ targetId: b.id, action: 'LIKE' });
  await api().post('/v1/swipes').set(auth(b.token)).send({ targetId: a.id, action: 'LIKE' });
}

/** A straight 1 km line north, one point every 10 m (0.00009° latitude ≈ 10 m). */
const LINE: LatLng[] = Array.from({ length: 101 }, (_, i) => [-6.9 + i * 0.00009, 107.6]);

const body = (over: Record<string, unknown> = {}) => ({
  clientId: randomUUID(),
  type: 'RUN',
  title: 'Morning run',
  startedAt: '2026-11-18T00:00:00.000Z',
  endedAt: '2026-11-18T00:06:00.000Z',
  movingSec: 330,
  distanceM: 1000,
  polyline: encode(LINE),
  // One point every 3.3 s: 1 km in 330 s, an easy 5:30/km run.
  pointTimes: LINE.map((_, i) => Math.round(i * 3.3)),
  showOnProfile: true,
  ...over,
});

const save = (p: P, over: Record<string, unknown> = {}) => api().post('/v1/activities').set(auth(p.token)).send(body(over));

describe('polyline helpers', () => {
  it('round-trips and trims both ends', () => {
    const back = decode(encode(LINE));
    expect(back).toHaveLength(LINE.length);
    expect(metersBetween(back[0]!, LINE[0]!)).toBeLessThan(1);

    const trimmed = trimEnds(LINE, 200);
    expect(metersBetween(LINE[0]!, trimmed[0]!)).toBeGreaterThanOrEqual(199);
    expect(metersBetween(trimmed.at(-1)!, LINE.at(-1)!)).toBeGreaterThanOrEqual(199);
    expect(trimEnds(LINE.slice(0, 30), 200)).toEqual([]); // 290 m: nothing safe to show
  });
});

describe('activities', () => {
  it('saves, lists and reads an activity; a retry does not duplicate it', async () => {
    const me = await player('Me');
    const b = body();
    const first = await api().post('/v1/activities').set(auth(me.token)).send(b);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ type: 'RUN', distanceM: 1000, movingSec: 330, showOnProfile: true, route: b.polyline });

    const again = await api().post('/v1/activities').set(auth(me.token)).send(b);
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.activity.count()).toBe(1);

    const list = await api().get('/v1/activities').set(auth(me.token));
    expect(list.body.map((a: { id: string }) => a.id)).toEqual([first.body.id]);
    expect((await api().get(`/v1/activities/${first.body.id}`).set(auth(me.token))).body.route).toBe(b.polyline);
  });

  it('accepts a long route above the default body limit', async () => {
    const me = await player('Me');
    // A long ride, a point every 2 s moving ~39 m (~70 km/h, under the ride limit):
    // well over 100 KB once encoded, plus one time per point.
    const N = 28_000;
    const long: LatLng[] = Array.from({ length: N }, (_, i) => [-6.9 + i * 0.00025, 107.6 + i * 0.00025]);
    const polyline = encode(long);
    expect(polyline.length).toBeGreaterThan(100_000);
    const res = await save(me, {
      type: 'RIDE',
      polyline,
      pointTimes: long.map((_, i) => i * 2),
      endedAt: '2026-11-18T16:00:00.000Z',
      movingSec: 50_000,
      distanceM: 100_000,
    });
    expect(res.status).toBe(201);
  });

  it('rejects too short, impossible or broken recordings', async () => {
    const me = await player('Me');
    expect((await save(me, { distanceM: 99 })).status).toBe(400);
    expect((await save(me, { movingSec: 59 })).status).toBe(400);
    expect((await save(me, { endedAt: '2026-11-17T23:00:00.000Z' })).status).toBe(400);
    expect((await save(me, { movingSec: 3600 })).status).toBe(400); // longer than the 6 minutes elapsed
    expect((await save(me, { type: 'SWIM' })).status).toBe(400);
    expect((await save(me, { polyline: '~~~' })).status).toBe(400);
    expect((await save(me, { polyline: encode([[0, 0]]) })).status).toBe(400);
    expect((await api().post('/v1/activities').send(body())).status).toBe(401);
  });

  it('lets only the owner rename, hide or delete', async () => {
    const [me, other] = [await player('Me'), await player('Other')];
    const { body: a } = await save(me);

    expect((await api().patch(`/v1/activities/${a.id}`).set(auth(other.token)).send({ showOnProfile: false })).status).toBe(404);
    const hidden = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ showOnProfile: false, title: 'Easy run' });
    expect(hidden.body).toMatchObject({ showOnProfile: false, title: 'Easy run' });
    expect((await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ distanceM: 5 })).status).toBe(400);

    expect((await api().delete(`/v1/activities/${a.id}`).set(auth(other.token))).status).toBe(404);
    expect((await api().delete(`/v1/activities/${a.id}`).set(auth(me.token))).status).toBe(204);
    expect(await prisma.activity.count()).toBe(0);
  });
});

describe('on the profile', () => {
  it('shows matched players only the activities on the profile, with the route ends trimmed', async () => {
    const [me, friend, stranger] = [await player('Me'), await player('Friend'), await player('Stranger')];
    await match(me, friend);
    const { body: shown } = await save(me, { startedAt: '2026-11-18T00:00:00.000Z' });
    const { body: hidden } = await save(me, { showOnProfile: false });

    const prof = await api().get(`/v1/users/${me.id}`).set(auth(friend.token));
    expect(prof.status).toBe(200);
    expect(prof.body).toMatchObject({ name: 'Me', sports: [{ sportId: 'lari' }] });
    expect(prof.body.activities.map((a: { id: string }) => a.id)).toEqual([shown.id]);

    const seen = prof.body.activities[0];
    expect(seen).not.toHaveProperty('clientId');
    const route = decode(seen.route);
    expect(metersBetween(LINE[0]!, route[0]!)).toBeGreaterThanOrEqual(199);
    expect(metersBetween(route.at(-1)!, LINE.at(-1)!)).toBeGreaterThanOrEqual(199);

    expect((await api().get(`/v1/activities/${shown.id}`).set(auth(friend.token))).status).toBe(200);
    expect((await api().get(`/v1/activities/${hidden.id}`).set(auth(friend.token))).status).toBe(404);
    expect((await api().get(`/v1/users/${me.id}/activities`).set(auth(friend.token))).body).toHaveLength(1);

    // Not matched: no profile, no activities.
    expect((await api().get(`/v1/users/${me.id}`).set(auth(stranger.token))).status).toBe(404);
    expect((await api().get(`/v1/activities/${shown.id}`).set(auth(stranger.token))).status).toBe(404);
    expect((await api().get(`/v1/users/${me.id}/activities`).set(auth(stranger.token))).status).toBe(404);
  });

  it('hides everything once either side blocks', async () => {
    const [me, friend] = [await player('Me'), await player('Friend')];
    await match(me, friend);
    const { body: a } = await save(me);
    await prisma.block.create({ data: { blockerId: me.id, blockedId: friend.id } });
    expect((await api().get(`/v1/users/${me.id}`).set(auth(friend.token))).status).toBe(404);
    expect((await api().get(`/v1/activities/${a.id}`).set(auth(friend.token))).status).toBe(404);
  });

  it('lists only my profile activities when asked', async () => {
    const me = await player('Me');
    await save(me);
    await save(me, { showOnProfile: false });
    expect((await api().get('/v1/activities?onProfile=true').set(auth(me.token))).body).toHaveLength(1);
    expect((await api().get('/v1/activities').set(auth(me.token))).body).toHaveLength(2);
  });
});

describe('public link', () => {
  const page = (slugOrUrl: string, lang = 'en') =>
    api().get(slugOrUrl.startsWith('/a/') ? slugOrUrl : `/a/${slugOrUrl}`).set('Accept-Language', lang);
  const pathOf = (url: string) => new URL(url).pathname;

  it('is off by default and only the owner can switch it', async () => {
    const [me, other] = [await player('Me Name'), await player('Other')];
    const { body: a } = await save(me);
    expect(a).toMatchObject({ isPublic: false, publicUrl: null });
    expect((await api().patch(`/v1/activities/${a.id}`).set(auth(other.token)).send({ isPublic: true })).status).toBe(404);

    const on = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });
    expect(on.body.isPublic).toBe(true);
    expect(on.body.publicUrl).toMatch(/\/a\/[A-Za-z0-9_-]{12}$/);
  });

  it('serves a page anyone can open, with a trimmed route and nothing private', async () => {
    const me = await player('Rasya Santoso'); // an 's' before the space catches a broken split
    const { body: a } = await save(me, { title: '<script>alert(1)</script> Pagi' });
    const { body: on } = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });

    const res = await page(pathOf(on.publicUrl));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.headers['x-robots-tag']).toMatch(/noindex/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
    expect(res.text).toContain('1.00');
    expect(res.text).toContain('by Rasya ');
    expect(res.text).not.toContain('Santoso'); // first name only
    expect(res.text).not.toContain('<script>alert(1)'); // titles are escaped
    for (const secret of ['@test.manuver', '1995', 'birthDate', 'latitude']) expect(res.text).not.toContain(secret);

    // The route in the page starts and ends at least 200 m inside the real one.
    const route = JSON.parse(res.text.match(/var route=(\[.*?\]);/)![1]!) as LatLng[];
    expect(metersBetween(LINE[0]!, route[0]!)).toBeGreaterThanOrEqual(199);
    expect(metersBetween(route.at(-1)!, LINE.at(-1)!)).toBeGreaterThanOrEqual(199);

    expect((await page(pathOf(on.publicUrl), 'id-ID,id;q=0.9')).text).toContain('oleh Rasya ');
  });

  it('stops working when switched off, and comes back with the same link', async () => {
    const me = await player('Me');
    const { body: a } = await save(me);
    const { body: on } = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });
    await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: false });

    const off = await page(pathOf(on.publicUrl));
    expect(off.status).toBe(404);
    expect(off.text).toContain('not available');

    const again = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });
    expect(again.body.publicUrl).toBe(on.publicUrl);
    expect((await page(pathOf(on.publicUrl))).status).toBe(200);
  });

  it('looks the same for unknown, malformed and deleted links', async () => {
    const me = await player('Me');
    const { body: a } = await save(me);
    const { body: on } = await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });
    await api().delete(`/v1/activities/${a.id}`).set(auth(me.token));

    for (const p of [pathOf(on.publicUrl), 'AAAAAAAAAAAA', 'short', '../../etc']) {
      expect((await page(p)).status).toBe(404);
    }
  });

  it('keeps other people from seeing whether my activity has a link', async () => {
    const [me, friend] = [await player('Me'), await player('Friend')];
    await match(me, friend);
    const { body: a } = await save(me);
    await api().patch(`/v1/activities/${a.id}`).set(auth(me.token)).send({ isPublic: true });
    const seen = await api().get(`/v1/activities/${a.id}`).set(auth(friend.token));
    expect(seen.body).not.toHaveProperty('publicUrl');
    expect(seen.body).not.toHaveProperty('isPublic');
  });

  it('serves the map library itself', async () => {
    const res = await api().get('/a/_/leaflet.js');
    expect(res.status).toBe(200);
    expect(res.text.length).toBeGreaterThan(10_000);
  });
});

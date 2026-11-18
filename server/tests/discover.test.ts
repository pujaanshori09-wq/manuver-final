import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Somewhere in South Jakarta; offsets below are roughly 1.1 km per 0.01 degree of latitude. */
const HOME = { latitude: -6.2297, longitude: 106.8091 };
const near = { latitude: HOME.latitude + 0.02, longitude: HOME.longitude }; // about 2 km
const mid = { latitude: HOME.latitude + 0.2, longitude: HOME.longitude }; // about 22 km
const far = { latitude: -6.9175, longitude: 107.6191 }; // Bandung, about 115 km

/** A birth date that makes the person exactly `age` years old today. */
const born = (age: number) => `${new Date().getUTCFullYear() - age}-01-01`;

type Opts = {
  name: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  genderPreference?: 'ALL' | 'MEN' | 'WOMEN';
  ageMin?: number;
  ageMax?: number;
  location?: { latitude: number; longitude: number } | null;
  sports?: string[];
};

/** Registers an account and finishes onboarding. */
async function player(o: Opts) {
  const reg = await registerUser();
  const res = await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({
      name: o.name,
      birthDate: born(o.age ?? 25),
      gender: o.gender ?? 'OTHER',
      genderPreference: o.genderPreference ?? 'ALL',
      ageMin: o.ageMin ?? 18,
      ageMax: o.ageMax ?? 60,
      language: 'EN',
      sports: (o.sports ?? ['badminton']).map((sportId) => ({ sportId })),
      acceptTerms: true,
      ...(o.location === null ? {} : { location: o.location ?? HOME }),
    });
  if (res.status !== 200) throw new Error(`onboarding failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: reg.user.id, token: reg.accessToken };
}

type P = Awaited<ReturnType<typeof player>>;

async function feed(p: P, query = '') {
  const res = await api().get(`/v1/discover${query}`).set(auth(p.token));
  expect(res.status).toBe(200);
  return res.body.items as { id: string; name: string; distanceKm: number | null; [k: string]: unknown }[];
}

const names = (items: { name: string }[]) => items.map((i) => i.name);

const swipe = (p: P, targetId: string, action: 'LIKE' | 'PASS' | 'SUPER') =>
  api().post('/v1/swipes').set(auth(p.token)).send({ targetId, action });

describe('GET /discover', () => {
  it('requires a token and a finished onboarding', async () => {
    expect((await api().get('/v1/discover')).status).toBe(401);
    const fresh = await registerUser();
    const res = await api().get('/v1/discover').set(auth(fresh.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('onboarding_required');
  });

  it('lists the nearest players first and never leaks private data', async () => {
    const me = await player({ name: 'Me' });
    await player({ name: 'Mid', location: mid });
    await player({ name: 'Near', location: near });

    const items = await feed(me);
    expect(names(items)).toEqual(['Near', 'Mid']);
    expect(items[0]!.distanceKm).toBe(3);
    expect(Number.isInteger(items[1]!.distanceKm)).toBe(true);

    const json = JSON.stringify(items);
    for (const secret of ['birthDate', 'latitude', 'longitude', 'email', 'passwordHash', 'pushToken']) {
      expect(json).not.toContain(secret);
    }
    expect(items[0]).toMatchObject({ age: 25, sports: [{ sportId: 'badminton' }], photos: [], prompts: [] });
  });

  it('leaves out yourself, people you already swiped, ghosts and blocked accounts', async () => {
    const me = await player({ name: 'Me' });
    const swiped = await player({ name: 'Swiped' });
    const ghost = await player({ name: 'Ghost' });
    const blockedByMe = await player({ name: 'BlockedByMe' });
    const blocksMe = await player({ name: 'BlocksMe' });
    await player({ name: 'Visible' });

    await swipe(me, swiped.id, 'PASS');
    await api().patch('/v1/me/profile').set(auth(ghost.token)).send({ ghostMode: true });
    await prisma.block.create({ data: { blockerId: me.id, blockedId: blockedByMe.id } });
    await prisma.block.create({ data: { blockerId: blocksMe.id, blockedId: me.id } });

    expect(names(await feed(me))).toEqual(['Visible']);
  });

  it('respects distance, including overrides from the filter screen', async () => {
    const me = await player({ name: 'Me' });
    await player({ name: 'Near', location: near });
    await player({ name: 'Mid', location: mid });
    await player({ name: 'Far', location: far });

    await api().patch('/v1/me/profile').set(auth(me.token)).send({ maxDistanceKm: 10 });
    expect(names(await feed(me))).toEqual(['Near']);
    expect(names(await feed(me, '?maxDistanceKm=50'))).toEqual(['Near', 'Mid']);
    expect(names(await feed(me, '?maxDistanceKm=200'))).toEqual(['Near', 'Mid', 'Far']);
  });

  it('filters by age and by sport', async () => {
    const me = await player({ name: 'Me', ageMin: 20, ageMax: 30 });
    await player({ name: 'Twenty', age: 20, sports: ['badminton'] });
    await player({ name: 'Thirty', age: 30, sports: ['running'] });
    await player({ name: 'TooYoung', age: 19 });
    await player({ name: 'TooOld', age: 31 });

    expect(names(await feed(me)).sort()).toEqual(['Thirty', 'Twenty']);
    expect(names(await feed(me, '?sports=running'))).toEqual(['Thirty']);
    expect(names(await feed(me, '?ageMin=25&ageMax=40')).sort()).toEqual(['Thirty', 'TooOld']);
  });

  it('applies gender preference in both directions', async () => {
    const me = await player({ name: 'Me', gender: 'MALE', genderPreference: 'WOMEN' });
    await player({ name: 'WomanOpen', gender: 'FEMALE', genderPreference: 'ALL' });
    await player({ name: 'WomanWantsMen', gender: 'FEMALE', genderPreference: 'MEN' });
    await player({ name: 'WomanWantsWomen', gender: 'FEMALE', genderPreference: 'WOMEN' });
    await player({ name: 'Man', gender: 'MALE', genderPreference: 'ALL' });

    expect(names(await feed(me)).sort()).toEqual(['WomanOpen', 'WomanWantsMen']);
  });

  it('still works without a location, hiding the distance', async () => {
    const me = await player({ name: 'Me', location: null });
    await player({ name: 'Somewhere', location: far });
    const items = await feed(me);
    expect(names(items)).toEqual(['Somewhere']);
    expect(items[0]!.distanceKm).toBeNull();
  });

  it('rejects an inverted age range and an out-of-range limit', async () => {
    const me = await player({ name: 'Me' });
    expect((await api().get('/v1/discover?ageMin=40&ageMax=30').set(auth(me.token))).status).toBe(400);
    expect((await api().get('/v1/discover?limit=500').set(auth(me.token))).status).toBe(400);
  });
});

describe('POST /swipes', () => {
  it('does not match on a pass or a one-sided like', async () => {
    const a = await player({ name: 'A' });
    const b = await player({ name: 'B' });

    const pass = await swipe(a, b.id, 'PASS');
    expect(pass.status).toBe(200);
    expect(pass.body).toMatchObject({ isMatch: false, matchId: null, partner: { id: b.id, name: 'B' } });

    const like = await swipe(b, a.id, 'LIKE'); // A passed on B earlier, so this cannot match
    expect(like.body.isMatch).toBe(false);
    expect(await prisma.match.count()).toBe(0);
  });

  it('matches when both like, whoever goes second, and reports it once', async () => {
    const a = await player({ name: 'A' });
    const b = await player({ name: 'B' });

    expect((await swipe(a, b.id, 'LIKE')).body.isMatch).toBe(false);
    const second = await swipe(b, a.id, 'SUPER');
    expect(second.body).toMatchObject({ isMatch: true, partner: { id: a.id, name: 'A' } });
    expect(second.body.matchId).toEqual(expect.any(String));
    expect(await prisma.match.count()).toBe(1);

    // Swiping again (a retry) keeps the same match instead of creating another.
    const again = await swipe(b, a.id, 'LIKE');
    expect(again.body.matchId).toBe(second.body.matchId);
    expect(await prisma.match.count()).toBe(1);
  });

  it('lets someone change a pass into a like', async () => {
    const a = await player({ name: 'A' });
    const b = await player({ name: 'B' });
    await swipe(b, a.id, 'LIKE');
    await swipe(a, b.id, 'PASS');
    expect((await swipe(a, b.id, 'LIKE')).body.isMatch).toBe(true);
  });

  it('creates exactly one match per pair when both people like each other at the same moment', async () => {
    // Many pairs at once: a single pair rarely hits the race, a dozen of them do.
    const PAIRS = 12;
    const pairs = await Promise.all(
      Array.from({ length: PAIRS }, async (_, i) => [await player({ name: `A${i}` }), await player({ name: `B${i}` })] as const),
    );
    const results = await Promise.all(pairs.flatMap(([a, b]) => [swipe(a, b.id, 'LIKE'), swipe(b, a.id, 'LIKE')]));
    expect(results.every((r) => r.status === 200)).toBe(true);
    for (let i = 0; i < PAIRS; i++) {
      // Whoever commits second sees the other's like; the first one cannot.
      expect([results[2 * i]!.body.isMatch, results[2 * i + 1]!.body.isMatch].filter(Boolean)).toHaveLength(1);
    }
    expect(await prisma.match.count()).toBe(PAIRS);
  }, 60_000);

  it('removes matched people from the feed', async () => {
    const a = await player({ name: 'A' });
    const b = await player({ name: 'B' });
    await swipe(a, b.id, 'LIKE');
    await swipe(b, a.id, 'LIKE');
    expect(await feed(a)).toEqual([]);
    expect(await feed(b)).toEqual([]);
  });

  it('refuses yourself, unknown players, blocked players and bad input', async () => {
    const a = await player({ name: 'A' });
    const b = await player({ name: 'B' });
    const c = await player({ name: 'C' });
    await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });

    expect((await swipe(a, a.id, 'LIKE')).status).toBe(400);
    expect((await swipe(a, '3f2c2f5e-8b4e-4a43-9d3e-0c1d2e3f4a5b', 'LIKE')).status).toBe(404);
    expect((await swipe(a, b.id, 'LIKE')).status).toBe(404);
    expect((await swipe(a, c.id, 'MAYBE' as never)).status).toBe(400);
    expect((await api().post('/v1/swipes').set(auth(a.token)).send({ targetId: 'nope', action: 'LIKE' })).status).toBe(400);
    expect((await api().post('/v1/swipes').send({ targetId: c.id, action: 'LIKE' })).status).toBe(401);
  });

  it('needs a finished onboarding', async () => {
    const fresh = await registerUser();
    const b = await player({ name: 'B' });
    const res = await api().post('/v1/swipes').set(auth(fresh.accessToken)).send({ targetId: b.id, action: 'LIKE' });
    expect(res.status).toBe(403);
  });
});

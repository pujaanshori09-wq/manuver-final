import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pruneExpired } from '../src/lib/housekeeping.js';
import { prisma } from '../src/lib/prisma.js';
import { hashToken } from '../src/lib/tokens.js';
import { accountForGoogle } from '../src/modules/auth/auth.service.js';
import { checkSwipePatterns, LIMITS, startOfDayWib, startOfWeekWib } from '../src/modules/discover/quota.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function player(name: string, location?: { latitude: number; longitude: number }) {
  const reg = await registerUser();
  const res = await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({
      name,
      birthDate: '1998-01-01',
      gender: 'OTHER',
      language: 'EN',
      sports: [{ sportId: 'badminton' }],
      acceptTerms: true,
      ...(location ? { location } : {}),
    });
  if (res.status !== 200) throw new Error(`onboarding failed: ${res.status}`);
  return { id: reg.user.id, token: reg.accessToken, email: reg.email, password: reg.password };
}
type P = Awaited<ReturnType<typeof player>>;

const swipe = (p: P, targetId: string, action: 'LIKE' | 'PASS' | 'SUPER') =>
  api().post('/v1/swipes').set(auth(p.token)).send({ targetId, action });

/** Pretends `p` already swiped `n` times, at the given moments (ms ago, newest last). */
async function pastSwipes(p: P, action: 'LIKE' | 'PASS' | 'SUPER', msAgo: number[]) {
  await prisma.swipeEvent.createMany({
    data: msAgo.map((ms) => ({ userId: p.id, action, createdAt: new Date(Date.now() - ms) })),
  });
}
/** n moments spread unevenly over the last `spanMs`, so they never look scripted. */
const spread = (n: number, spanMs: number, minMs = 0) =>
  Array.from({ length: n }, (_, i) => minMs + Math.floor(((i + Math.random() * 0.9) / n) * (spanMs - minMs)));

const minutesIntoToday = () => Date.now() - startOfDayWib().getTime();

describe('days and weeks in WIB', () => {
  it('starts the day at 00:00 Jakarta time and the week on Monday', () => {
    expect(startOfDayWib(new Date('2026-11-19T16:59:00Z')).toISOString()).toBe('2026-11-18T17:00:00.000Z'); // 23:59 WIB
    expect(startOfDayWib(new Date('2026-11-19T17:00:00Z')).toISOString()).toBe('2026-11-19T17:00:00.000Z'); // 00:00 WIB Friday
    // Thursday 19 Nov → Monday 16 Nov 00:00 WIB
    expect(startOfWeekWib(new Date('2026-11-19T05:00:00Z')).toISOString()).toBe('2026-11-15T17:00:00.000Z');
    // Sunday 23:30 WIB still belongs to the week that started on Monday 16 Nov
    expect(startOfWeekWib(new Date('2026-11-22T16:30:00Z')).toISOString()).toBe('2026-11-15T17:00:00.000Z');
  });
});

describe('free plan', () => {
  it('gets 20 Likes a day; Skip stays free; the app learns what is left', async () => {
    const [me, a, b] = [await player('Me'), await player('A'), await player('B')];
    const feed = await api().get('/v1/discover').set(auth(me.token));
    expect(feed.body.quota).toMatchObject({ premium: false, likesLeft: 20, superLeft: 1 });

    await pastSwipes(me, 'LIKE', spread(LIMITS.freeLikesPerDay - 1, Math.min(minutesIntoToday(), 3600_000), 61_000));
    const last = await swipe(me, a.id, 'LIKE');
    expect(last.status).toBe(200);
    expect(last.body.quota.likesLeft).toBe(0);

    const over = await swipe(me, b.id, 'LIKE');
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('swipe_limit_reached');
    expect(over.body.error.details.kind).toBe('like');
    expect(new Date(over.body.error.details.resetsAt).getTime()).toBe(startOfDayWib().getTime() + 86_400_000);

    expect((await swipe(me, b.id, 'PASS')).status).toBe(200);
  });

  it("does not count yesterday's Likes", async () => {
    const [me, a] = [await player('Me'), await player('A')];
    const beforeToday = minutesIntoToday() + 60_000;
    await pastSwipes(me, 'LIKE', Array.from({ length: 20 }, (_, i) => beforeToday + i * 7_000));
    expect((await swipe(me, a.id, 'LIKE')).status).toBe(200);
  });

  it('gets 1 Super Like a week, apart from the daily Likes', async () => {
    const [me, a, b, c] = [await player('Me'), await player('A'), await player('B'), await player('C')];
    const sup = await swipe(me, a.id, 'SUPER');
    expect(sup.status).toBe(200);
    expect(sup.body.quota).toMatchObject({ superLeft: 0, likesLeft: 20 });

    const second = await swipe(me, b.id, 'SUPER');
    expect(second.status).toBe(429);
    expect(second.body.error.details.kind).toBe('super');
    expect(new Date(second.body.error.details.resetsAt).getTime()).toBe(startOfWeekWib().getTime() + 7 * 86_400_000);

    expect((await swipe(me, c.id, 'LIKE')).status).toBe(200);
  });

  it('does not charge twice for a retried swipe', async () => {
    const [me, a] = [await player('Me'), await player('A')];
    const first = await swipe(me, a.id, 'LIKE');
    const retry = await swipe(me, a.id, 'LIKE');
    expect(retry.status).toBe(200);
    expect(retry.body.quota.likesLeft).toBe(first.body.quota.likesLeft);
    expect(await prisma.swipeEvent.count({ where: { userId: me.id } })).toBe(1);
  });

  it('holds when two Likes race for the last one', async () => {
    const [me, a, b] = [await player('Me'), await player('A'), await player('B')];
    await pastSwipes(me, 'LIKE', spread(LIMITS.freeLikesPerDay - 1, Math.min(minutesIntoToday(), 3600_000), 61_000));
    const results = await Promise.all([swipe(me, a.id, 'LIKE'), swipe(me, b.id, 'LIKE')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 429]);
  });
});

describe('premium', () => {
  it('has unlimited Likes and 5 Super Likes a week', async () => {
    const [me, a, b] = [await player('Me'), await player('A'), await player('B')];
    await prisma.user.update({ where: { id: me.id }, data: { premiumUntil: new Date(Date.now() + 30 * 86_400_000) } });
    await pastSwipes(me, 'LIKE', spread(150, Math.min(minutesIntoToday(), 3600_000), 61_000));
    await pastSwipes(me, 'SUPER', [70_000, 80_000, 90_000, 100_000]);

    const like = await swipe(me, a.id, 'LIKE');
    expect(like.status).toBe(200);
    expect(like.body.quota).toMatchObject({ premium: true, likesLeft: null, superLeft: 1 });
    expect((await swipe(me, b.id, 'SUPER')).status).toBe(200);
    const sixth = await swipe(me, a.id, 'SUPER');
    expect(sixth.status).toBe(429);
  });

  it('ends when premiumUntil passes', async () => {
    const [me, a] = [await player('Me'), await player('A')];
    await prisma.user.update({ where: { id: me.id }, data: { premiumUntil: new Date(Date.now() - 1000) } });
    await pastSwipes(me, 'LIKE', spread(20, Math.min(minutesIntoToday(), 3600_000), 61_000));
    expect((await swipe(me, a.id, 'LIKE')).status).toBe(429);
  });
});

describe('speed limits and bots', () => {
  it('allows 60 swipes a minute and 500 an hour, Skips included', async () => {
    const [me, a] = [await player('Me'), await player('A')];
    await pastSwipes(me, 'PASS', spread(60, 55_000));
    const fast = await swipe(me, a.id, 'PASS');
    expect(fast.status).toBe(429);
    expect(fast.body.error.code).toBe('swipe_rate_limited');

    const [you, b] = [await player('You'), await player('B')];
    await pastSwipes(you, 'PASS', spread(500, 3_500_000, 70_000));
    const hourly = await swipe(you, b.id, 'PASS');
    expect(hourly.status).toBe(429);
    expect(hourly.body.error.code).toBe('swipe_rate_limited');
    expect(new Date(hourly.body.error.details.resetsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('flags (never blocks) an account that keeps hitting the limits, and hides it from Discover', async () => {
    const [me, a, other] = [await player('Me'), await player('A'), await player('Other')];
    await pastSwipes(me, 'PASS', spread(60, 55_000));
    for (let i = 0; i < 3; i++) expect((await swipe(me, a.id, 'PASS')).status).toBe(429);

    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: me.id } });
    expect(profile.flaggedForReview).toBe(true);
    const events = await prisma.abuseEvent.findMany({ where: { userId: me.id }, orderBy: { createdAt: 'asc' } });
    expect(events.map((e) => e.kind)).toEqual(['RATE_LIMIT_HIT', 'RATE_LIMIT_HIT', 'RATE_LIMIT_HIT', 'FLAGGED']);

    // Still signed in and working, just out of everyone's feed.
    expect((await api().get('/v1/me').set(auth(me.token))).status).toBe(200);
    const feed = await api().get('/v1/discover').set(auth(other.token));
    expect(feed.body.items.map((i: { name: string }) => i.name)).not.toContain('Me');
  });

  it('flags swipes spaced like a script, and liking nearly everyone', async () => {
    const [bot, liker, human] = [await player('Bot'), await player('Liker'), await player('Human')];
    await pastSwipes(bot, 'PASS', Array.from({ length: 50 }, (_, i) => 200_000 - i * 2000));
    await prisma.$transaction((tx) => checkSwipePatterns(tx, bot.id));

    await pastSwipes(liker, 'LIKE', spread(200, 80_000_000));
    await prisma.$transaction((tx) => checkSwipePatterns(tx, liker.id));

    await pastSwipes(human, 'LIKE', spread(120, 80_000_000));
    await pastSwipes(human, 'PASS', spread(80, 80_000_000));
    await prisma.$transaction((tx) => checkSwipePatterns(tx, human.id));

    const flagged = await prisma.profile.findMany({ where: { flaggedForReview: true }, select: { name: true } });
    expect(flagged.map((p) => p.name).sort()).toEqual(['Bot', 'Liker']);
    const reasons = await prisma.abuseEvent.findMany({ where: { kind: 'FLAGGED' }, select: { reason: true } });
    expect(reasons.map((r) => r.reason).join(' ')).toMatch(/evenly spaced.*|liked 200 of the last 200/);
  });

  it('flags the same long message sent to five matches, but not a short greeting', async () => {
    const me = await player('Me');
    const others = await Promise.all([1, 2, 3, 4, 5].map((i) => player(`P${i}`)));
    await prisma.user.update({ where: { id: me.id }, data: { premiumUntil: new Date(Date.now() + 86_400_000) } });
    const matchIds: string[] = [];
    for (const o of others) {
      await swipe(me, o.id, 'LIKE');
      matchIds.push((await swipe(o, me.id, 'LIKE')).body.matchId);
    }
    const say = (matchId: string, content: string) =>
      api().post(`/v1/matches/${matchId}/messages`).set(auth(me.token)).send({ clientId: randomUUID(), type: 'TEXT', content });

    for (const id of matchIds) await say(id, 'Halo!');
    expect((await prisma.profile.findUniqueOrThrow({ where: { userId: me.id } })).flaggedForReview).toBe(false);

    for (const id of matchIds) expect((await say(id, 'Cek promo raket murah di link bio aku ya kak')).status).toBe(201);
    expect((await prisma.profile.findUniqueOrThrow({ where: { userId: me.id } })).flaggedForReview).toBe(true);
  });
});

describe('Google sign-in on an existing email', () => {
  const google = (email: string, sub = randomUUID()) => accountForGoogle({ sub, email, email_verified: true } as never);

  it('takes the password away from an account that never proved the email (someone may have squatted it)', async () => {
    const squatter = await registerUser();
    const linked = await google(squatter.email);
    expect(linked.id).toBe(squatter.user.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: squatter.user.id } });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerified).toBe(true);
    const login = await api().post('/v1/auth/login').send({ email: squatter.email, password: squatter.password });
    expect(login.status).toBe(401);
    const refresh = await api().post('/v1/auth/refresh').send({ refreshToken: squatter.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('keeps the password of a verified account', async () => {
    const owner = await registerUser();
    await prisma.user.update({ where: { id: owner.user.id }, data: { emailVerified: true } });
    await google(owner.email);
    const login = await api().post('/v1/auth/login').send({ email: owner.email, password: owner.password });
    expect(login.status).toBe(200);
  });
});

describe('location privacy', () => {
  it('stores a coarse point and takes a new one at most every 5 minutes', async () => {
    const me = await player('Me', { latitude: -6.22973, longitude: 106.80912 });
    const stored = () => prisma.profile.findUniqueOrThrow({ where: { userId: me.id }, select: { latitude: true, longitude: true } });
    const first = await stored();
    expect(first.latitude).toBeCloseTo(-6.23, 6);
    expect(first.longitude).toBeCloseTo(106.81, 6);

    const put = await api().put('/v1/me/location').set(auth(me.token)).send({ latitude: -6.9175, longitude: 107.6191 });
    expect(put.status).toBe(204); // accepted, but too soon to move
    expect(await stored()).toEqual(first);

    await prisma.profile.update({ where: { userId: me.id }, data: { locationUpdatedAt: new Date(Date.now() - 6 * 60_000) } });
    await api().put('/v1/me/location').set(auth(me.token)).send({ latitude: -6.9175, longitude: 107.6191 });
    const moved = await stored();
    expect(moved.latitude).toBeCloseTo(-6.915, 6); // -6.9175 sits halfway between grid lines
    expect(moved.longitude).toBeCloseTo(107.62, 6);
  });
});

describe('housekeeping', () => {
  it('keeps reports after either account is deleted', async () => {
    const [reporter, reported] = [await player('R'), await player('X')];
    const report = await prisma.report.create({
      data: { reporterId: reporter.id, reportedId: reported.id, reportedEmail: reported.email, reason: 'spam' },
    });
    await api().delete('/v1/me').set(auth(reported.token));
    await api().delete('/v1/me').set(auth(reporter.token));
    const kept = await prisma.report.findUniqueOrThrow({ where: { id: report.id } });
    expect(kept).toMatchObject({ reporterId: null, reportedId: null, reportedEmail: reported.email, status: 'OPEN' });
  });

  it('prunes expired tokens and old swipe history', async () => {
    const me = await player('Me');
    const old = new Date(Date.now() - 40 * 86_400_000);
    await prisma.refreshToken.create({
      data: { userId: me.id, familyId: randomUUID(), tokenHash: hashToken('old-token-xxxxxxxxxxxxxxxx'), expiresAt: old },
    });
    await prisma.swipeEvent.create({ data: { userId: me.id, action: 'PASS', createdAt: old } });
    const n = await pruneExpired();
    expect(n.tokens).toBe(1);
    expect(n.swipes).toBe(1);
    expect(await prisma.refreshToken.count({ where: { userId: me.id } })).toBe(1); // the live session stays
  });

  it('records when someone was last active', async () => {
    const long = new Date(Date.now() - 86_400_000);
    // touchActive writes at most once per 5 minutes per process; this user is new to it.
    const fresh = await registerUser();
    await prisma.profile.update({ where: { userId: fresh.user.id }, data: { lastActiveAt: long } });
    await api().get('/v1/me').set(auth(fresh.accessToken));
    await expect
      .poll(async () => (await prisma.profile.findUniqueOrThrow({ where: { userId: fresh.user.id } })).lastActiveAt.getTime())
      .toBeGreaterThan(long.getTime());
  });
});

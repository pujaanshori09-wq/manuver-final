import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { testOutbox } from '../src/lib/push.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(async () => {
  await resetDb();
  testOutbox.length = 0;
});
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function player(name: string, language = 'EN') {
  const reg = await registerUser();
  const res = await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({ name, birthDate: '1998-01-01', gender: 'OTHER', language, sports: [{ sportId: 'badminton' }], acceptTerms: true });
  if (res.status !== 200) throw new Error(`onboarding failed: ${res.status}`);
  return { id: reg.user.id, token: reg.accessToken, email: reg.email };
}
type P = Awaited<ReturnType<typeof player>>;

const swipe = (p: P, targetId: string) => api().post('/v1/swipes').set(auth(p.token)).send({ targetId, action: 'LIKE' });
async function matched(a: P, b: P) {
  await swipe(a, b.id);
  return (await swipe(b, a.id)).body.matchId as string;
}
const say = (p: P, matchId: string, body: Record<string, unknown>) =>
  api().post(`/v1/matches/${matchId}/messages`).set(auth(p.token)).send({ clientId: randomUUID(), ...body });
const phone = (p: P, n = 1) => api().put('/v1/me/push-token').set(auth(p.token)).send({ token: `ExponentPushToken[${p.id.slice(0, 8)}phone${n}]` });

describe('blocking', () => {
  it('hides both people from each other until unblocked', async () => {
    const [me, them, other] = [await player('Me'), await player('Them'), await player('Other')];
    const matchId = await matched(me, them);

    const block = await api().post('/v1/blocks').set(auth(me.token)).send({ userId: them.id });
    expect(block.status).toBe(204);
    expect((await api().post('/v1/blocks').set(auth(me.token)).send({ userId: them.id })).status).toBe(204); // twice is fine

    // Gone from chats, profile and messages, in both directions.
    expect((await api().get('/v1/matches').set(auth(me.token))).body).toEqual([]);
    expect((await api().get('/v1/matches').set(auth(them.token))).body).toEqual([]);
    expect((await api().get(`/v1/users/${them.id}`).set(auth(me.token))).status).toBe(404);
    expect((await say(them, matchId, { type: 'TEXT', content: 'hello?' })).status).toBe(404);
    // Out of Discover for the blocked person; the other player is unaffected.
    const feed = await api().get('/v1/discover').set(auth(them.token));
    expect(feed.body.items.map((i: { name: string }) => i.name)).toEqual(['Other']);

    const list = await api().get('/v1/blocks').set(auth(me.token));
    expect(list.body).toEqual([expect.objectContaining({ id: them.id, name: 'Them', photoUrl: null })]);

    expect((await api().delete(`/v1/blocks/${them.id}`).set(auth(me.token))).status).toBe(204);
    const chats = await api().get('/v1/matches').set(auth(me.token));
    expect(chats.body.map((c: { id: string }) => c.id)).toEqual([matchId]); // the chat comes back as it was
    void other;
  });

  it('refuses yourself, unknown players and bad input', async () => {
    const me = await player('Me');
    expect((await api().post('/v1/blocks').set(auth(me.token)).send({ userId: me.id })).status).toBe(400);
    expect((await api().post('/v1/blocks').set(auth(me.token)).send({ userId: randomUUID() })).status).toBe(404);
    expect((await api().post('/v1/blocks').set(auth(me.token)).send({ userId: 'nope' })).status).toBe(400);
    expect((await api().post('/v1/blocks').send({ userId: me.id })).status).toBe(401);
  });
});

describe('reporting', () => {
  it('files a report with the reason and remembers the email, once a day per player', async () => {
    const [me, them] = [await player('Me'), await player('Them')];
    const first = await api().post('/v1/reports').set(auth(me.token)).send({ userId: them.id, reason: 'SPAM', details: 'Sends links' });
    expect(first.status).toBe(201);
    const again = await api().post('/v1/reports').set(auth(me.token)).send({ userId: them.id, reason: 'RUDE' });
    expect(again.body.id).toBe(first.body.id);

    const rows = await prisma.report.findMany();
    expect(rows).toEqual([
      expect.objectContaining({ reporterId: me.id, reportedId: them.id, reportedEmail: them.email, reason: 'SPAM', details: 'Sends links', status: 'OPEN' }),
    ]);
  });

  it('refuses yourself, unknown players and unknown reasons', async () => {
    const [me, them] = [await player('Me'), await player('Them')];
    expect((await api().post('/v1/reports').set(auth(me.token)).send({ userId: me.id, reason: 'SPAM' })).status).toBe(400);
    expect((await api().post('/v1/reports').set(auth(me.token)).send({ userId: randomUUID(), reason: 'SPAM' })).status).toBe(404);
    expect((await api().post('/v1/reports').set(auth(me.token)).send({ userId: them.id, reason: 'MEAN' })).status).toBe(400);
  });
});

describe('push tokens', () => {
  it('accepts only Expo tokens, moves a phone to whoever signs in on it, and forgets it on sign-out', async () => {
    const [a, b] = [await player('A'), await player('B')];
    expect((await api().put('/v1/me/push-token').set(auth(a.token)).send({ token: 'hello' })).status).toBe(400);

    const token = 'ExponentPushToken[sharedphone123]';
    await api().put('/v1/me/push-token').set(auth(a.token)).send({ token });
    await api().put('/v1/me/push-token').set(auth(b.token)).send({ token });
    expect(await prisma.pushToken.findMany({ select: { userId: true } })).toEqual([{ userId: b.id }]);

    // Someone else cannot remove it.
    await api().delete('/v1/me/push-token').set(auth(a.token)).send({ token });
    expect(await prisma.pushToken.count()).toBe(1);
    await api().delete('/v1/me/push-token').set(auth(b.token)).send({ token });
    expect(await prisma.pushToken.count()).toBe(0);
  });
});

describe('push notifications (sent by the server)', () => {
  it('tells the other person about a new match, in their language, once', async () => {
    const [me, rina] = [await player('Budi'), await player('Rina', 'ID')];
    await phone(rina);
    await phone(me);
    await swipe(rina, me.id);
    const res = await swipe(me, rina.id);
    expect(res.body.isMatch).toBe(true);

    await expect.poll(() => testOutbox.length).toBe(1);
    expect(testOutbox[0]).toEqual({
      userId: rina.id,
      title: 'Kamu match!',
      body: 'Kamu dan Budi sama-sama mau olahraga bareng. Sapa duluan!',
      data: { type: 'match', matchId: res.body.matchId },
    });

    await swipe(me, rina.id); // a retried like does not announce the match again
    await new Promise((r) => setTimeout(r, 100));
    expect(testOutbox).toHaveLength(1);
  });

  it('sends messages, sparing invites and the answer to the other person', async () => {
    const [budi, rina] = [await player('Budi'), await player('Rina', 'ID')];
    const matchId = await matched(budi, rina);
    await phone(budi);
    await phone(rina);
    testOutbox.length = 0;

    await say(budi, matchId, { type: 'TEXT', content: 'Main jam 7?' });
    await expect.poll(() => testOutbox.length).toBe(1);
    expect(testOutbox[0]).toMatchObject({ userId: rina.id, title: 'Budi', body: 'Main jam 7?', data: { type: 'message', matchId } });

    const invite = await say(budi, matchId, {
      type: 'SPARING_INVITE',
      content: 'Sparing badminton',
      invite: { sport: 'badminton', venueName: 'GOR', scheduledAt: '2026-12-01T10:00:00.000Z' },
    });
    await expect.poll(() => testOutbox.length).toBe(2);
    expect(testOutbox[1]).toMatchObject({ userId: rina.id, body: 'Budi ngajak kamu sparing badminton' });

    await api().post(`/v1/messages/${invite.body.id}/respond`).set(auth(rina.token)).send({ status: 'ACCEPTED' });
    await expect.poll(() => testOutbox.length).toBe(3);
    expect(testOutbox[2]).toMatchObject({ userId: budi.id, title: 'Rina', body: 'Rina accepted your badminton invite' });
  });

  it('shortens long messages and stays quiet for people without a phone token', async () => {
    const [budi, rina] = [await player('Budi'), await player('Rina')];
    const matchId = await matched(budi, rina);
    await say(budi, matchId, { type: 'TEXT', content: 'no token yet' });
    await new Promise((r) => setTimeout(r, 100));
    expect(testOutbox).toHaveLength(0);

    await phone(rina);
    await say(budi, matchId, { type: 'TEXT', content: 'x'.repeat(300) });
    await expect.poll(() => testOutbox.length).toBe(1);
    expect(testOutbox[0]!.body).toHaveLength(118);
    expect(testOutbox[0]!.body.endsWith('…')).toBe(true);
  });
});

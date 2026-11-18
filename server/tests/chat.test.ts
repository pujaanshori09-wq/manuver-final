import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function player(name: string) {
  const reg = await registerUser();
  const res = await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({
      name,
      birthDate: '1998-01-01',
      gender: 'OTHER',
      genderPreference: 'ALL',
      ageMin: 18,
      ageMax: 60,
      language: 'EN',
      sports: [{ sportId: 'badminton' }],
      acceptTerms: true,
    });
  if (res.status !== 200) throw new Error(`onboarding failed: ${res.status}`);
  return { id: reg.user.id, token: reg.accessToken };
}
type P = Awaited<ReturnType<typeof player>>;

/** Two players who liked each other; returns the match id. */
async function matched(a: P, b: P) {
  await api().post('/v1/swipes').set(auth(a.token)).send({ targetId: b.id, action: 'LIKE' });
  const res = await api().post('/v1/swipes').set(auth(b.token)).send({ targetId: a.id, action: 'LIKE' });
  return res.body.matchId as string;
}

const send = (p: P, matchId: string, body: Record<string, unknown>) =>
  api().post(`/v1/matches/${matchId}/messages`).set(auth(p.token)).send({ clientId: randomUUID(), ...body });
const text = (p: P, matchId: string, content: string) => send(p, matchId, { type: 'TEXT', content });
const history = (p: P, matchId: string) => api().get(`/v1/matches/${matchId}/messages`).set(auth(p.token));
const chats = (p: P) => api().get('/v1/matches').set(auth(p.token));

const invite = {
  type: 'SPARING_INVITE',
  content: 'Sparing badminton @ GOR Saparua',
  invite: { sport: 'badminton', venueName: 'GOR Saparua', scheduledAt: '2026-12-01T10:00:00.000Z', note: null },
};

describe('chat list', () => {
  it('lists matches newest activity first, with the last message and unread count', async () => {
    const [a, b, c] = [await player('A'), await player('B'), await player('C')];
    const ab = await matched(a, b);
    const ac = await matched(a, c);

    await text(b, ab, 'Halo A!');
    await text(b, ab, 'Main besok?');

    const res = await chats(a);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { partner: { name: string } }) => m.partner.name)).toEqual(['B', 'C']);
    expect(res.body[0]).toMatchObject({ id: ab, lastMessage: { content: 'Main besok?', type: 'TEXT' }, unreadCount: 2 });
    expect(res.body[1]).toMatchObject({ id: ac, lastMessage: null, unreadCount: 0 });
    expect(JSON.stringify(res.body)).not.toMatch(/email|birthDate|latitude/);

    // Opening the chat marks it read.
    await history(a, ab);
    expect((await chats(a)).body[0].unreadCount).toBe(0);
  });

  it('hides chats with blocked players and needs a token', async () => {
    const [a, b] = [await player('A'), await player('B')];
    const ab = await matched(a, b);
    await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });
    expect((await chats(a)).body).toEqual([]);
    expect((await history(a, ab)).status).toBe(404);
    expect((await text(a, ab, 'hi')).status).toBe(404);
    expect((await api().get('/v1/matches')).status).toBe(401);
  });
});

describe('messages', () => {
  it('sends and reads messages in order', async () => {
    const [a, b] = [await player('A'), await player('B')];
    const ab = await matched(a, b);
    expect((await text(a, ab, '  Halo  ')).status).toBe(201);
    await text(b, ab, 'Hai juga');

    const res = await history(b, ab);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { content: string; senderId: string }) => [m.content, m.senderId])).toEqual([
      ['Halo', a.id],
      ['Hai juga', b.id],
    ]);
  });

  it('never duplicates a retried send', async () => {
    const [a, b] = [await player('A'), await player('B')];
    const ab = await matched(a, b);
    const body = { type: 'TEXT', content: 'once', clientId: randomUUID() };
    const post = () => api().post(`/v1/matches/${ab}/messages`).set(auth(a.token)).send(body);

    const [r1, r2] = await Promise.all([post(), post()]);
    const r3 = await post();
    expect([r1.status, r2.status, r3.status]).toEqual([201, 201, 201]);
    expect(new Set([r1.body.id, r2.body.id, r3.body.id]).size).toBe(1);
    expect(await prisma.message.count()).toBe(1);
  });

  it('keeps strangers out and rejects bad input', async () => {
    const [a, b, stranger] = [await player('A'), await player('B'), await player('S')];
    const ab = await matched(a, b);
    expect((await history(stranger, ab)).status).toBe(404);
    expect((await text(stranger, ab, 'hi')).status).toBe(404);
    expect((await text(a, ab, '   ')).status).toBe(400);
    expect((await text(a, ab, 'x'.repeat(2001))).status).toBe(400);
    expect((await send(a, ab, { type: 'TEXT', content: 'hi', clientId: 'nope' })).status).toBe(400);
    expect((await history(a, 'not-a-uuid')).status).toBe(400);
    expect((await history(a, randomUUID())).status).toBe(404);
  });
});

describe('sparing invites', () => {
  it('lets only the other player accept, once', async () => {
    const [a, b] = [await player('A'), await player('B')];
    const ab = await matched(a, b);
    const sent = await send(a, ab, invite);
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({ type: 'SPARING_INVITE', inviteStatus: 'PENDING', invite: { venueName: 'GOR Saparua' } });

    const respond = (p: P, status: string) =>
      api().post(`/v1/messages/${sent.body.id}/respond`).set(auth(p.token)).send({ status });

    expect((await respond(a, 'ACCEPTED')).status).toBe(403);
    const ok = await respond(b, 'ACCEPTED');
    expect(ok.status).toBe(200);
    expect(ok.body.inviteStatus).toBe('ACCEPTED');
    expect((await respond(b, 'DECLINED')).status).toBe(409);
  });

  it('refuses answering a text, a stranger answering, and an invite without details', async () => {
    const [a, b, stranger] = [await player('A'), await player('B'), await player('S')];
    const ab = await matched(a, b);
    const msg = await text(a, ab, 'hi');
    const inv = await send(a, ab, invite);

    expect((await api().post(`/v1/messages/${msg.body.id}/respond`).set(auth(b.token)).send({ status: 'ACCEPTED' })).status).toBe(400);
    expect((await api().post(`/v1/messages/${inv.body.id}/respond`).set(auth(stranger.token)).send({ status: 'ACCEPTED' })).status).toBe(404);
    expect((await send(a, ab, { type: 'SPARING_INVITE', content: 'x' })).status).toBe(400);
  });
});

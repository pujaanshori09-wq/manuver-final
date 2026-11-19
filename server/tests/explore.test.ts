import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function player(name: string, gender: 'MALE' | 'FEMALE' | 'OTHER' = 'OTHER') {
  const reg = await registerUser();
  const res = await api()
    .post('/v1/me/onboarding')
    .set(auth(reg.accessToken))
    .send({ name, birthDate: '1998-01-01', gender, language: 'EN', sports: [{ sportId: 'badminton' }], acceptTerms: true });
  if (res.status !== 200) throw new Error(`onboarding failed: ${res.status}`);
  return { id: reg.user.id, token: reg.accessToken };
}
type P = Awaited<ReturnType<typeof player>>;

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const as = (p: P) => ({
  get: (url: string) => api().get(url).set(auth(p.token)),
  post: (url: string, body?: object) => api().post(url).set(auth(p.token)).send(body),
  del: (url: string) => api().delete(url).set(auth(p.token)),
});

describe('open sessions', () => {
  const newSession = (p: P, extra: object = {}) =>
    as(p).post('/v1/sessions', {
      sport: 'Badminton',
      title: 'Sparing ganda santai',
      venueName: 'GOR Saparua',
      scheduledAt: inHours(3),
      slotsTotal: 3,
      ...extra,
    });

  it('lists upcoming sessions with the host already in, and fills up', async () => {
    const [host, a, b, c] = [await player('Host'), await player('A'), await player('B'), await player('C')];
    const { body, status } = await newSession(host);
    expect(status).toBe(201);

    const list = await as(a).get('/v1/sessions');
    expect(list.body).toEqual([
      expect.objectContaining({
        id: body.id,
        title: 'Sparing ganda santai',
        slotsTotal: 3,
        slotsFilled: 1,
        status: 'OPEN',
        isJoined: false,
        isMine: false,
        creator: { id: host.id, name: 'Host', photoUrl: null },
      }),
    ]);

    expect((await as(a).post(`/v1/sessions/${body.id}/join`)).status).toBe(204);
    expect((await as(a).post(`/v1/sessions/${body.id}/join`)).status).toBe(204); // twice is fine
    expect((await as(b).post(`/v1/sessions/${body.id}/join`)).status).toBe(204);
    const full = await as(c).post(`/v1/sessions/${body.id}/join`);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('session_full');
    expect((await as(c).get('/v1/sessions')).body[0]).toMatchObject({ status: 'FULL', slotsFilled: 3 });

    // Someone leaves: a spot opens again. The host cannot leave, only cancel.
    expect((await as(b).del(`/v1/sessions/${body.id}/join`)).status).toBe(204);
    expect((await as(c).post(`/v1/sessions/${body.id}/join`)).status).toBe(204);
    expect((await as(host).del(`/v1/sessions/${body.id}/join`)).status).toBe(400);

    expect((await as(a).del(`/v1/sessions/${body.id}`)).status).toBe(404); // not mine
    expect((await as(host).del(`/v1/sessions/${body.id}`)).status).toBe(204);
    expect((await as(a).get('/v1/sessions')).body).toEqual([]);
  });

  it('never overfills when the last spot is taken by two people at once', async () => {
    const host = await player('Host');
    const others = await Promise.all(['A', 'B', 'C', 'D'].map((n) => player(n)));
    const { body } = await newSession(host, { slotsTotal: 2 });
    const results = await Promise.all(others.map((o) => as(o).post(`/v1/sessions/${body.id}/join`)));
    expect(results.filter((r) => r.status === 204)).toHaveLength(1);
    expect(await prisma.sessionParticipant.count({ where: { sessionId: body.id } })).toBe(2);
  });

  it('keeps women-only sessions for women, and filters by sport', async () => {
    const [host, man, woman] = [await player('Host', 'FEMALE'), await player('Man', 'MALE'), await player('Woman', 'FEMALE')];
    const { body } = await newSession(host, { genderPref: 'WOMEN' });
    await newSession(host, { sport: 'Futsal', title: 'Futsal malam' });
    expect((await as(man).post(`/v1/sessions/${body.id}/join`)).status).toBe(403);
    expect((await as(woman).post(`/v1/sessions/${body.id}/join`)).status).toBe(204);
    expect((await as(man).get('/v1/sessions?sport=futsal')).body.map((s: { title: string }) => s.title)).toEqual(['Futsal malam']);
  });

  it('refuses sessions in the past or with bad sizes, and hides blocked hosts', async () => {
    const [host, other] = [await player('Host'), await player('Other')];
    expect((await newSession(host, { scheduledAt: inHours(-1) })).status).toBe(400);
    expect((await newSession(host, { slotsTotal: 1 })).status).toBe(400);
    const { body } = await newSession(host);
    await as(other).post('/v1/blocks', { userId: host.id });
    expect((await as(other).get('/v1/sessions')).body).toEqual([]);
    expect((await as(other).post(`/v1/sessions/${body.id}/join`)).status).toBe(404);
  });
});

describe('SOS', () => {
  const post = (p: P, extra: object = {}) =>
    as(p).post('/v1/sos', { sport: 'Futsal', venueName: 'Lapangan Sabuga', slotsNeeded: 2, feePerPerson: 25000, contactWa: '0812-3456-7890', ...extra });

  it('shows the WhatsApp number only to people who take a spot', async () => {
    const [host, a, b, c] = [await player('Host'), await player('A'), await player('B'), await player('C')];
    const { body, status } = await post(host);
    expect(status).toBe(201);

    const list = await as(a).get('/v1/sos');
    expect(list.body).toEqual([expect.objectContaining({ id: body.id, slotsLeft: 2, slotsNeeded: 2, feePerPerson: 25000, claimedByMe: false })]);
    expect(JSON.stringify(list.body)).not.toContain('0812');

    const claim = await as(a).post(`/v1/sos/${body.id}/claim`);
    expect(claim.status).toBe(200);
    expect(claim.body).toEqual({ contactWa: '081234567890' });

    const again = await as(a).post(`/v1/sos/${body.id}/claim`);
    expect(again.body.error.code).toBe('already_claimed');
    expect((await as(host).post(`/v1/sos/${body.id}/claim`)).body.error.code).toBe('own_slot');

    expect((await as(b).post(`/v1/sos/${body.id}/claim`)).status).toBe(200);
    const late = await as(c).post(`/v1/sos/${body.id}/claim`);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('sos_unavailable');
    expect((await as(c).get('/v1/sos')).body).toEqual([]); // filled: off the board
  });

  it('validates the number, lets the host take it down, and expires after the game', async () => {
    const [host, other] = [await player('Host'), await player('Other')];
    expect((await post(host, { contactWa: '12345' })).status).toBe(400);
    const { body } = await post(host, { contactWa: '+62 812 3456 7890' });
    expect((await as(other).del(`/v1/sos/${body.id}`)).status).toBe(404);
    expect((await as(host).del(`/v1/sos/${body.id}`)).status).toBe(204);
    expect((await as(other).get('/v1/sos')).body).toEqual([]);

    const old = await post(host);
    await prisma.emergencySlot.update({ where: { id: old.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await as(other).get('/v1/sos')).body).toEqual([]);
    expect((await as(other).post(`/v1/sos/${old.body.id}/claim`)).status).toBe(409);
  });
});

describe('events', () => {
  const newEvent = (p: P, extra: object = {}) =>
    as(p).post('/v1/events', {
      title: 'Bandung Night Run 10K',
      organizer: 'Komunitas Lari Bandung',
      type: 'Fun Run',
      category: 'Running',
      startsAt: inHours(24 * 10),
      location: 'Gedung Sate',
      city: 'Bandung',
      priceIdr: 150000,
      quota: 2,
      ...extra,
    });

  it('waits for approval: only the creator sees it until then', async () => {
    const [creator, other] = [await player('Creator'), await player('Other')];
    const { body, status } = await newEvent(creator);
    expect(status).toBe(201);
    expect(body).toMatchObject({ status: 'PENDING', isMine: true, priceIdr: 150000, registrations: 0 });
    expect((await as(creator).get('/v1/events')).body).toHaveLength(1);
    expect((await as(other).get('/v1/events')).body).toEqual([]);
    expect((await as(other).get(`/v1/events/${body.id}`)).status).toBe(404);
    expect((await as(other).post(`/v1/events/${body.id}/register`)).status).toBe(404);

    await prisma.event.update({ where: { id: body.id }, data: { status: 'APPROVED' } }); // in Prisma Studio
    expect((await as(other).get('/v1/events')).body).toEqual([expect.objectContaining({ id: body.id, status: 'APPROVED', isMine: false })]);
  });

  it('takes registrations up to the quota, once per person', async () => {
    const [creator, a, b, c] = [await player('Creator'), await player('A'), await player('B'), await player('C')];
    const { body } = await newEvent(creator);
    await prisma.event.update({ where: { id: body.id }, data: { status: 'APPROVED' } });

    const reg = await as(a).post(`/v1/events/${body.id}/register`);
    expect(reg.body).toMatchObject({ isRegistered: true, registrations: 1 });
    expect((await as(a).post(`/v1/events/${body.id}/register`)).body.registrations).toBe(1);
    await as(b).post(`/v1/events/${body.id}/register`);
    const full = await as(c).post(`/v1/events/${body.id}/register`);
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('event_full');

    const left = await as(a).del(`/v1/events/${body.id}/register`);
    expect(left.body).toMatchObject({ isRegistered: false, registrations: 1 });
    expect((await as(c).post(`/v1/events/${body.id}/register`)).status).toBe(200);
  });

  it('lists featured first then by date, drops past events, and checks input', async () => {
    const creator = await player('Creator');
    const soon = await newEvent(creator, { title: 'Soon', startsAt: inHours(24) });
    const later = await newEvent(creator, { title: 'Later', startsAt: inHours(48) });
    const big = await newEvent(creator, { title: 'Featured', startsAt: inHours(72) });
    await prisma.event.updateMany({ data: { status: 'APPROVED' } });
    await prisma.event.update({ where: { id: big.body.id }, data: { isFeatured: true } });
    await prisma.event.update({ where: { id: later.body.id }, data: { startsAt: new Date(Date.now() - 1000) } });
    void soon;

    const other = await player('Other');
    expect((await as(other).get('/v1/events')).body.map((e: { title: string }) => e.title)).toEqual(['Featured', 'Soon']);

    expect((await newEvent(creator, { startsAt: inHours(-2) })).status).toBe(400);
    expect((await newEvent(creator, { imageUrl: 'http://insecure.example/a.jpg' })).status).toBe(400);
    expect((await as(other).get(`/v1/events/${randomUUID()}`)).status).toBe(404);
  });
});

import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { encode, privacyTrim, routeLength, type LatLng } from '../src/lib/polyline.js';
import { prisma } from '../src/lib/prisma.js';
import { checkSpeeds, speedProfile } from '../src/modules/activities/speed.js';
import { api, registerUser, resetDb } from './helpers.js';

const M_LAT = 1 / 111_195; // degrees of latitude per metre

/** A straight line north, a point every 2 s, built from stretches at given speeds. */
function track(stretches: { kmh: number; sec: number }[]) {
  const points: LatLng[] = [[-6.9, 107.6]];
  const times = [0];
  let m = 0;
  let t = 0;
  for (const { kmh, sec } of stretches) {
    for (let s = 2; s <= sec; s += 2) {
      m += (kmh / 3.6) * 2;
      t += 2;
      points.push([-6.9 + m * M_LAT, 107.6]);
      times.push(t);
    }
  }
  return { points, times, distanceM: Math.round(m), movingSec: t };
}

const check = (type: 'RUN' | 'HIKE' | 'RIDE', tr: ReturnType<typeof track>, segmentStarts: number[] = []) =>
  checkSpeeds({ type, ...tr, segmentStarts });

describe('speed profile', () => {
  it('follows the pace along the route and ignores pauses', () => {
    const a = track([{ kmh: 10, sec: 600 }]);
    const b = track([{ kmh: 15, sec: 600 }]);
    // b continues from where a ended, after a 5-minute pause.
    const off = a.points[a.points.length - 1]![0] - b.points[0]![0];
    const points = [...a.points, ...b.points.map(([lat, lng]) => [lat + off, lng] as LatLng)];
    const times = [...a.times, ...b.times.map((t) => t + a.movingSec + 300)];
    const p = speedProfile(points, times, [a.points.length])!;
    expect(p.points.length).toBeGreaterThan(30);
    expect(p.points[2]![1]).toBeCloseTo(10, 0);
    expect(p.points[p.points.length - 2]![1]).toBeCloseTo(15, 0);
    expect(p.maxKmh).toBeLessThan(16);
    expect(p.points[p.points.length - 1]![0]).toBeCloseTo(a.distanceM + b.distanceM, -1);
  });

  it('has nothing to say about a tiny route', () => {
    expect(speedProfile([[0, 0], [0.0001, 0]], [0, 5], [])).toBeNull();
  });
});

describe('speed rules', () => {
  it('lets fast but human efforts through', () => {
    expect(check('RUN', track([{ kmh: 20, sec: 900 }]))).toBeNull(); // 3:00/km for 15 min
    expect(check('RUN', track([{ kmh: 10, sec: 300 }, { kmh: 32, sec: 50 }, { kmh: 10, sec: 300 }]))).toBeNull(); // a 400 m sprint
    expect(check('HIKE', track([{ kmh: 6, sec: 1800 }]))).toBeNull();
    expect(check('RIDE', track([{ kmh: 45, sec: 1200 }, { kmh: 75, sec: 60 }]))).toBeNull(); // a fast descent
  });

  it('catches a motorbike stretch inside an otherwise normal run', () => {
    const tr = track([{ kmh: 10, sec: 600 }, { kmh: 50, sec: 120 }, { kmh: 10, sec: 600 }]);
    expect((tr.distanceM / tr.movingSec) * 3.6).toBeLessThan(25); // the average alone looks fine
    expect(check('RUN', tr)).toBe('impossible_speed');
    expect(check('RIDE', tr)).toBeNull(); // the same recording is a believable ride
  });

  it('applies a different rule to each activity type', () => {
    expect(check('HIKE', track([{ kmh: 25, sec: 120 }]))).not.toBeNull();
    expect(check('RUN', track([{ kmh: 25, sec: 120 }]))).toBeNull();
    expect(check('RIDE', track([{ kmh: 100, sec: 120 }]))).not.toBeNull();
  });

  it('rejects an average no human holds', () => {
    // 26 km/h for 20 min passes the 30 s window rule but not the run average.
    expect(check('RUN', track([{ kmh: 26, sec: 1200 }]))).toBe('impossible_average');
  });

  it('ignores the jump between segments (a bus ride while paused)', () => {
    const a = track([{ kmh: 10, sec: 300 }]);
    const b = track([{ kmh: 10, sec: 300 }]);
    const jump = 15_000 * M_LAT; // 15 km further, 10 minutes later
    const points = [...a.points, ...b.points.map(([lat, lng]) => [lat + jump + (a.distanceM * M_LAT), lng] as LatLng)];
    const times = [...a.times, ...b.times.map((t) => t + a.movingSec + 600)];
    const joined = { points, times, distanceM: a.distanceM + b.distanceM, movingSec: a.movingSec + b.movingSec };
    expect(checkSpeeds({ type: 'RUN', ...joined, segmentStarts: [a.points.length] })).toBeNull();
    expect(checkSpeeds({ type: 'RUN', ...joined, segmentStarts: [] })).not.toBeNull();
  });

  it('refuses a distance the route does not show', () => {
    const tr = track([{ kmh: 10, sec: 360 }]); // ~1 km
    // As a ride, 5 km in 6 min passes the average rule, so the route-length check is what fails.
    expect(check('RIDE', { ...tr, distanceM: 5000 })).toBe('distance_mismatch');
  });
});

describe('privacy trim', () => {
  it('cuts 200 m at each end, or 20% when the route is short', () => {
    const line = (meters: number): LatLng[] => Array.from({ length: meters / 5 + 1 }, (_, i) => [-6.9 + i * 5 * M_LAT, 107.6]);
    expect(routeLength(privacyTrim(line(1000)))).toBeCloseTo(600, -1);
    const short = privacyTrim(line(350)); // 70 m off each end, the middle stays
    expect(routeLength(short)).toBeGreaterThan(190);
    expect(routeLength(short)).toBeLessThan(220);
  });
});

describe('POST /activities speed checks', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function player() {
    const reg = await registerUser();
    await api()
      .post('/v1/me/onboarding')
      .set(auth(reg.accessToken))
      .send({
        name: 'Runner',
        birthDate: '1995-06-01',
        gender: 'OTHER',
        genderPreference: 'ALL',
        ageMin: 18,
        ageMax: 60,
        language: 'EN',
        sports: [{ sportId: 'lari' }],
        acceptTerms: true,
      });
    return reg.accessToken;
  }

  const upload = (token: string, type: string, tr: ReturnType<typeof track>, extra: Record<string, unknown> = {}) =>
    api()
      .post('/v1/activities')
      .set(auth(token))
      .send({
        clientId: randomUUID(),
        type,
        title: 'Test',
        startedAt: '2026-11-19T00:00:00.000Z',
        endedAt: new Date(Date.parse('2026-11-19T00:00:00.000Z') + (tr.movingSec + 60) * 1000).toISOString(),
        movingSec: tr.movingSec,
        distanceM: tr.distanceM,
        polyline: encode(tr.points),
        pointTimes: tr.times,
        showOnProfile: true,
        ...extra,
      });

  it('refuses a run with a motorbike stretch, and accepts it as a ride', async () => {
    const token = await player();
    const tr = track([{ kmh: 10, sec: 600 }, { kmh: 50, sec: 120 }, { kmh: 10, sec: 600 }]);
    const run = await upload(token, 'RUN', tr);
    expect(run.status).toBe(422);
    expect(run.body.error.code).toBe('impossible_speed');
    expect((await upload(token, 'RIDE', tr)).status).toBe(201);
    expect(await prisma.activity.count()).toBe(1);
  });

  it('stores the point times for later checks and splits', async () => {
    const token = await player();
    const tr = track([{ kmh: 12, sec: 400 }]);
    expect((await upload(token, 'RUN', tr)).status).toBe(201);
    const saved = await prisma.activity.findFirstOrThrow({ select: { pointTimes: true } });
    expect(saved.pointTimes).toEqual(tr.times);
  });

  it('refuses times that do not match the route', async () => {
    const token = await player();
    const tr = track([{ kmh: 12, sec: 400 }]);
    expect((await upload(token, 'RUN', tr, { pointTimes: tr.times.slice(1) })).status).toBe(400);
    expect((await upload(token, 'RUN', tr, { pointTimes: [...tr.times].reverse() })).status).toBe(400);
    expect((await upload(token, 'RUN', tr, { pointTimes: undefined })).status).toBe(400);
  });
});

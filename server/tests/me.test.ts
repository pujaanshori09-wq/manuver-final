import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { uploadRoot } from '../src/lib/storage.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Real (tiny) images: the server decodes and re-encodes every upload.
const image = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 255, g: 90, b: 31 } } });
const JPEG = await image(40, 30).jpeg().toBuffer();
const PNG = await image(30, 40).png().toBuffer();

const upload = (token: string, data = JPEG, type = 'image/jpeg', name = 'a.jpg') =>
  api().post('/v1/me/photos').set(auth(token)).attach('photo', data, { filename: name, contentType: type });

describe('GET /me', () => {
  it('returns the private view of the account', async () => {
    const { accessToken, email } = await registerUser();
    const res = await api().get('/v1/me').set(auth(accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email,
      hasPassword: true,
      hasGoogle: false,
      profile: { name: 'Test', onboardingCompleted: false, ageMin: 18, ageMax: 50, genderPreference: 'ALL' },
      photos: [],
      sports: [],
      prompts: [],
      stats: { sessionsJoined: 0, matches: 0 },
    });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('requires a token', async () => {
    expect((await api().get('/v1/me')).status).toBe(401);
  });
});

describe('profile', () => {
  it('updates allowed fields and clears empty text', async () => {
    const { accessToken } = await registerUser();
    const res = await api()
      .patch('/v1/me/profile')
      .set(auth(accessToken))
      .send({ bio: '  Morning runner  ', job: '', availability: ['Pagi', 'Akhir pekan'], ghostMode: true });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ bio: 'Morning runner', job: null, availability: ['Pagi', 'Akhir pekan'], ghostMode: true });
  });

  it('rejects unknown fields (no writing server-controlled columns)', async () => {
    const { accessToken } = await registerUser();
    const res = await api().patch('/v1/me/profile').set(auth(accessToken)).send({ onboardingCompletedAt: new Date() });
    expect(res.status).toBe(400);
  });

  it('rejects an inverted age range, also against stored values', async () => {
    const { accessToken } = await registerUser();
    const direct = await api().patch('/v1/me/profile').set(auth(accessToken)).send({ ageMin: 40, ageMax: 30 });
    expect(direct.status).toBe(400);
    const partial = await api().patch('/v1/me/profile').set(auth(accessToken)).send({ ageMin: 60 }); // stored max is 50
    expect(partial.status).toBe(400);
    expect(partial.body.error.code).toBe('invalid_age_range');
  });
});

describe('onboarding', () => {
  const valid = {
    name: 'Rina',
    birthDate: '2000-05-17',
    gender: 'FEMALE',
    genderPreference: 'ALL',
    ageMin: 20,
    ageMax: 35,
    language: 'ID',
    sports: [
      { sportId: 'badminton', experienceLevel: '1-3 thn' },
      { sportId: 'Lari', experienceLevel: '< 6 bln' },
    ],
    acceptTerms: true,
    location: { latitude: -6.2183, longitude: 106.8026 },
  };

  it('completes onboarding in one step', async () => {
    const { accessToken } = await registerUser();
    const res = await api().post('/v1/me/onboarding').set(auth(accessToken)).send(valid);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      name: 'Rina',
      birthDate: '2000-05-17',
      gender: 'FEMALE',
      onboardingCompleted: true,
      termsAccepted: true,
      hasLocation: true,
      language: 'ID',
    });
    expect(res.body.profile.age).toBeGreaterThanOrEqual(18);
    expect(res.body.sports.map((s: { sportId: string }) => s.sportId)).toEqual(['badminton', 'lari']);
  });

  it('accepts gender OTHER, an open-ended age range (99) and custom sports', async () => {
    const { accessToken } = await registerUser();
    const res = await api()
      .post('/v1/me/onboarding')
      .set(auth(accessToken))
      .send({
        ...valid,
        gender: 'OTHER',
        language: 'EN',
        ageMin: 25,
        ageMax: 99, // "40+" in the app
        sports: [{ sportId: 'badminton' }, { sportId: 'Sepak Takraw', experienceLevel: '6+ thn' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ gender: 'OTHER', ageMax: 99, language: 'EN' });
    expect(res.body.sports).toEqual([
      { sportId: 'badminton', experienceLevel: null },
      { sportId: 'sepak takraw', experienceLevel: '6+ thn' },
    ]);
  });

  it('requires a language', async () => {
    const { accessToken } = await registerUser();
    const { language: _omit, ...withoutLanguage } = valid;
    const res = await api().post('/v1/me/onboarding').set(auth(accessToken)).send(withoutLanguage);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain('language');
  });

  it('refuses players under 18', async () => {
    const { accessToken } = await registerUser();
    const year = new Date().getUTCFullYear() - 16;
    const res = await api()
      .post('/v1/me/onboarding')
      .set(auth(accessToken))
      .send({ ...valid, birthDate: `${year}-01-01` });
    expect(res.status).toBe(400);
  });

  it('requires accepting the terms and at least one sport', async () => {
    const { accessToken } = await registerUser();
    const res = await api()
      .post('/v1/me/onboarding')
      .set(auth(accessToken))
      .send({ ...valid, acceptTerms: false, sports: [] });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['acceptTerms', 'sports']));
  });
});

describe('language', () => {
  it('can be changed later from settings', async () => {
    const { accessToken } = await registerUser();
    const res = await api().patch('/v1/me/profile').set(auth(accessToken)).send({ language: 'ID' });
    expect(res.status).toBe(200);
    expect(res.body.profile.language).toBe('ID');
    // Every app language is accepted; Arabic (right-to-left) and unknown codes are not.
    expect((await api().patch('/v1/me/profile').set(auth(accessToken)).send({ language: 'JA' })).status).toBe(200);
    expect((await api().patch('/v1/me/profile').set(auth(accessToken)).send({ language: 'AR' })).status).toBe(400);
  });
});

describe('sports & location', () => {
  it('replaces the sports list (deduplicated, lowercase ids)', async () => {
    const { accessToken } = await registerUser();
    const res = await api()
      .put('/v1/me/sports')
      .set(auth(accessToken))
      .send({ sports: [{ sportId: 'Padel' }, { sportId: 'padel' }, { sportId: 'gym', experienceLevel: '3+ thn' }] });
    expect(res.status).toBe(200);
    expect(res.body.sports).toEqual([
      { sportId: 'padel', experienceLevel: null },
      { sportId: 'gym', experienceLevel: '3+ thn' },
    ]);
  });

  it('stores location privately', async () => {
    const { accessToken, user } = await registerUser();
    expect((await api().put('/v1/me/location').set(auth(accessToken)).send({ latitude: 100, longitude: 0 })).status).toBe(400);
    expect((await api().put('/v1/me/location').set(auth(accessToken)).send({ latitude: -6.2, longitude: 106.8 })).status).toBe(204);
    const row = await prisma.profile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(row.latitude).toBeCloseTo(-6.2);
    const me = await api().get('/v1/me').set(auth(accessToken));
    expect(me.body.profile.hasLocation).toBe(true);
    expect(me.body.profile).not.toHaveProperty('latitude');
  });
});

describe('photos', () => {
  it('uploads, serves, reorders and deletes photos', async () => {
    const { accessToken } = await registerUser();
    const a = await upload(accessToken);
    expect(a.status).toBe(201);
    const b = await upload(accessToken, PNG, 'image/png', 'b.png');
    expect(b.body.photos).toHaveLength(2);

    const [first, second] = b.body.photos as { id: string; url: string; position: number }[];
    expect(first!.url).toMatch(/^\/uploads\/users\/.+\.jpg$/);
    expect(second!.url).toMatch(/\.jpg$/); // everything is stored as JPEG

    // The file is really served
    const served = await api().get(first!.url);
    expect(served.status).toBe(200);

    const reordered = await api()
      .put('/v1/me/photos/order')
      .set(auth(accessToken))
      .send({ ids: [second!.id, first!.id] });
    expect(reordered.body.photos.map((p: { id: string }) => p.id)).toEqual([second!.id, first!.id]);

    const del = await api().delete(`/v1/me/photos/${second!.id}`).set(auth(accessToken));
    expect(del.status).toBe(200);
    expect(del.body.photos).toEqual([{ id: first!.id, url: first!.url, position: 0 }]);
    // file removed from disk
    expect(existsSync(path.join(uploadRoot, second!.url.replace('/uploads/', '')))).toBe(false);
  });

  it('drops GPS and other metadata, turns photos upright and shrinks big ones', async () => {
    const { accessToken } = await registerUser();
    const phonePhoto = await image(3000, 2000)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: 'Phone' }, IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '6/1 54/1 0/1' } })
      .toBuffer();
    const sent = await sharp(phonePhoto).metadata();
    expect(sent.exif).toBeDefined();
    expect(sent.orientation).toBe(6);

    const res = await upload(accessToken, phonePhoto);
    expect(res.status).toBe(201);
    const stored = readFileSync(path.join(uploadRoot, res.body.photos[0].url.replace('/uploads/', '')));
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
    // Orientation 6 means "rotate 90°": stored upright, then fitted inside 1600 px.
    expect([meta.width, meta.height]).toEqual([1067, 1600]);
  });

  it('rejects files that are not really images', async () => {
    const { accessToken } = await registerUser();
    const res = await upload(accessToken, Buffer.from('<?php echo "hi"; ?>'.padEnd(64, ' ')), 'image/jpeg', 'evil.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unsupported_image');

    const wrongType = await upload(accessToken, JPEG, 'application/pdf', 'doc.pdf');
    expect(wrongType.status).toBe(400);

    // Right signature, broken inside.
    const broken = await upload(accessToken, Buffer.concat([JPEG.subarray(0, 20), Buffer.alloc(200, 7)]));
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('unsupported_image');
  });

  it('allows at most 4 photos', async () => {
    const { accessToken } = await registerUser();
    for (let i = 0; i < 4; i++) expect((await upload(accessToken)).status).toBe(201);
    const fifth = await upload(accessToken);
    expect(fifth.status).toBe(400);
    expect(fifth.body.error.code).toBe('too_many_photos');
  });

  it("cannot touch someone else's photo", async () => {
    const owner = await registerUser();
    const other = await registerUser();
    const { body } = await upload(owner.accessToken);
    const res = await api().delete(`/v1/me/photos/${body.photos[0].id}`).set(auth(other.accessToken));
    expect(res.status).toBe(404);
  });
});

describe('prompts', () => {
  it('lists questions and saves up to 3 answers', async () => {
    const { accessToken } = await registerUser();
    const qs = await Promise.all(
      ['One', 'Two', 'Three', 'Four'].map((t) => prisma.promptQuestion.create({ data: { textEn: t, textId: t } })),
    );
    const list = await api().get('/v1/prompts/questions').set(auth(accessToken));
    expect(list.body).toHaveLength(4);

    const ok = await api()
      .put('/v1/me/prompts')
      .set(auth(accessToken))
      .send({ prompts: [{ questionId: qs[0]!.id, answer: 'Sub-30 5K' }, { questionId: qs[1]!.id, answer: 'Rally' }] });
    expect(ok.status).toBe(200);
    expect(ok.body.prompts.map((p: { answer: string }) => p.answer)).toEqual(['Sub-30 5K', 'Rally']);
    expect(ok.body.prompts[0].question).toEqual({ en: 'One', id: 'One' });

    const tooMany = await api()
      .put('/v1/me/prompts')
      .set(auth(accessToken))
      .send({ prompts: qs.map((q) => ({ questionId: q.id, answer: 'x' })) });
    expect(tooMany.status).toBe(400);
  });
});

describe('delete account', () => {
  it('removes the user, their tokens and files', async () => {
    const { accessToken, refreshToken, user } = await registerUser();
    const up = await upload(accessToken);
    const file = path.join(uploadRoot, up.body.photos[0].url.replace('/uploads/', ''));
    expect(existsSync(file)).toBe(true);

    expect((await api().delete('/v1/me').set(auth(accessToken))).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(existsSync(file)).toBe(false);
    expect((await api().post('/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api().get('/v1/me').set(auth(accessToken))).status).toBe(401);
  });
});

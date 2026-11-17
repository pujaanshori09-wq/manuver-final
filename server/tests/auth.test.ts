import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { forgotPassword } from '../src/modules/auth/auth.service.js';
import { api, registerUser, resetDb, uniqueEmail } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('register', () => {
  it('creates an account and returns tokens', async () => {
    const res = await api().post('/v1/auth/register').send({ email: 'Rina@Example.com', password: 'correct-horse-9' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('rina@example.com'); // normalised
    expect(res.body.user.onboardingCompleted).toBe(false);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty('user.passwordHash');

    // Profile row is created with the account.
    const profile = await prisma.profile.findUnique({ where: { userId: res.body.user.id } });
    expect(profile).not.toBeNull();
  });

  it('rejects a duplicate email', async () => {
    const { email } = await registerUser();
    const res = await api().post('/v1/auth/register').send({ email, password: 'another-pass-1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  it('validates input', async () => {
    const res = await api().post('/v1/auth/register').send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password']);
  });

  it('stores a bcrypt hash, never the password', async () => {
    const { user, password } = await registerUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(row.passwordHash).not.toContain(password);
  });
});

describe('login', () => {
  it('signs in with the right password', async () => {
    const { email, password } = await registerUser();
    const res = await api().post('/v1/auth/login').send({ email: email.toUpperCase(), password });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { email } = await registerUser();
    const wrong = await api().post('/v1/auth/login').send({ email, password: 'wrong-password' });
    const unknown = await api().post('/v1/auth/login').send({ email: uniqueEmail(), password: 'wrong-password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
    expect(unknown.body.error.code).toBe('invalid_credentials');
  });
});

describe('access token', () => {
  it('opens /auth/me', async () => {
    const { accessToken, email } = await registerUser();
    const res = await api().get('/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
    expect(res.body.name).toBe('Test');
  });

  it('is required', async () => {
    expect((await api().get('/v1/auth/me')).status).toBe(401);
    const bad = await api().get('/v1/auth/me').set('Authorization', 'Bearer not-a-token');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('invalid_token');
  });
});

describe('refresh tokens', () => {
  it('rotates: the old token stops working, the new one works', async () => {
    const { refreshToken } = await registerUser();
    const first = await api().post('/v1/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    const second = await api().post('/v1/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it('detects reuse and revokes the whole session family', async () => {
    const { refreshToken } = await registerUser();
    const rotated = await api().post('/v1/auth/refresh').send({ refreshToken });
    expect(rotated.status).toBe(200);

    // A stolen copy of the old token is replayed...
    const replay = await api().post('/v1/auth/refresh').send({ refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('refresh_token_reused');

    // ...which also kills the legitimate, newer token.
    const legit = await api().post('/v1/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(legit.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const { refreshToken } = await registerUser();
    expect((await api().post('/v1/auth/logout').send({ refreshToken })).status).toBe(204);
    expect((await api().post('/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
    // Idempotent
    expect((await api().post('/v1/auth/logout').send({ refreshToken })).status).toBe(204);
  });
});

describe('password reset', () => {
  it('answers the same for unknown emails', async () => {
    const res = await api().post('/v1/auth/password/forgot').send({ email: uniqueEmail() });
    expect(res.status).toBe(202);
  });

  it('resets the password once and signs out other devices', async () => {
    const { email, refreshToken } = await registerUser();
    const token = await forgotPassword(email);
    expect(token).toEqual(expect.any(String));

    const reset = await api().post('/v1/auth/password/reset').send({ token, password: 'brand-new-pass-2' });
    expect(reset.status).toBe(204);

    expect((await api().post('/v1/auth/login').send({ email, password: 'brand-new-pass-2' })).status).toBe(200);
    expect((await api().post('/v1/auth/refresh').send({ refreshToken })).status).toBe(401);

    const again = await api().post('/v1/auth/password/reset').send({ token, password: 'another-pass-3' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid_reset_token');
  });
});

describe('google', () => {
  it('never accepts a fake ID token (disabled, or rejected when configured)', async () => {
    const res = await api().post('/v1/auth/google').send({ idToken: 'x'.repeat(40) });
    const configured = !!(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_IDS);
    expect(res.status).toBe(configured ? 401 : 400);
    expect(res.body.error.code).toBe(configured ? 'invalid_google_token' : 'google_disabled');
    expect(res.body).not.toHaveProperty('accessToken');
  });
});

describe('basics', () => {
  it('health check reaches the database', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('unknown routes return a JSON 404', async () => {
    const res = await api().get('/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('route_not_found');
  });

  it('malformed JSON returns 400', async () => {
    const res = await api().post('/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

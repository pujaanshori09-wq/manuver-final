import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { forgotPassword, sendVerificationEmail } from '../src/modules/auth/auth.service.js';
import { api, registerUser, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('email verification', () => {
  it('confirms the address with the emailed link (sign-up is not blocked meanwhile)', async () => {
    const { user, email } = await registerUser();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(false);

    const token = await sendVerificationEmail(user.id, email);
    const res = await api().get('/v1/auth/email/verify').query({ token });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerified).toBe(true);
  });

  it('rejects a tampered link', async () => {
    const res = await api().get('/v1/auth/email/verify').query({ token: 'nope' });
    expect(res.status).toBe(400);
  });

  it('does not verify an address the account no longer uses', async () => {
    const { user, email } = await registerUser();
    const token = await sendVerificationEmail(user.id, email);
    await prisma.user.update({ where: { id: user.id }, data: { email: 'changed@test.manuver' } });
    const res = await api().get('/v1/auth/email/verify').query({ token });
    expect(res.status).toBe(400);
  });
});

describe('password reset link', () => {
  it('forwards to the app deep link with the token', async () => {
    const { email } = await registerUser();
    const token = (await forgotPassword(email, 'exp://abc.exp.direct/--/reset-password'))!;
    const res = await api().get('/v1/auth/password/open').query({ token, r: 'exp://abc.exp.direct/--/reset-password' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`exp://abc.exp.direct/--/reset-password?token=${token}`);
  });

  it('never forwards to a foreign site', async () => {
    const res = await api().get('/v1/auth/password/open').query({ token: 'x'.repeat(40), r: 'https://evil.example/' });
    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
  });

  it('accepts the returnUrl in the forgot request without changing the response', async () => {
    const res = await api()
      .post('/v1/auth/password/forgot')
      .send({ email: 'nobody@test.manuver', returnUrl: 'manuverapp://reset-password' });
    expect(res.status).toBe(202);
  });
});

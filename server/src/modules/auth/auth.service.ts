import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { badRequest, conflict, unauthorized } from '../../lib/errors.js';
import { layout, publicOrigin, sendEmail } from '../../lib/email.js';
import { logger } from '../../lib/logger.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import {
  accessTokenTtlSeconds,
  hashToken,
  newFamilyId,
  newOpaqueToken,
  signAccessToken,
} from '../../lib/tokens.js';

const DAY_MS = 86_400_000;
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export type AuthResult = {
  user: { id: string; email: string | null; emailVerified: boolean; onboardingCompleted: boolean };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

async function issueTokens(userId: string, familyId: string = newFamilyId(), userAgent?: string) {
  const refreshToken = newOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      userAgent: userAgent?.slice(0, 200),
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken, expiresIn: accessTokenTtlSeconds() };
}

/** Issues a new session (access + refresh token) for a user. */
export async function issueSession(userId: string, userAgent?: string, familyId?: string): Promise<AuthResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true, profile: { select: { onboardingCompletedAt: true } } },
  });
  const tokens = await issueTokens(userId, familyId, userAgent);
  return {
    user: {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      onboardingCompleted: !!user.profile?.onboardingCompletedAt,
    },
    ...tokens,
  };
}

export async function register(input: { email: string; password: string; name?: string }, userAgent?: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('email_taken', 'An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      profile: { create: { name: input.name ?? '' } },
    },
    select: { id: true },
  });
  sendVerificationEmail(user.id, input.email).catch((err) => logger.warn({ err }, 'Verification email failed'));
  return issueSession(user.id, userAgent);
}

export async function login(input: { email: string; password: string }, userAgent?: string) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, passwordHash: true },
  });

  // Same work and same error whether the email exists or not.
  const ok = user?.passwordHash
    ? await verifyPassword(input.password, user.passwordHash)
    : await burnPasswordCheck(input.password).then(() => false);
  if (!user || !ok) throw unauthorized('invalid_credentials', 'Email or password is incorrect');

  return issueSession(user.id, userAgent);
}

/**
 * Rotates a refresh token. Presenting a token that was already rotated means it leaked
 * (or two clients share it): the whole family is revoked and the user must sign in again.
 */
export async function refresh(refreshToken: string, userAgent?: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!row) throw unauthorized('invalid_refresh_token', 'Invalid refresh token');

  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    logger.warn({ userId: row.userId }, 'Refresh token reuse detected; family revoked');
    throw unauthorized('refresh_token_reused', 'Session expired, please sign in again');
  }
  if (row.expiresAt < new Date()) throw unauthorized('refresh_token_expired', 'Session expired, please sign in again');

  // Revoke the old token only if nobody else rotated it in the meantime (race-safe).
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count === 0) throw unauthorized('refresh_token_reused', 'Session expired, please sign in again');

  return issueSession(row.userId, userAgent, row.familyId);
}

export async function logout(refreshToken: string) {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
  if (!row) return; // already gone: logging out is idempotent
  await prisma.refreshToken.updateMany({
    where: { familyId: row.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ── Google ─────────────────────────────────────────────────────────────────────

const googleAudiences = () => [...new Set([...env.GOOGLE_CLIENT_IDS, env.GOOGLE_CLIENT_ID].filter(Boolean))];

/** Finds the account for a verified Google profile: by Google id, then by email (linking), else creates it. */
async function accountForGoogle(payload: TokenPayload | undefined) {
  if (!payload?.sub || !payload.email) throw unauthorized('invalid_google_token', 'Google sign-in failed');
  if (!payload.email_verified) throw unauthorized('google_email_unverified', 'Google email is not verified');

  const email = payload.email.toLowerCase();
  const byGoogle = await prisma.user.findUnique({ where: { googleId: payload.sub }, select: { id: true } });
  if (byGoogle) return { id: byGoogle.id, isNewUser: false };

  // Link to an existing email account (Google has verified the address), or create one.
  const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (byEmail) {
    await prisma.user.update({ where: { id: byEmail.id }, data: { googleId: payload.sub, emailVerified: true } });
    return { id: byEmail.id, isNewUser: false };
  }
  const created = await prisma.user.create({
    data: {
      email,
      googleId: payload.sub,
      emailVerified: true,
      profile: { create: { name: (payload.given_name ?? payload.name ?? '').slice(0, 60) } },
    },
    select: { id: true },
  });
  return { id: created.id, isNewUser: true };
}

const googleClient = new OAuth2Client();

/** Accepts a Google ID token from a native Google Sign-In (kept for a future native build). */
export async function google(idToken: string, userAgent?: string) {
  const audience = googleAudiences();
  if (audience.length === 0) throw badRequest('google_disabled', 'Google sign-in is not configured on this server');

  let payload;
  try {
    payload = (await googleClient.verifyIdToken({ idToken, audience })).getPayload();
  } catch {
    throw unauthorized('invalid_google_token', 'Google sign-in failed');
  }
  const account = await accountForGoogle(payload);
  return { ...(await issueSession(account.id, userAgent)), isNewUser: account.isNewUser };
}

// Server-side OAuth 2.0 (authorization code + PKCE). The app opens /google/start in the system
// browser; Google returns to /google/callback here; we hand a one-time code back to the app,
// which exchanges it for a session. Works in Expo Go and on the web, no native module needed.

const OAUTH_STATE_TTL = 10 * 60; // seconds
const HANDOFF_TTL_MS = 2 * 60 * 1000;
const STATE_AUDIENCE = 'manuver-google-state';
/** PKCE verifiers by state nonce. In memory: a restart only cancels sign-ins in progress. */
const pendingVerifiers = new Map<string, { verifier: string; expires: number }>();

export const googleCallbackPath = '/v1/auth/google/callback';

function googleConfigured() {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** Origins come from config only, so Google can never be sent to an unregistered redirect. */
export function allowedOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  const clean = origin.replace(/\/+$/, '');
  return env.OAUTH_ORIGINS.includes(clean) ? clean : null;
}

/** Where the app wants to land afterwards. Only app deep links and our own web origins (no open redirect). */
export function allowedReturnUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (['exp:', 'exps:', 'manuverapp:'].includes(u.protocol)) return url;
    if ((u.protocol === 'http:' || u.protocol === 'https:') && allowedOrigin(u.origin)) return url;
  } catch {
    /* not a URL */
  }
  return null;
}

export function withQuery(url: string, params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return url + (url.includes('?') ? '&' : '?') + q;
}

export async function googleAuthUrl(origin: string, returnUrl: string) {
  if (!googleConfigured()) throw badRequest('google_disabled', 'Google sign-in is not configured on this server');
  const redirectUri = origin + googleCallbackPath;
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();

  const nonce = newOpaqueToken();
  const now = Date.now();
  for (const [k, v] of pendingVerifiers) if (v.expires < now) pendingVerifiers.delete(k);
  pendingVerifiers.set(nonce, { verifier: codeVerifier, expires: now + OAUTH_STATE_TTL * 1000 });

  const state = jwt.sign({ n: nonce, o: origin, r: returnUrl }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    audience: STATE_AUDIENCE,
    expiresIn: OAUTH_STATE_TTL,
  });
  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
    code_challenge: codeChallenge!,
    code_challenge_method: CodeChallengeMethod.S256,
  });
}

/** Reads the signed state; null when it was tampered with or expired. */
export function readGoogleState(state: string | undefined): { nonce: string; origin: string; returnUrl: string } | null {
  if (!state) return null;
  try {
    const p = jwt.verify(state, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], audience: STATE_AUDIENCE }) as {
      n: string;
      o: string;
      r: string;
    };
    if (!allowedOrigin(p.o) || !allowedReturnUrl(p.r)) return null;
    return { nonce: p.n, origin: p.o, returnUrl: p.r };
  } catch {
    return null;
  }
}

/** Finishes the Google redirect: returns a one-time code for the app. */
export async function finishGoogle(code: string, state: { nonce: string; origin: string }) {
  const pending = pendingVerifiers.get(state.nonce);
  pendingVerifiers.delete(state.nonce); // single use
  if (!pending || pending.expires < Date.now()) throw badRequest('oauth_expired', 'Sign-in took too long, try again');

  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, state.origin + googleCallbackPath);
  let payload;
  try {
    const { tokens } = await client.getToken({ code, codeVerifier: pending.verifier });
    if (!tokens.id_token) throw new Error('no id_token');
    payload = (await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID })).getPayload();
  } catch (err) {
    logger.warn({ err }, 'Google code exchange failed');
    throw unauthorized('invalid_google_token', 'Google sign-in failed');
  }
  const account = await accountForGoogle(payload);

  const handoff = newOpaqueToken();
  await prisma.oAuthHandoff.create({
    data: { codeHash: hashToken(handoff), userId: account.id, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) },
  });
  return { handoff, isNewUser: account.isNewUser };
}

/** App side of the handoff: one-time code → session. */
export async function exchangeHandoff(code: string, userAgent?: string) {
  const row = await prisma.oAuthHandoff.findUnique({ where: { codeHash: hashToken(code) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw unauthorized('invalid_oauth_code', 'Sign-in expired, try again');
  const used = await prisma.oAuthHandoff.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count === 0) throw unauthorized('invalid_oauth_code', 'Sign-in expired, try again');
  return issueSession(row.userId, userAgent);
}

// ── Password reset ─────────────────────────────────────────────────────────────

/**
 * Always succeeds (no account enumeration). Emails a link to /password/open on this API, which
 * forwards to the app's reset screen (an https link works in every mail client; app deep links
 * often don't). Without RESEND_API_KEY the email is written to the log in development.
 */
export async function forgotPassword(email: string, returnUrl?: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;

  const token = newOpaqueToken();
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });

  const target = allowedReturnUrl(returnUrl);
  const url = `${publicOrigin()}/v1/auth/password/open?${new URLSearchParams({ token, ...(target ? { r: target } : {}) })}`;
  const mail = layout({
    title: 'Reset your password',
    intro: 'Someone (hopefully you) asked to reset the password of your Manuver account. The link works for 1 hour.',
    button: 'Choose a new password',
    url,
    footer: "Didn't ask for this? You can ignore this email; your password stays the same.",
  });
  await sendEmail({ to: email, subject: 'Reset your Manuver password', ...mail }).catch((err) =>
    logger.warn({ err }, 'Password reset email failed'),
  );
  return token; // returned for tests only; the route never sends it to the client
}

// ── Email verification ── stateless signed link (3 days); verifying never blocks sign-in.

const VERIFY_AUDIENCE = 'manuver-email-verify';

export async function sendVerificationEmail(userId: string, email: string) {
  const token = jwt.sign({ e: email }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    audience: VERIFY_AUDIENCE,
    subject: userId,
    expiresIn: '3d',
  });
  const url = `${publicOrigin()}/v1/auth/email/verify?${new URLSearchParams({ token })}`;
  const mail = layout({
    title: 'Confirm your email',
    intro: 'Welcome to Manuver! Confirm this address so you can always get back into your account.',
    button: 'Confirm email',
    url,
    footer: "Didn't create a Manuver account? Ignore this email.",
  });
  await sendEmail({ to: email, subject: 'Confirm your email for Manuver', ...mail });
  return token;
}

/** True when the link was valid and the address still belongs to that account. */
export async function verifyEmail(token: string): Promise<boolean> {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'], audience: VERIFY_AUDIENCE }) as {
      sub: string;
      e: string;
    };
    const r = await prisma.user.updateMany({ where: { id: p.sub, email: p.e }, data: { emailVerified: true } });
    return r.count === 1;
  } catch {
    return false;
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw badRequest('invalid_reset_token', 'This reset link is invalid or has expired');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Sign out every device after a password change.
    prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
}

export async function me(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
     
      emailVerified: true,
      googleId: true,
      createdAt: true,
      profile: { select: { name: true, onboardingCompletedAt: true } },
    },
  });
  if (!user) throw unauthorized('user_not_found', 'Account no longer exists');
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    hasGoogle: !!user.googleId,
    createdAt: user.createdAt,
    name: user.profile?.name ?? '',
    onboardingCompleted: !!user.profile?.onboardingCompletedAt,
  };
}

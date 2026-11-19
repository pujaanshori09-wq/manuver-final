import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { authByEmail, authByIp } from '../../middleware/rateLimits.js';
import { validate } from '../../middleware/validate.js';
import {
  ForgotBody,
  GoogleBody,
  GoogleStartQuery,
  HandoffBody,
  LoginBody,
  RefreshBody,
  RegisterBody,
  ResetBody,
} from './auth.schemas.js';
import * as auth from './auth.service.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../lib/errors.js';

export const authRouter = Router();

const ua = (h: string | undefined) => h ?? undefined;

authRouter.post('/register', authByIp, validate({ body: RegisterBody }), authByEmail, async (req, res) => {
  res.status(201).json(await auth.register(req.body, ua(req.headers['user-agent'])));
});

authRouter.post('/login', authByIp, validate({ body: LoginBody }), authByEmail, async (req, res) => {
  res.json(await auth.login(req.body, ua(req.headers['user-agent'])));
});

authRouter.post('/google', authByIp, validate({ body: GoogleBody }), async (req, res) => {
  res.json(await auth.google(req.body.idToken, ua(req.headers['user-agent'])));
});

// ── Google (server-side OAuth 2.0 + PKCE) ──
authRouter.get('/google/start', authByIp, validate({ query: GoogleStartQuery }), async (req, res) => {
  const { origin, returnUrl } = res.locals.query as { origin: string; returnUrl: string };
  const okOrigin = auth.allowedOrigin(origin);
  const okReturn = auth.allowedReturnUrl(returnUrl);
  if (!okReturn) {
    res.status(400).json({ error: { code: 'invalid_return_url', message: 'Return URL not allowed' } });
    return;
  }
  if (!okOrigin) {
    res.redirect(302, auth.withQuery(okReturn, { error: 'origin_not_allowed' }));
    return;
  }
  try {
    res.redirect(302, await auth.googleAuthUrl(okOrigin, okReturn));
  } catch (err) {
    res.redirect(302, auth.withQuery(okReturn, { error: err instanceof AppError ? err.code : 'google_failed' }));
  }
});

authRouter.get('/google/callback', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const state = auth.readGoogleState(q.state);
  if (!state) {
    res.status(400).type('text/plain').send('This sign-in link has expired. Go back to Manuver and try again.');
    return;
  }
  if (q.error || !q.code) {
    res.redirect(302, auth.withQuery(state.returnUrl, { error: q.error === 'access_denied' ? 'cancelled' : 'google_failed' }));
    return;
  }
  try {
    const { handoff, isNewUser } = await auth.finishGoogle(q.code, state);
    res.redirect(302, auth.withQuery(state.returnUrl, { code: handoff, new: isNewUser ? '1' : '0' }));
  } catch (err) {
    logger.warn({ err }, 'Google callback failed');
    res.redirect(302, auth.withQuery(state.returnUrl, { error: err instanceof AppError ? err.code : 'google_failed' }));
  }
});

authRouter.post('/google/exchange', authByIp, validate({ body: HandoffBody }), async (req, res) => {
  res.json(await auth.exchangeHandoff(req.body.code, ua(req.headers['user-agent'])));
});

authRouter.post('/refresh', validate({ body: RefreshBody }), async (req, res) => {
  res.json(await auth.refresh(req.body.refreshToken, ua(req.headers['user-agent'])));
});

authRouter.post('/logout', validate({ body: RefreshBody }), async (req, res) => {
  await auth.logout(req.body.refreshToken);
  res.status(204).end();
});

authRouter.post('/password/forgot', authByIp, validate({ body: ForgotBody }), authByEmail, async (req, res) => {
  await auth.forgotPassword(req.body.email, req.body.returnUrl);
  // Same response whether or not the email exists.
  res.status(202).json({ ok: true });
});

// Email links land here (https works in every mail client) and forward to the app's reset screen.
authRouter.get('/password/open', (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const token = typeof q.token === 'string' ? q.token.slice(0, 200) : '';
  const target = auth.allowedReturnUrl(q.r);
  if (token && target) {
    res.redirect(302, auth.withQuery(target, { token }));
    return;
  }
  res
    .status(token ? 200 : 400)
    .type('html')
    .send(page(token ? 'Open Manuver on your phone to choose a new password.' : 'This link is incomplete.'));
});

authRouter.get('/email/verify', async (req, res) => {
  const ok = await auth.verifyEmail(String(req.query.token ?? ''));
  res
    .status(ok ? 200 : 400)
    .type('html')
    .send(page(ok ? 'Your email is confirmed. You can close this page.' : 'This link is invalid or has expired.'));
});

authRouter.post('/password/reset', authByIp, validate({ body: ResetBody }), async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await auth.me(currentUserId(req)));
});

/** Tiny standalone HTML page for links opened in a browser. */
function page(message: string) {
  const safe = message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manuver</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0c;font-family:Arial,sans-serif"><div style="max-width:360px;padding:24px;text-align:center"><div style="color:#ff5a1f;font-size:28px;font-weight:700">manuver</div><p style="color:#e4e4e7;font-size:17px;line-height:1.5">${safe}</p></div></body></html>`;
}

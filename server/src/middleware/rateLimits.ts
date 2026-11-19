import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.js';

/**
 * Request rate limits (in memory, so one server instance; see docs/BACKEND_PLAN.md).
 * Swipe quotas are not here: they are counted in the database (modules/discover/quota.ts).
 * Off in tests, where many accounts share one address.
 */
const make = (opts: { windowMs: number; limit: number; key: (req: Request) => string }) =>
  rateLimit({
    windowMs: opts.windowMs,
    limit: isTest ? 100_000 : opts.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: opts.key,
    message: { error: { code: 'rate_limited', message: 'Too many requests. Try again later.' } },
  });

const MIN = 60_000;
const ip = (req: Request) => ipKeyGenerator(req.ip ?? '');
/** Behind requireAuth: one bucket per account. */
const user = (req: Request) => `u:${req.userId ?? ip(req)}`;

/**
 * Sign-in, sign-up and password emails. Generous per address, because many people on mobile
 * data share one IP (carrier NAT); strict per email, which is what stops password guessing.
 */
export const authByIp = make({ windowMs: 15 * MIN, limit: 100, key: ip });
export const authByEmail = make({
  windowMs: 15 * MIN,
  limit: 10,
  key: (req) => `e:${typeof req.body?.email === 'string' ? req.body.email : ip(req)}`,
});

/** A backstop for the whole API, per address. */
export const apiByIp = make({ windowMs: MIN, limit: 600, key: ip });

export const discoverLimit = make({ windowMs: MIN, limit: 60, key: user });
export const messageLimit = make({ windowMs: MIN, limit: 30, key: user });
export const photoLimit = make({ windowMs: 60 * MIN, limit: 20, key: user });
export const reportLimit = make({ windowMs: 60 * MIN, limit: 10, key: user });
/** New sessions, SOS posts and events. */
export const postLimit = make({ windowMs: 60 * MIN, limit: 10, key: user });
export const activityLimit = make({ windowMs: 60 * MIN, limit: 30, key: user });

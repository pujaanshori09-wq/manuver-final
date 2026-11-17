import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      userId?: string;
    }
  }
}

/** Requires `Authorization: Bearer <access token>`; sets req.userId. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  const { sub } = verifyAccessToken(header.slice('Bearer '.length).trim());
  req.userId = sub;
  next();
};

/** For handlers behind requireAuth. */
export function currentUserId(req: Express.Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}

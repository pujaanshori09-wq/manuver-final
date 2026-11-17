import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

const ISSUER = 'manuver-api';
const AUDIENCE = 'manuver-app';

export type AccessClaims = { sub: string };

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof payload === 'string' || !payload.sub) throw new Error('bad payload');
    return { sub: payload.sub };
  } catch (e) {
    const expired = e instanceof jwt.TokenExpiredError;
    throw unauthorized(expired ? 'token_expired' : 'invalid_token', expired ? 'Access token expired' : 'Invalid access token');
  }
}

/** Seconds until an access token expires, for the client's refresh timer. */
export function accessTokenTtlSeconds(): number {
  const m = /^(\d+)([smhd])$/.exec(env.ACCESS_TOKEN_TTL);
  if (!m) return 900;
  const n = Number(m[1]);
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 's' | 'm' | 'h' | 'd'];
}

/**
 * Refresh tokens are opaque random strings. Only an HMAC of the token is stored, so a
 * database leak does not hand out working tokens.
 */
export function newOpaqueToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

export const newFamilyId = () => randomUUID();

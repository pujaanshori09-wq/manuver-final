import { logger } from './logger.js';
import { prisma } from './prisma.js';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Last time this process wrote lastActiveAt per user, so a busy session writes once per 5 minutes. */
const touched = new Map<string, number>();
const ACTIVE_EVERY_MS = 5 * MIN;

/**
 * Records that someone used the app (Discover shows recently active players first).
 * Fire and forget: it never slows down or fails the request.
 */
export function touchActive(userId: string) {
  const now = Date.now();
  if (now - (touched.get(userId) ?? 0) < ACTIVE_EVERY_MS) return;
  touched.set(userId, now);
  if (touched.size > 50_000) touched.clear();
  prisma.profile
    .updateMany({ where: { userId, lastActiveAt: { lt: new Date(now - ACTIVE_EVERY_MS) } }, data: { lastActiveAt: new Date(now) } })
    .catch(() => {});
}

/** Deletes rows nobody can use any more, so these tables stay small. */
export async function pruneExpired(now = new Date()) {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const [tokens, resets, handoffs, swipes, hits] = await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: ago(DAY) } }, { revokedAt: { lt: ago(30 * DAY) } }] } }),
    prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: ago(DAY) } } }),
    prisma.oAuthHandoff.deleteMany({ where: { expiresAt: { lt: ago(DAY) } } }),
    // Quotas look back a week at most; bot checks only need the latest few hundred swipes.
    prisma.swipeEvent.deleteMany({ where: { createdAt: { lt: ago(30 * DAY) } } }),
    prisma.abuseEvent.deleteMany({ where: { kind: 'RATE_LIMIT_HIT', createdAt: { lt: ago(90 * DAY) } } }),
  ]);
  return { tokens: tokens.count, resets: resets.count, handoffs: handoffs.count, swipes: swipes.count, hits: hits.count };
}

/** Runs pruneExpired now and every 6 hours. */
export function startHousekeeping() {
  const run = () =>
    pruneExpired()
      .then((n) => logger.info(n, 'Pruned expired rows'))
      .catch((err) => logger.warn({ err }, 'Pruning failed'));
  run();
  setInterval(run, 6 * 60 * MIN).unref();
}

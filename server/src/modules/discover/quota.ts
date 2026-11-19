import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

/**
 * Swipe rules (agreed for the MVP, Tinder-style). Everything is counted from swipe_events in the
 * database, inside the swipe transaction, so the app cannot get around it.
 *   Likes:        Free 20 a day (resets 00:00 WIB), Premium unlimited
 *   Super Likes:  Free 1, Premium 5 a week (resets Monday 00:00 WIB), separate from Likes
 *   Skip/Pass:    free
 *   Everyone:     at most 60 swipes a minute and 500 an hour, Skips included (stops bots)
 */
export const LIMITS = {
  freeLikesPerDay: 20,
  superPerWeek: { free: 1, premium: 5 },
  perMinute: 60,
  perHour: 500,
} as const;

const WIB_OFFSET_MS = 7 * 3600_000; // Asia/Jakarta, no daylight saving
const DAY_MS = 86_400_000;

/** 00:00 WIB today, as a UTC instant. */
export function startOfDayWib(now = new Date()) {
  return new Date(Math.floor((now.getTime() + WIB_OFFSET_MS) / DAY_MS) * DAY_MS - WIB_OFFSET_MS);
}

/** Monday 00:00 WIB of this week, as a UTC instant. */
export function startOfWeekWib(now = new Date()) {
  const day = startOfDayWib(now);
  const weekday = (new Date(day.getTime() + WIB_OFFSET_MS).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - weekday * DAY_MS);
}

export const isPremium = (premiumUntil: Date | null | undefined, now = new Date()) => !!premiumUntil && premiumUntil > now;

export type Quota = {
  premium: boolean;
  /** null = unlimited (premium). */
  likesLeft: number | null;
  likesResetAt: string;
  superLeft: number;
  superResetAt: string;
};

type Tx = Prisma.TransactionClient;

export async function readQuota(tx: Tx, userId: string, premiumUntil: Date | null, now = new Date()): Promise<Quota> {
  const premium = isPremium(premiumUntil, now);
  const day = startOfDayWib(now);
  const week = startOfWeekWib(now);
  const [likes, supers] = await Promise.all([
    premium ? Promise.resolve(0) : tx.swipeEvent.count({ where: { userId, action: 'LIKE', createdAt: { gte: day } } }),
    tx.swipeEvent.count({ where: { userId, action: 'SUPER', createdAt: { gte: week } } }),
  ]);
  return {
    premium,
    likesLeft: premium ? null : Math.max(0, LIMITS.freeLikesPerDay - likes),
    likesResetAt: new Date(day.getTime() + DAY_MS).toISOString(),
    superLeft: Math.max(0, LIMITS.superPerWeek[premium ? 'premium' : 'free'] - supers),
    superResetAt: new Date(week.getTime() + 7 * DAY_MS).toISOString(),
  };
}

const tooMany = (code: string, message: string, resetsAt: Date | string, extra?: object) =>
  new AppError(429, code, message, { resetsAt: typeof resetsAt === 'string' ? resetsAt : resetsAt.toISOString(), ...extra });

/**
 * Checks every rule for one more swipe and returns the quota as it will be after it.
 * Throws 429 `swipe_rate_limited` (per minute / hour) or `swipe_limit_reached` (daily Likes, weekly Super Likes).
 */
export async function checkSwipe(tx: Tx, userId: string, premiumUntil: Date | null, action: 'LIKE' | 'PASS' | 'SUPER', now = new Date()) {
  const minuteAgo = new Date(now.getTime() - 60_000);
  const hourAgo = new Date(now.getTime() - 3600_000);
  const lastHour = await tx.swipeEvent.findMany({
    where: { userId, createdAt: { gte: hourAgo } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  if (lastHour.length >= LIMITS.perHour) {
    await noteLimitHit(userId, 'swipes_per_hour');
    throw tooMany('swipe_rate_limited', 'Too many swipes this hour, try again later', new Date(lastHour[0]!.createdAt.getTime() + 3600_000));
  }
  const lastMinute = lastHour.filter((e) => e.createdAt >= minuteAgo);
  if (lastMinute.length >= LIMITS.perMinute) {
    await noteLimitHit(userId, 'swipes_per_minute');
    throw tooMany('swipe_rate_limited', 'Slow down a little', new Date(lastMinute[0]!.createdAt.getTime() + 60_000));
  }

  const quota = await readQuota(tx, userId, premiumUntil, now);
  if (action === 'LIKE' && quota.likesLeft === 0) {
    throw tooMany('swipe_limit_reached', "You've used today's Likes", quota.likesResetAt, { kind: 'like', quota });
  }
  if (action === 'SUPER' && quota.superLeft === 0) {
    throw tooMany('swipe_limit_reached', "You've used this week's Super Likes", quota.superResetAt, { kind: 'super', quota });
  }
  if (action === 'LIKE' && quota.likesLeft !== null) quota.likesLeft -= 1;
  if (action === 'SUPER') quota.superLeft -= 1;
  return quota;
}

// ── Bot signals ────────────────────────────────────────────────────────────────

/** Limit hits in one day before the account is flagged. */
const HITS_BEFORE_FLAG = 3;

/** The 429 rolls the swipe transaction back, so the note is written outside it (best effort). */
async function noteLimitHit(userId: string, reason: string) {
  try {
    await prisma.abuseEvent.create({ data: { userId, kind: 'RATE_LIMIT_HIT', reason } });
    const hits = await prisma.abuseEvent.count({
      where: { userId, kind: 'RATE_LIMIT_HIT', createdAt: { gte: startOfDayWib() } },
    });
    if (hits >= HITS_BEFORE_FLAG) await flag(prisma, userId, `hit swipe limits ${hits} times today`);
  } catch (err) {
    logger.warn({ err }, 'Could not record a rate limit hit');
  }
}

/** Marks an account for review and hides it from Discover. Never blocks it. Only the first flag is recorded. */
export async function flag(db: Pick<Tx, 'profile' | 'abuseEvent'>, userId: string, reason: string) {
  const { count } = await db.profile.updateMany({ where: { userId, flaggedForReview: false }, data: { flaggedForReview: true } });
  if (!count) return;
  await db.abuseEvent.create({ data: { userId, kind: 'FLAGGED', reason } });
  logger.warn({ userId, reason }, 'Account flagged for review');
}

/** Swipes with gaps this even (relative spread) look scripted. */
const EVEN_GAPS = { swipes: 50, maxSpread: 0.05 };
/** Liking nearly everyone over a long run looks like a bot farming matches. */
const LIKE_ALL = { swipes: 200, ratio: 0.95 };

/** Looks at the latest swipes for machine-like patterns; flags the account when one shows. */
export async function checkSwipePatterns(tx: Tx, userId: string) {
  const recent = await tx.swipeEvent.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: LIKE_ALL.swipes,
    select: { action: true, createdAt: true },
  });

  if (recent.length >= EVEN_GAPS.swipes) {
    const times = recent.slice(0, EVEN_GAPS.swipes).map((e) => e.createdAt.getTime());
    const gaps = times.slice(1).map((t, i) => times[i]! - t);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    if (mean > 0 && sd / mean < EVEN_GAPS.maxSpread) {
      await flag(tx, userId, `${EVEN_GAPS.swipes} swipes with evenly spaced gaps (~${Math.round(mean)} ms)`);
      return;
    }
  }
  if (recent.length >= LIKE_ALL.swipes) {
    const likes = recent.filter((e) => e.action !== 'PASS').length;
    if (likes / recent.length > LIKE_ALL.ratio) {
      await flag(tx, userId, `liked ${likes} of the last ${recent.length} profiles`);
    }
  }
}

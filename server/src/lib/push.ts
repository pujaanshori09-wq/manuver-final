import { isTest } from '../config/env.js';
import { logger } from './logger.js';
import { prisma } from './prisma.js';

/**
 * Push notifications through the Expo push service, sent only by the server (the app never
 * sends pushes itself, so nobody can spam another person's phone).
 */
export type Push = {
  title: string;
  body: string;
  /** Where a tap should lead, e.g. { type: 'message', matchId }. */
  data: Record<string, string>;
};

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100; // Expo accepts up to 100 messages per request

/** In tests nothing leaves the process: pushes are collected here instead. */
export const testOutbox: (Push & { userId: string })[] = [];

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/**
 * Sends one push per person, written in that person's app language. Never throws and is not
 * awaited by callers: a push failing must not fail the message or swipe that caused it.
 */
export function notify(userIds: string[], build: (language: string | null) => Push) {
  send(userIds, build).catch((err) => logger.warn({ err }, 'Push failed'));
}

async function send(userIds: string[], build: (language: string | null) => Push) {
  if (!userIds.length) return;
  const rows = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true, userId: true, user: { select: { profile: { select: { language: true } } } } },
  });
  const messages = rows.map((r) => ({ to: r.token, userId: r.userId, ...build(r.user.profile?.language ?? null) }));

  if (isTest) {
    // Record one entry per person, whatever their number of phones.
    for (const id of userIds) {
      const m = messages.find((x) => x.userId === id);
      if (m) testOutbox.push({ userId: id, title: m.title, body: m.body, data: m.data });
    }
    return;
  }

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const res = await fetch(EXPO_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map(({ to, title, body, data }) => ({ to, title, body, data, sound: 'default' }))),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Expo push rejected the batch');
      continue;
    }
    // Uninstalled apps answer DeviceNotRegistered: forget those tokens.
    const { data } = (await res.json()) as { data?: Ticket[] };
    const dead = (data ?? []).flatMap((t, k) => (t.details?.error === 'DeviceNotRegistered' ? [batch[k]!.to] : []));
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  }
}

/** Expo push tokens look like ExponentPushToken[xxxxxxxx] (or ExpoPushToken[...]). */
export const PUSH_TOKEN_RE = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export async function savePushToken(userId: string, token: string) {
  // One phone, one account: signing in as someone else moves the token.
  await prisma.pushToken.upsert({ where: { token }, create: { token, userId }, update: { userId } });
}

export async function removePushToken(userId: string, token: string) {
  await prisma.pushToken.deleteMany({ where: { token, userId } });
}

import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { CreateEventBody, CreateSessionBody, CreateSosBody } from './explore.schemas.js';

/**
 * Explore: open sparring sessions, SOS ("one player short") and events. The rules that used to
 * live in Supabase triggers and RPCs are here, inside transactions.
 */

type Tx = Prisma.TransactionClient;

/** Everyone I blocked or who blocked me: their posts are hidden from me. */
async function hiddenFor(userId: string) {
  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return [...new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)))];
}

const creatorSelect = {
  id: true,
  profile: { select: { name: true } },
  photos: { orderBy: { position: 'asc' as const }, take: 1, select: { storageKey: true } },
};
const creatorView = (u: { id: string; profile: { name: string } | null; photos: { storageKey: string }[] }) => ({
  id: u.id,
  name: u.profile?.name ?? '',
  photoUrl: u.photos[0] ? storage.url(u.photos[0].storageKey) : null,
});

/** One writer at a time per row (join, claim, register), so counts never go over the limit. */
const lock = (tx: Tx, key: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;

const sportFilter = (sport?: string) => (sport ? { sport: { equals: sport, mode: 'insensitive' as const } } : {});

// ── Open sparring sessions ─────────────────────────────────────────────────────

/** A session stays listed until two hours after it starts. */
const SESSION_GRACE_MS = 2 * 3600_000;

export async function listSessions(userId: string, sport?: string) {
  const hidden = await hiddenFor(userId);
  const rows = await prisma.openSession.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      scheduledAt: { gt: new Date(Date.now() - SESSION_GRACE_MS) },
      creatorId: { notIn: hidden },
      ...sportFilter(sport),
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      sport: true,
      title: true,
      venueName: true,
      scheduledAt: true,
      slotsTotal: true,
      genderPref: true,
      skillNote: true,
      status: true,
      creator: { select: creatorSelect },
      participants: { select: { userId: true } },
    },
  });
  return rows.map(({ participants, creator, ...s }) => ({
    ...s,
    creator: creatorView(creator),
    slotsFilled: participants.length,
    isJoined: participants.some((p) => p.userId === userId),
    isMine: creator.id === userId,
  }));
}

export async function createSession(userId: string, input: z.infer<typeof CreateSessionBody>) {
  const open = await prisma.openSession.count({
    where: { creatorId: userId, status: { in: ['OPEN', 'FULL'] }, scheduledAt: { gt: new Date() } },
  });
  if (open >= 5) throw conflict('too_many_sessions', 'You already host 5 upcoming sessions');
  // The host is the first player.
  const session = await prisma.openSession.create({
    data: {
      creatorId: userId,
      sport: input.sport,
      title: input.title,
      venueName: input.venueName,
      scheduledAt: new Date(input.scheduledAt),
      slotsTotal: input.slotsTotal,
      genderPref: input.genderPref,
      skillNote: input.skillNote || null,
      participants: { create: { userId } },
    },
    select: { id: true },
  });
  return session;
}

const WANTS = { MEN: 'MALE', WOMEN: 'FEMALE' } as const;

export async function joinSession(userId: string, sessionId: string) {
  const hidden = await hiddenFor(userId);
  await prisma.$transaction(async (tx) => {
    await lock(tx, `session:${sessionId}`);
    const s = await tx.openSession.findUnique({
      where: { id: sessionId },
      select: { creatorId: true, status: true, scheduledAt: true, slotsTotal: true, genderPref: true, _count: { select: { participants: true } } },
    });
    if (!s || hidden.includes(s.creatorId)) throw notFound('session_not_found', 'Session not found');
    const already = await tx.sessionParticipant.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
    if (already) return;
    if (s.status === 'CANCELLED' || s.status === 'COMPLETED' || s.scheduledAt < new Date()) {
      throw conflict('session_closed', 'This session is no longer open');
    }
    if (s._count.participants >= s.slotsTotal) throw conflict('session_full', 'This session is full');
    if (s.genderPref !== 'ALL') {
      const me = await tx.profile.findUnique({ where: { userId }, select: { gender: true } });
      if (me?.gender !== WANTS[s.genderPref]) throw forbidden('gender_mismatch', 'This session is for another group');
    }
    await tx.sessionParticipant.create({ data: { sessionId, userId } });
    if (s._count.participants + 1 >= s.slotsTotal) await tx.openSession.update({ where: { id: sessionId }, data: { status: 'FULL' } });
  });
}

export async function leaveSession(userId: string, sessionId: string) {
  await prisma.$transaction(async (tx) => {
    await lock(tx, `session:${sessionId}`);
    const s = await tx.openSession.findUnique({ where: { id: sessionId }, select: { creatorId: true, status: true } });
    if (!s) throw notFound('session_not_found', 'Session not found');
    if (s.creatorId === userId) throw badRequest('host_cannot_leave', 'Cancel the session instead');
    const { count } = await tx.sessionParticipant.deleteMany({ where: { sessionId, userId } });
    if (count && s.status === 'FULL') await tx.openSession.update({ where: { id: sessionId }, data: { status: 'OPEN' } });
  });
}

export async function cancelSession(userId: string, sessionId: string) {
  const { count } = await prisma.openSession.updateMany({
    where: { id: sessionId, creatorId: userId, status: { in: ['OPEN', 'FULL'] } },
    data: { status: 'CANCELLED' },
  });
  if (!count) throw notFound('session_not_found', 'Session not found');
}

// ── SOS ────────────────────────────────────────────────────────────────────────

/** A post disappears this long after the game starts. */
const SOS_AFTER_PLAY_MS = 2 * 3600_000;
const SOS_DEFAULT_LEAD_MS = 2 * 3600_000;

export async function listSos(userId: string) {
  const hidden = await hiddenFor(userId);
  const rows = await prisma.emergencySlot.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: new Date() }, creatorId: { notIn: hidden } },
    orderBy: { playTime: 'asc' },
    take: 10,
    select: {
      id: true,
      sport: true,
      venueName: true,
      playTime: true,
      slotsNeeded: true,
      feePerPerson: true,
      note: true,
      creator: { select: creatorSelect },
      claims: { select: { userId: true } },
    },
  });
  // The WhatsApp number is never listed: only someone who claims a spot gets it.
  return rows.map(({ claims, creator, slotsNeeded, ...s }) => ({
    ...s,
    creator: creatorView(creator),
    slotsLeft: Math.max(0, slotsNeeded - claims.length),
    slotsNeeded,
    claimedByMe: claims.some((c) => c.userId === userId),
    isMine: creator.id === userId,
  }));
}

export async function createSos(userId: string, input: z.infer<typeof CreateSosBody>) {
  const active = await prisma.emergencySlot.count({ where: { creatorId: userId, status: 'ACTIVE', expiresAt: { gt: new Date() } } });
  if (active >= 3) throw conflict('too_many_sos', 'You already have 3 SOS posts up');
  const playTime = input.playTime ? new Date(input.playTime) : new Date(Date.now() + SOS_DEFAULT_LEAD_MS);
  return prisma.emergencySlot.create({
    data: {
      creatorId: userId,
      sport: input.sport,
      venueName: input.venueName,
      playTime,
      expiresAt: new Date(playTime.getTime() + SOS_AFTER_PLAY_MS),
      slotsNeeded: input.slotsNeeded,
      feePerPerson: input.feePerPerson,
      contactWa: input.contactWa,
      note: input.note || null,
    },
    select: { id: true },
  });
}

/** Takes one spot; the answer carries the host's WhatsApp number. */
export async function claimSos(userId: string, slotId: string) {
  const hidden = await hiddenFor(userId);
  return prisma.$transaction(async (tx) => {
    await lock(tx, `sos:${slotId}`);
    const slot = await tx.emergencySlot.findUnique({
      where: { id: slotId },
      select: { creatorId: true, status: true, expiresAt: true, slotsNeeded: true, contactWa: true, _count: { select: { claims: true } } },
    });
    if (!slot || hidden.includes(slot.creatorId)) throw notFound('sos_not_found', 'This post is gone');
    if (slot.creatorId === userId) throw badRequest('own_slot', 'This is your own post');
    const mine = await tx.emergencySlotClaim.findUnique({ where: { slotId_userId: { slotId, userId } } });
    if (mine) throw conflict('already_claimed', 'You already took a spot here');
    if (slot.status !== 'ACTIVE' || slot.expiresAt < new Date() || slot._count.claims >= slot.slotsNeeded) {
      throw conflict('sos_unavailable', 'Every spot is taken');
    }
    await tx.emergencySlotClaim.create({ data: { slotId, userId } });
    if (slot._count.claims + 1 >= slot.slotsNeeded) await tx.emergencySlot.update({ where: { id: slotId }, data: { status: 'FILLED' } });
    return { contactWa: slot.contactWa };
  });
}

export async function cancelSos(userId: string, slotId: string) {
  const { count } = await prisma.emergencySlot.updateMany({
    where: { id: slotId, creatorId: userId, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });
  if (!count) throw notFound('sos_not_found', 'This post is gone');
}

// ── Events ─────────────────────────────────────────────────────────────────────

const eventSelect = {
  id: true,
  creatorId: true,
  title: true,
  organizer: true,
  type: true,
  category: true,
  startsAt: true,
  location: true,
  city: true,
  priceIdr: true,
  quota: true,
  imageUrl: true,
  isFeatured: true,
  status: true,
  _count: { select: { registrations: true } },
} as const;

type EventRow = Prisma.EventGetPayload<{ select: typeof eventSelect }>;

const eventView = ({ _count, creatorId, ...e }: EventRow, userId: string, registered: boolean) => ({
  ...e,
  registrations: _count.registrations,
  isMine: creatorId === userId,
  isRegistered: registered,
});

/** Approved upcoming events, plus my own while they wait for approval. */
export async function listEvents(userId: string) {
  const rows = await prisma.event.findMany({
    where: {
      startsAt: { gt: new Date() },
      OR: [{ status: 'APPROVED' }, { creatorId: userId, status: 'PENDING' }],
    },
    orderBy: [{ isFeatured: 'desc' }, { startsAt: 'asc' }],
    take: 100,
    select: { ...eventSelect, registrations: { where: { userId }, select: { userId: true } } },
  });
  return rows.map(({ registrations, ...e }) => eventView(e, userId, registrations.length > 0));
}

export async function getEvent(userId: string, eventId: string) {
  const e = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ...eventSelect, registrations: { where: { userId }, select: { userId: true } } },
  });
  // Pending or rejected events are visible to their creator only.
  if (!e || (e.status !== 'APPROVED' && e.creatorId !== userId)) throw notFound('event_not_found', 'Event not found');
  const { registrations, ...rest } = e;
  return eventView(rest, userId, registrations.length > 0);
}

export async function createEvent(userId: string, input: z.infer<typeof CreateEventBody>) {
  const pending = await prisma.event.count({ where: { creatorId: userId, status: 'PENDING' } });
  if (pending >= 3) throw conflict('too_many_pending', 'Wait until your other events are reviewed');
  // Every new event waits for review (Prisma Studio for the MVP).
  const e = await prisma.event.create({
    data: {
      creatorId: userId,
      title: input.title,
      organizer: input.organizer,
      type: input.type,
      category: input.category,
      startsAt: new Date(input.startsAt),
      location: input.location,
      city: input.city,
      priceIdr: input.priceIdr,
      quota: input.quota ?? null,
      imageUrl: input.imageUrl ?? null,
    },
    select: { id: true },
  });
  return getEvent(userId, e.id);
}

export async function registerForEvent(userId: string, eventId: string) {
  await prisma.$transaction(async (tx) => {
    await lock(tx, `event:${eventId}`);
    const e = await tx.event.findUnique({
      where: { id: eventId },
      select: { status: true, startsAt: true, quota: true, _count: { select: { registrations: true } } },
    });
    if (!e || e.status !== 'APPROVED') throw notFound('event_not_found', 'Event not found');
    const already = await tx.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (already) return;
    if (e.startsAt < new Date()) throw conflict('event_started', 'Registration has closed');
    if (e.quota !== null && e._count.registrations >= e.quota) throw conflict('event_full', 'This event is full');
    await tx.eventRegistration.create({ data: { eventId, userId } });
  });
  return getEvent(userId, eventId);
}

export async function unregisterFromEvent(userId: string, eventId: string) {
  await prisma.eventRegistration.deleteMany({ where: { eventId, userId } });
  return getEvent(userId, eventId);
}

import type { z } from 'zod';
import { badRequest, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { ReportBody } from './safety.schemas.js';

/**
 * Blocking hides both people from each other everywhere: Discover, chats, profiles, activities
 * (those modules already check the blocks table). The match stays in the database, so
 * unblocking brings the chat back as it was.
 */
export async function block(userId: string, targetId: string) {
  if (userId === targetId) throw badRequest('invalid_target', 'You cannot block yourself');
  const exists = await prisma.user.count({ where: { id: targetId } });
  if (!exists) throw notFound('user_not_found', 'Player not found');
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetId } },
    create: { blockerId: userId, blockedId: targetId },
    update: {},
  });
}

export async function unblock(userId: string, targetId: string) {
  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
}

/** People I blocked, for the settings screen (newest first). */
export async function listBlocked(userId: string) {
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      blocked: {
        select: {
          id: true,
          profile: { select: { name: true } },
          photos: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.blocked.id,
    name: r.blocked.profile?.name ?? '',
    photoUrl: r.blocked.photos[0] ? storage.url(r.blocked.photos[0].storageKey) : null,
    blockedAt: r.createdAt,
  }));
}

/**
 * Files a report for review (Prisma Studio for the MVP). The reported account's email is kept
 * with it, so the report survives that account being deleted and a re-registration can be spotted.
 * Several reports from the same person about the same player within a day count as one.
 */
export async function report(userId: string, input: z.infer<typeof ReportBody>) {
  if (userId === input.userId) throw badRequest('invalid_target', 'You cannot report yourself');
  const target = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (!target) throw notFound('user_not_found', 'Player not found');

  const recent = await prisma.report.findFirst({
    where: { reporterId: userId, reportedId: input.userId, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    select: { id: true },
  });
  if (recent) return { id: recent.id };

  const row = await prisma.report.create({
    data: {
      reporterId: userId,
      reportedId: input.userId,
      reportedEmail: target.email,
      reason: input.reason,
      details: input.details || null,
    },
    select: { id: true },
  });
  return row;
}

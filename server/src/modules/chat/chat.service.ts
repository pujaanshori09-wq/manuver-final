import type { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { SendMessageBody } from './chat.schemas.js';

/** shortcut: a chat returns its latest 200 messages, no paging; add `before=` paging when chats get long. */
const HISTORY = 200;

const messageSelect = {
  id: true,
  matchId: true,
  senderId: true,
  type: true,
  content: true,
  invite: true,
  inviteStatus: true,
  clientId: true,
  createdAt: true,
} as const;

/** The match, if `userId` is in it and neither person has blocked the other; otherwise 404. */
async function matchFor(userId: string, matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { id: true, userAId: true, userBId: true } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) throw notFound('match_not_found', 'Chat not found');
  const partnerId = match.userAId === userId ? match.userBId : match.userAId;
  const blocked = await prisma.block.count({
    where: { OR: [{ blockerId: userId, blockedId: partnerId }, { blockerId: partnerId, blockedId: userId }] },
  });
  if (blocked) throw notFound('match_not_found', 'Chat not found');
  return { ...match, partnerId };
}

export async function listMatches(userId: string) {
  const matches = await prisma.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
      // Hide chats with anyone either side has blocked.
      NOT: {
        OR: [
          { userA: { blocksMade: { some: { blockedId: userId } } } },
          { userB: { blocksMade: { some: { blockedId: userId } } } },
          { userA: { blocksReceived: { some: { blockerId: userId } } } },
          { userB: { blocksReceived: { some: { blockerId: userId } } } },
        ],
      },
    },
    select: {
      id: true,
      userAId: true,
      createdAt: true,
      lastMessageAt: true,
      userA: { select: { id: true, profile: { select: { name: true } }, photos: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } } } },
      userB: { select: { id: true, profile: { select: { name: true } }, photos: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } } } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, type: true, senderId: true, createdAt: true } },
      _count: { select: { messages: { where: { senderId: { not: userId }, readAt: null } } } },
    },
  });

  return matches
    .map((m) => {
      const partner = m.userAId === userId ? m.userB : m.userA;
      const photo = partner.photos[0];
      return {
        id: m.id,
        createdAt: m.createdAt,
        partner: { id: partner.id, name: partner.profile?.name ?? '', photoUrl: photo ? storage.url(photo.storageKey) : null },
        lastMessage: m.messages[0] ?? null,
        unreadCount: m._count.messages,
      };
    })
    .sort((a, b) => +(b.lastMessage?.createdAt ?? b.createdAt) - +(a.lastMessage?.createdAt ?? a.createdAt));
}

export async function listMessages(userId: string, matchId: string) {
  await matchFor(userId, matchId);
  const latest = await prisma.message.findMany({
    where: { matchId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY,
    select: messageSelect,
  });
  // Opening the chat reads everything the other person sent.
  await prisma.message.updateMany({ where: { matchId, senderId: { not: userId }, readAt: null }, data: { readAt: new Date() } });
  return latest.reverse();
}

export async function sendMessage(userId: string, matchId: string, body: z.infer<typeof SendMessageBody>) {
  await matchFor(userId, matchId);

  // A retried send (same clientId) returns what was stored the first time.
  const existing = await prisma.message.findUnique({
    where: { senderId_clientId: { senderId: userId, clientId: body.clientId } },
    select: messageSelect,
  });
  if (existing) {
    if (existing.matchId !== matchId) throw conflict('client_id_reused', 'That message id was already used');
    return existing;
  }

  try {
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          matchId,
          senderId: userId,
          clientId: body.clientId,
          type: body.type,
          content: body.content,
          ...(body.type === 'SPARING_INVITE'
            ? { invite: { ...body.invite, note: body.invite.note ?? null }, inviteStatus: 'PENDING' as const }
            : {}),
        },
        select: messageSelect,
      }),
      prisma.match.update({ where: { id: matchId }, data: { lastMessageAt: new Date() } }),
    ]);
    return message;
  } catch (e) {
    // Two copies of the same retry raced each other; the first one won.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return prisma.message.findUniqueOrThrow({
        where: { senderId_clientId: { senderId: userId, clientId: body.clientId } },
        select: messageSelect,
      });
    }
    throw e;
  }
}

export async function respondToInvite(userId: string, messageId: string, status: 'ACCEPTED' | 'DECLINED') {
  const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { matchId: true, senderId: true, type: true } });
  if (!msg) throw notFound('message_not_found', 'Message not found');
  await matchFor(userId, msg.matchId);
  if (msg.type !== 'SPARING_INVITE') throw badRequest('not_an_invite', 'Only sparing invites can be answered');
  if (msg.senderId === userId) throw forbidden('own_invite', 'You cannot answer your own invite');

  // Only a pending invite can be answered, and only once, even if both taps race.
  const { count } = await prisma.message.updateMany({
    where: { id: messageId, inviteStatus: 'PENDING' },
    data: { inviteStatus: status, respondedAt: new Date() },
  });
  if (!count) throw conflict('already_answered', 'This invite was already answered');
  return prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: messageSelect });
}

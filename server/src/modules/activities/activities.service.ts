import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { publicOrigin } from '../../lib/email.js';
import { decode, encode, trimEnds } from '../../lib/polyline.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { CreateActivityBody, ListQuery, UpdateActivityBody } from './activities.schemas.js';

/** Agreed privacy zone: others never see the first and last 200 m of a route. */
const PRIVACY_M = 200;

const select = {
  id: true,
  userId: true,
  type: true,
  title: true,
  startedAt: true,
  endedAt: true,
  movingSec: true,
  distanceM: true,
  polyline: true,
  showOnProfile: true,
  isPublic: true,
  publicSlug: true,
  createdAt: true,
  clientId: true,
} as const;

/** 9 random bytes → 12 url-safe characters (72 bits), so links cannot be guessed. */
const newSlug = () => randomBytes(9).toString('base64url');

export const publicUrl = (slug: string) => `${publicOrigin()}/a/${slug}`;

type Row = Prisma.ActivityGetPayload<{ select: typeof select }>;

/** Owner sees everything; anyone else gets the trimmed route and no client id. */
function view(a: Row, viewerId: string) {
  const own = a.userId === viewerId;
  return {
    id: a.id,
    userId: a.userId,
    type: a.type,
    title: a.title,
    startedAt: a.startedAt,
    endedAt: a.endedAt,
    movingSec: a.movingSec,
    distanceM: a.distanceM,
    showOnProfile: a.showOnProfile,
    route: own ? a.polyline : encode(trimEnds(decode(a.polyline), PRIVACY_M)),
    // Only the owner learns whether a public link exists, and its address.
    ...(own
      ? { clientId: a.clientId, isPublic: a.isPublic, publicUrl: a.isPublic && a.publicSlug ? publicUrl(a.publicSlug) : null }
      : {}),
  };
}

export async function create(userId: string, body: z.infer<typeof CreateActivityBody>) {
  let points;
  try {
    points = decode(body.polyline);
  } catch {
    throw badRequest('invalid_route', 'The route could not be read');
  }
  if (points.length < 2 || points.some(([lat, lng]) => Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
    throw badRequest('invalid_route', 'The route could not be read');
  }

  const data = {
    userId,
    clientId: body.clientId,
    type: body.type,
    title: body.title,
    startedAt: new Date(body.startedAt),
    endedAt: new Date(body.endedAt),
    movingSec: body.movingSec,
    distanceM: body.distanceM,
    polyline: body.polyline,
    showOnProfile: body.showOnProfile,
  };
  try {
    return view(await prisma.activity.create({ data, select }), userId);
  } catch (e) {
    // The same recording uploaded twice (retry after a dropped connection): return the first copy.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const existing = await prisma.activity.findUniqueOrThrow({
        where: { userId_clientId: { userId, clientId: body.clientId } },
        select,
      });
      return view(existing, userId);
    }
    throw e;
  }
}

export async function listMine(userId: string, q: z.infer<typeof ListQuery>) {
  const rows = await prisma.activity.findMany({
    where: {
      userId,
      ...(q.onProfile ? { showOnProfile: true } : {}),
      ...(q.before ? { startedAt: { lt: new Date(q.before) } } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: q.limit,
    select,
  });
  return rows.map((a) => view(a, userId));
}

/** A matched, unblocked player; anyone else looks like they do not exist. */
export async function requireMatched(viewerId: string, otherId: string) {
  if (viewerId === otherId) return;
  const [a, b] = viewerId < otherId ? [viewerId, otherId] : [otherId, viewerId];
  const [match, blocked] = await Promise.all([
    prisma.match.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } }, select: { id: true } }),
    prisma.block.count({
      where: { OR: [{ blockerId: viewerId, blockedId: otherId }, { blockerId: otherId, blockedId: viewerId }] },
    }),
  ]);
  if (!match || blocked) throw notFound('user_not_found', 'Player not found');
}

export async function listForUser(viewerId: string, userId: string, q: z.infer<typeof ListQuery>) {
  if (viewerId === userId) return listMine(viewerId, { ...q, onProfile: true });
  await requireMatched(viewerId, userId);
  const rows = await prisma.activity.findMany({
    where: { userId, showOnProfile: true, ...(q.before ? { startedAt: { lt: new Date(q.before) } } : {}) },
    orderBy: { startedAt: 'desc' },
    take: q.limit,
    select,
  });
  return rows.map((a) => view(a, viewerId));
}

export async function get(viewerId: string, id: string) {
  const a = await prisma.activity.findUnique({ where: { id }, select });
  if (!a) throw notFound('activity_not_found', 'Activity not found');
  if (a.userId !== viewerId) {
    if (!a.showOnProfile) throw notFound('activity_not_found', 'Activity not found');
    await requireMatched(viewerId, a.userId).catch(() => {
      throw notFound('activity_not_found', 'Activity not found');
    });
  }
  return view(a, viewerId);
}

export async function update(userId: string, id: string, patch: z.infer<typeof UpdateActivityBody>) {
  const data: Prisma.ActivityUpdateManyMutationInput = { ...patch };
  if (patch.isPublic) {
    // First time public: mint the link code. Switching off and on again keeps the same link.
    const current = await prisma.activity.findFirst({ where: { id, userId }, select: { publicSlug: true } });
    if (current && !current.publicSlug) data.publicSlug = newSlug();
  }
  const { count } = await prisma.activity.updateMany({ where: { id, userId }, data });
  if (!count) throw notFound('activity_not_found', 'Activity not found');
  return view(await prisma.activity.findUniqueOrThrow({ where: { id }, select }), userId);
}

export async function remove(userId: string, id: string) {
  const { count } = await prisma.activity.deleteMany({ where: { id, userId } });
  if (!count) throw notFound('activity_not_found', 'Activity not found');
}

function ageFrom(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

/** The profile a matched player sees (GET /users/:id). */
export async function publicProfile(viewerId: string, userId: string) {
  await requireMatched(viewerId, userId);
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      profile: {
        select: {
          name: true,
          birthDate: true,
          city: true,
          bio: true,
          skillLevel: true,
          job: true,
          lookingFor: true,
          preferredTime: true,
          homeVenue: true,
        },
      },
      photos: { orderBy: { position: 'asc' }, select: { storageKey: true } },
      sports: { orderBy: { createdAt: 'asc' }, select: { sportId: true, experienceLevel: true } },
      prompts: { orderBy: { position: 'asc' }, select: { answer: true, question: { select: { textEn: true, textId: true } } } },
    },
  });
  if (!u?.profile) throw notFound('user_not_found', 'Player not found');
  const p = u.profile;
  return {
    id: u.id,
    name: p.name,
    age: ageFrom(p.birthDate),
    city: p.city,
    bio: p.bio,
    skillLevel: p.skillLevel,
    job: p.job,
    lookingFor: p.lookingFor,
    preferredTime: p.preferredTime,
    homeVenue: p.homeVenue,
    photos: u.photos.map((ph) => storage.url(ph.storageKey)),
    sports: u.sports,
    prompts: u.prompts.map((pr) => ({ question: { en: pr.question.textEn, id: pr.question.textId }, answer: pr.answer })),
    activities: await listForUser(viewerId, userId, { limit: 3, onProfile: true }),
  };
}


/** What anyone with the link sees: no account data beyond a first name, and the route ends trimmed. */
export async function getPublic(slug: string) {
  const a = await prisma.activity.findUnique({
    where: { publicSlug: slug },
    select: {
      ...select,
      user: { select: { profile: { select: { name: true } } } },
    },
  });
  if (!a || !a.isPublic) return null;
  return {
    type: a.type,
    title: a.title,
    startedAt: a.startedAt,
    movingSec: a.movingSec,
    distanceM: a.distanceM,
    firstName: (a.user.profile?.name ?? '').trim().split(/\s+/)[0] ?? '',
    route: trimEnds(decode(a.polyline), PRIVACY_M),
  };
}

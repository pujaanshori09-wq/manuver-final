import type { z } from 'zod';
import { badRequest, notFound, unauthorized } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { OnboardingBody, ProfilePatchBody, SportsBody } from './me.schemas.js';

export const MAX_PHOTOS = 4;

function ageFrom(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

/** Everything the signed-in user may see about themselves. */
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
     
      emailVerified: true,
      passwordHash: true,
      googleId: true,
      profile: true,
      photos: { orderBy: { position: 'asc' }, select: { id: true, storageKey: true, position: true } },
      sports: { orderBy: { createdAt: 'asc' }, select: { sportId: true, experienceLevel: true } },
      prompts: {
        orderBy: { position: 'asc' },
        select: { questionId: true, answer: true, position: true, question: { select: { textEn: true, textId: true } } },
      },
      _count: { select: { sessionJoins: true, matchesA: true, matchesB: true } },
    },
  });
  if (!user || !user.profile) throw unauthorized('user_not_found', 'Account no longer exists');
  const p = user.profile;

  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    hasPassword: !!user.passwordHash,
    hasGoogle: !!user.googleId,
    profile: {
      name: p.name,
      language: p.language,
      birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null,
      age: ageFrom(p.birthDate),
      gender: p.gender,
      bio: p.bio,
      lookingFor: p.lookingFor,
      skillLevel: p.skillLevel,
      job: p.job,
      education: p.education,
      city: p.city,
      heightCm: p.heightCm,
      workoutStyle: p.workoutStyle,
      preferredTime: p.preferredTime,
      playFrequency: p.playFrequency,
      homeVenue: p.homeVenue,
      availability: p.availability,
      ageMin: p.ageMin,
      ageMax: p.ageMax,
      genderPreference: p.genderPreference,
      maxDistanceKm: p.maxDistanceKm,
      ghostMode: p.ghostMode,
      hasLocation: p.latitude !== null && p.longitude !== null,
      termsAccepted: !!p.termsAcceptedAt,
      onboardingCompleted: !!p.onboardingCompletedAt,
    },
    photos: user.photos.map((ph) => ({ id: ph.id, url: storage.url(ph.storageKey), position: ph.position })),
    sports: user.sports,
    prompts: user.prompts.map((pr) => ({
      questionId: pr.questionId,
      question: { en: pr.question.textEn, id: pr.question.textId },
      answer: pr.answer,
      position: pr.position,
    })),
    stats: {
      sessionsJoined: user._count.sessionJoins,
      matches: user._count.matchesA + user._count.matchesB,
    },
  };
}

export type Me = Awaited<ReturnType<typeof getMe>>;

export async function updateProfile(userId: string, patch: z.infer<typeof ProfilePatchBody>) {
  // A partial patch can still produce an inverted range against the stored values.
  if (patch.ageMin !== undefined || patch.ageMax !== undefined) {
    const current = await prisma.profile.findUniqueOrThrow({ where: { userId }, select: { ageMin: true, ageMax: true } });
    const min = patch.ageMin ?? current.ageMin;
    const max = patch.ageMax ?? current.ageMax;
    if (min > max) throw badRequest('invalid_age_range', 'ageMin must be at most ageMax');
  }
  await prisma.profile.update({ where: { userId }, data: patch });
  return getMe(userId);
}

/** Rows from one createMany share a timestamp; 1 ms steps keep the user's order (sports are read by createdAt). */
const inOrder = (i: number) => new Date(Date.now() + i);

export async function replaceSports(userId: string, sports: z.infer<typeof SportsBody>['sports']) {
  const unique = [...new Map(sports.map((s) => [s.sportId.toLowerCase(), s])).values()];
  await prisma.$transaction([
    prisma.userSport.deleteMany({ where: { userId } }),
    prisma.userSport.createMany({
      data: unique.map((s, i) => ({ userId, sportId: s.sportId.toLowerCase(), experienceLevel: s.experienceLevel ?? null, createdAt: inOrder(i) })),
    }),
  ]);
  return getMe(userId);
}

export async function updateLocation(userId: string, latitude: number, longitude: number) {
  await prisma.profile.update({
    where: { userId },
    data: { latitude, longitude, locationUpdatedAt: new Date() },
  });
}

/** Finishes onboarding in one transaction (the old complete_user_onboarding RPC). */
export async function completeOnboarding(userId: string, input: z.infer<typeof OnboardingBody>) {
  const now = new Date();
  const sports = [...new Map(input.sports.map((s) => [s.sportId.toLowerCase(), s])).values()];
  await prisma.$transaction([
    prisma.profile.update({
      where: { userId },
      data: {
        name: input.name,
        birthDate: new Date(`${input.birthDate}T00:00:00Z`),
        gender: input.gender,
        language: input.language,
        genderPreference: input.genderPreference,
        ageMin: input.ageMin,
        ageMax: input.ageMax,
        termsAcceptedAt: now,
        onboardingCompletedAt: now,
        ...(input.location
          ? { latitude: input.location.latitude, longitude: input.location.longitude, locationUpdatedAt: now }
          : {}),
      },
    }),
    prisma.userSport.deleteMany({ where: { userId } }),
    prisma.userSport.createMany({
      data: sports.map((s, i) => ({ userId, sportId: s.sportId.toLowerCase(), experienceLevel: s.experienceLevel ?? null, createdAt: inOrder(i) })),
    }),
  ]);
  return getMe(userId);
}

// ── Photos ─────────────────────────────────────────────────────────────────────

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
export const ALLOWED_IMAGE_TYPES = Object.keys(EXT);

/** Checks the real file signature, not just the Content-Type the client claims. */
function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii');
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

export async function addPhoto(userId: string, file: { buffer: Buffer }) {
  const type = sniffImage(file.buffer);
  if (!type) throw badRequest('unsupported_image', 'Upload a JPEG, PNG, WebP or HEIC photo');

  const count = await prisma.profilePhoto.count({ where: { userId } });
  if (count >= MAX_PHOTOS) throw badRequest('too_many_photos', `You can have up to ${MAX_PHOTOS} photos`);

  const key = await storage.save(`users/${userId}`, file.buffer, EXT[type]!);
  try {
    await prisma.profilePhoto.create({ data: { userId, storageKey: key, position: count } });
  } catch (e) {
    await storage.remove(key); // don't leave orphan files behind
    throw e;
  }
  return getMe(userId);
}

export async function deletePhoto(userId: string, photoId: string) {
  const photo = await prisma.profilePhoto.findFirst({ where: { id: photoId, userId } });
  if (!photo) throw notFound('photo_not_found', 'Photo not found');

  await prisma.$transaction(async (tx) => {
    await tx.profilePhoto.delete({ where: { id: photo.id } });
    // Close the gap: positions stay 0..n-1. Move to a free range first to avoid the
    // (userId, position) unique constraint while shifting.
    const rest = await tx.profilePhoto.findMany({ where: { userId }, orderBy: { position: 'asc' } });
    for (const [i, p] of rest.entries()) await tx.profilePhoto.update({ where: { id: p.id }, data: { position: 100 + i } });
    for (const [i, p] of rest.entries()) await tx.profilePhoto.update({ where: { id: p.id }, data: { position: i } });
  });
  await storage.remove(photo.storageKey).catch((err) => logger.warn({ err }, 'Could not delete photo file'));
  return getMe(userId);
}

/** Reorders photos; ids must be exactly the user's photos. The first one is the main photo. */
export async function reorderPhotos(userId: string, ids: string[]) {
  const photos = await prisma.profilePhoto.findMany({ where: { userId }, select: { id: true } });
  const mine = new Set(photos.map((p) => p.id));
  if (ids.length !== mine.size || new Set(ids).size !== ids.length || !ids.every((id) => mine.has(id))) {
    throw badRequest('invalid_photo_order', 'The list must contain each of your photos exactly once');
  }
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of ids.entries()) await tx.profilePhoto.update({ where: { id }, data: { position: 100 + i } });
    for (const [i, id] of ids.entries()) await tx.profilePhoto.update({ where: { id }, data: { position: i } });
  });
  return getMe(userId);
}

// ── Prompts ────────────────────────────────────────────────────────────────────

export async function listQuestions() {
  const qs = await prisma.promptQuestion.findMany({ where: { isActive: true }, orderBy: { textEn: 'asc' } });
  return qs.map((q) => ({ id: q.id, category: q.category, text: { en: q.textEn, id: q.textId } }));
}

export async function replacePrompts(userId: string, prompts: { questionId: string; answer: string }[]) {
  if (prompts.length) {
    const active = await prisma.promptQuestion.count({
      where: { id: { in: prompts.map((p) => p.questionId) }, isActive: true },
    });
    if (active !== prompts.length) throw badRequest('unknown_question', 'One of the questions does not exist');
  }
  await prisma.$transaction([
    prisma.profilePrompt.deleteMany({ where: { userId } }),
    prisma.profilePrompt.createMany({
      data: prompts.map((p, i) => ({ userId, questionId: p.questionId, answer: p.answer, position: i })),
    }),
  ]);
  return getMe(userId);
}

// ── Account deletion ───────────────────────────────────────────────────────────

/** Deletes the account and everything that cascades from it, then the user's files. */
export async function deleteAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
  await storage.removePrefix(`users/${userId}`).catch((err) => logger.warn({ err }, 'Could not delete user files'));
}

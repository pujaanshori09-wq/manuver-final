import type { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { storage } from '../../lib/storage.js';
import type { DiscoverQuery } from './discover.schemas.js';

const EARTH_RADIUS_KM = 6371;
/** Candidates pulled from the database before the exact distance filter and sort. */
const CANDIDATE_POOL = 300;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function ageFrom(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

/** Someone aged exactly `age` today was born on or before this date. */
function bornOnOrBefore(age: number) {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear() - age, n.getUTCMonth(), n.getUTCDate()));
}

const WANTED_GENDER = { ALL: undefined, MEN: 'MALE', WOMEN: 'FEMALE' } as const;

async function requireOnboarded(userId: string) {
  const me = await prisma.profile.findUnique({
    where: { userId },
    select: {
      latitude: true,
      longitude: true,
      birthDate: true,
      gender: true,
      ageMin: true,
      ageMax: true,
      genderPreference: true,
      maxDistanceKm: true,
      onboardingCompletedAt: true,
    },
  });
  if (!me?.onboardingCompletedAt) throw forbidden('onboarding_required', 'Finish setting up your profile first');
  return me;
}

export async function discover(userId: string, q: z.infer<typeof DiscoverQuery>) {
  const me = await requireOnboarded(userId);
  const ageMin = q.ageMin ?? me.ageMin;
  const ageMax = q.ageMax ?? me.ageMax;
  const maxKm = q.maxDistanceKm ?? me.maxDistanceKm;
  const myAge = ageFrom(me.birthDate);
  const here = me.latitude !== null && me.longitude !== null ? { lat: me.latitude, lon: me.longitude } : null;

  const and: Prisma.ProfileWhereInput[] = [
    // They accept someone of my age and gender (preferences go both ways).
    ...(myAge !== null ? [{ ageMin: { lte: myAge } }, { ageMax: { gte: myAge } }] : []),
    {
      OR: [
        { genderPreference: 'ALL' as const },
        ...(me.gender === 'MALE' ? [{ genderPreference: 'MEN' as const }] : []),
        ...(me.gender === 'FEMALE' ? [{ genderPreference: 'WOMEN' as const }] : []),
      ],
    },
  ];

  // Cheap bounding box in the database; the exact distance is checked below.
  if (here) {
    const latDelta = maxKm / 111;
    const lonDelta = maxKm / (111 * Math.max(Math.cos((here.lat * Math.PI) / 180), 0.01));
    and.push({ latitude: { gte: here.lat - latDelta, lte: here.lat + latDelta } });
    and.push({ longitude: { gte: here.lon - lonDelta, lte: here.lon + lonDelta } });
  }

  const wantGender = WANTED_GENDER[me.genderPreference];

  const rows = await prisma.profile.findMany({
    where: {
      userId: { not: userId },
      onboardingCompletedAt: { not: null },
      ghostMode: false,
      flaggedForReview: false,
      birthDate: { lte: bornOnOrBefore(ageMin), gt: bornOnOrBefore(ageMax + 1) },
      ...(wantGender ? { gender: wantGender } : {}),
      AND: and,
      user: {
        swipesReceived: { none: { userId } },
        blocksMade: { none: { blockedId: userId } },
        blocksReceived: { none: { blockerId: userId } },
        ...(q.sports?.length ? { sports: { some: { sportId: { in: q.sports } } } } : {}),
      },
    },
    orderBy: { lastActiveAt: 'desc' },
    take: CANDIDATE_POOL,
    select: {
      userId: true,
      name: true,
      birthDate: true,
      gender: true,
      city: true,
      bio: true,
      lookingFor: true,
      skillLevel: true,
      job: true,
      education: true,
      heightCm: true,
      workoutStyle: true,
      preferredTime: true,
      playFrequency: true,
      homeVenue: true,
      availability: true,
      latitude: true,
      longitude: true,
      user: {
        select: {
          photos: { orderBy: { position: 'asc' }, select: { storageKey: true } },
          sports: { orderBy: { createdAt: 'asc' }, select: { sportId: true, experienceLevel: true } },
          prompts: {
            orderBy: { position: 'asc' },
            select: { answer: true, question: { select: { textEn: true, textId: true } } },
          },
        },
      },
    },
  });

  const items = rows
    .map((p) => {
      const km =
        here && p.latitude !== null && p.longitude !== null
          ? haversineKm(here.lat, here.lon, p.latitude, p.longitude)
          : null;
      return { p, km };
    })
    .filter(({ km }) => km === null || km <= maxKm)
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity))
    .slice(0, q.limit)
    .map(({ p, km }) => ({
      id: p.userId,
      name: p.name,
      age: ageFrom(p.birthDate),
      gender: p.gender,
      city: p.city,
      // Only a coarse, rounded-up distance ever leaves the server; coordinates never do.
      distanceKm: km === null ? null : Math.max(1, Math.ceil(km)),
      bio: p.bio,
      lookingFor: p.lookingFor,
      skillLevel: p.skillLevel,
      job: p.job,
      education: p.education,
      heightCm: p.heightCm,
      workoutStyle: p.workoutStyle,
      preferredTime: p.preferredTime,
      playFrequency: p.playFrequency,
      homeVenue: p.homeVenue,
      availability: p.availability,
      photos: p.user.photos.map((ph) => storage.url(ph.storageKey)),
      sports: p.user.sports,
      prompts: p.user.prompts.map((pr) => ({
        question: { en: pr.question.textEn, id: pr.question.textId },
        answer: pr.answer,
      })),
    }));

  return { items };
}

export async function swipe(userId: string, targetId: string, action: 'LIKE' | 'PASS' | 'SUPER') {
  if (userId === targetId) throw badRequest('invalid_target', 'You cannot swipe on yourself');
  await requireOnboarded(userId);

  const target = await prisma.profile.findUnique({
    where: { userId: targetId },
    select: {
      name: true,
      onboardingCompletedAt: true,
      user: {
        select: {
          photos: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
          blocksMade: { where: { blockedId: userId }, select: { blockerId: true } },
          blocksReceived: { where: { blockerId: userId }, select: { blockedId: true } },
        },
      },
    },
  });
  // A blocked (or blocking) account looks exactly like one that does not exist.
  if (!target?.onboardingCompletedAt || target.user.blocksMade.length || target.user.blocksReceived.length) {
    throw notFound('user_not_found', 'That player is not available');
  }

  const [userAId, userBId] = userId < targetId ? [userId, targetId] : [targetId, userId];

  const matchId = await prisma.$transaction(async (tx) => {
    // Two people liking each other at the same instant would otherwise each miss the other's swipe.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userAId + userBId}, 0))`;

    await tx.swipe.upsert({
      where: { userId_targetId: { userId, targetId } },
      create: { userId, targetId, action },
      update: { action },
    });
    if (action === 'PASS') return null;

    const theirs = await tx.swipe.findUnique({
      where: { userId_targetId: { userId: targetId, targetId: userId } },
      select: { action: true },
    });
    if (!theirs || theirs.action === 'PASS') return null;

    const match = await tx.match.upsert({
      where: { userAId_userBId: { userAId, userBId } },
      create: { userAId, userBId },
      update: {},
      select: { id: true },
    });
    return match.id;
  });

  return {
    isMatch: matchId !== null,
    matchId,
    partner: {
      id: targetId,
      name: target.name,
      photoUrl: target.user.photos[0] ? storage.url(target.user.photos[0].storageKey) : null,
    },
  };
}

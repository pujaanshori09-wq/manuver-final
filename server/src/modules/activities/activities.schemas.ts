import { z } from 'zod';

export const ActivityIdParams = z.object({ id: z.uuid() });
export const UserIdParams = z.object({ id: z.uuid() });

const DAY = 24 * 3600;

export const CreateActivityBody = z
  .object({
    clientId: z.uuid(),
    type: z.enum(['RUN', 'RIDE', 'HIKE']),
    title: z.string().trim().min(1).max(80),
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    // Too short to be worth saving (agreed minimum: 1 minute and 100 m).
    movingSec: z.number().int().min(60).max(DAY),
    distanceM: z.number().int().min(100).max(1_000_000),
    /** shortcut: one encoded string, capped at 200 KB (~25k points); simplify on the phone if longer routes appear. */
    polyline: z.string().min(2).max(200_000),
    /** Seconds since startedAt for each polyline point, used to check speeds. */
    pointTimes: z.array(z.number().int().min(0).max(2 * DAY)).min(2).max(30_000),
    /** Indices of points where recording resumed after a pause or a vehicle stretch. */
    segmentStarts: z.array(z.number().int().min(1)).max(5_000).default([]),
    showOnProfile: z.boolean(),
  })
  .refine((v) => new Date(v.endedAt) > new Date(v.startedAt), { message: 'endedAt must be after startedAt', path: ['endedAt'] })
  .refine((v) => (new Date(v.endedAt).getTime() - new Date(v.startedAt).getTime()) / 1000 >= v.movingSec - 5, {
    message: 'movingSec cannot exceed the elapsed time',
    path: ['movingSec'],
  });

export const UpdateActivityBody = z
  .object({ title: z.string().trim().min(1).max(80), showOnProfile: z.boolean(), isPublic: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Activities that started before this time (paging). */
  before: z.iso.datetime({ offset: true }).optional(),
  /** Only the ones shown on the profile. */
  onProfile: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

/** Public link codes are 12 url-safe characters. */
export const SlugParams = z.object({ slug: z.string().regex(/^[A-Za-z0-9_-]{12}$/) });

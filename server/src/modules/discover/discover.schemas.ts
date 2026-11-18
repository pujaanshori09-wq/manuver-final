import { z } from 'zod';
import { SportId } from '../me/me.schemas.js';

/** Query overrides come from the app's filter screen; anything omitted falls back to the saved profile preferences. */
export const DiscoverQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    maxDistanceKm: z.coerce.number().int().min(1).max(200).optional(),
    ageMin: z.coerce.number().int().min(18).max(99).optional(),
    ageMax: z.coerce.number().int().min(18).max(99).optional(),
    /** Comma separated sport ids, e.g. "badminton,running". */
    sports: z
      .string()
      .optional()
      .transform((v) =>
        v ? [...new Set(v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 12) : undefined,
      )
      .pipe(z.array(SportId).optional()),
  })
  .refine((v) => v.ageMin === undefined || v.ageMax === undefined || v.ageMin <= v.ageMax, {
    message: 'ageMin must be at most ageMax',
    path: ['ageMin'],
  });

export const SwipeBody = z.object({
  targetId: z.uuid(),
  action: z.enum(['LIKE', 'PASS', 'SUPER']),
});

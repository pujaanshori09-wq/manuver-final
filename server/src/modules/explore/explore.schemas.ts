import { z } from 'zod';

export const IdParams = z.object({ id: z.uuid() });

const DAY_MS = 86_400_000;
/** A moment between now and `days` ahead. */
const future = (days: number) =>
  z.iso
    .datetime({ offset: true })
    .refine((v) => new Date(v).getTime() > Date.now() - 60_000, { message: 'Must be in the future' })
    .refine((v) => new Date(v).getTime() < Date.now() + days * DAY_MS, { message: `At most ${days} days ahead` });

const sport = z.string().trim().min(2).max(40);

export const SportQuery = z.object({ sport: z.string().trim().max(40).optional() });

// ── Open sparring sessions ──
export const CreateSessionBody = z.object({
  sport,
  title: z.string().trim().min(3).max(80),
  venueName: z.string().trim().min(2).max(120),
  scheduledAt: future(30),
  slotsTotal: z.number().int().min(2).max(20),
  genderPref: z.enum(['ALL', 'MEN', 'WOMEN']).default('ALL'),
  skillNote: z.string().trim().max(120).nullable().optional(),
});

// ── SOS: "one player short" ──
/** Indonesian mobile numbers: 08…, 628… or +628…, 10–13 digits after the country code. */
const waNumber = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+?62|0)8\d{7,12}$/, 'Enter a WhatsApp number like 08123456789'));

export const CreateSosBody = z.object({
  sport,
  venueName: z.string().trim().min(2).max(120),
  /** Defaults to two hours from now. */
  playTime: future(2).optional(),
  slotsNeeded: z.number().int().min(1).max(5),
  feePerPerson: z.number().int().min(0).max(10_000_000).default(0),
  contactWa: waNumber,
  note: z.string().trim().max(200).nullable().optional(),
});

// ── Events ──
export const CreateEventBody = z.object({
  title: z.string().trim().min(3).max(120),
  organizer: z.string().trim().min(2).max(80),
  type: z.string().trim().min(2).max(60),
  category: sport,
  startsAt: future(365),
  location: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(60),
  priceIdr: z.number().int().min(0).max(100_000_000).default(0),
  quota: z.number().int().min(1).max(100_000).nullable().optional(),
  imageUrl: z.url({ protocol: /^https$/ }).max(500).nullable().optional(),
});

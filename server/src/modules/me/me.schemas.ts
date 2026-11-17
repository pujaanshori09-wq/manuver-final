import { z } from 'zod';

/** App languages (ISO 639-1, upper case). Arabic waits for right-to-left layout support. */
export const AppLanguage = z.enum(['EN', 'ID', 'ZH', 'ES', 'HI', 'PT', 'RU', 'JA', 'DE', 'FR', 'KO', 'VI', 'TH', 'MS']);

const shortText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** Sport ids from the app ("badminton", "lari") or a short custom sport typed by the user. */
export const SportId = z.string().trim().min(2).max(30);

export const SportsBody = z.object({
  sports: z
    .array(z.object({ sportId: SportId, experienceLevel: shortText(20).nullable().optional() }))
    .max(8, 'At most 8 sports'),
});

const ageRange = <T extends z.ZodType<{ ageMin?: number; ageMax?: number }>>(s: T) =>
  s.refine((v) => v.ageMin === undefined || v.ageMax === undefined || v.ageMin <= v.ageMax, {
    message: 'ageMin must be at most ageMax',
    path: ['ageMin'],
  });

export const ProfilePatchBody = ageRange(
  z
    .object({
      name: shortText(60).min(1),
      bio: optionalText(500),
      lookingFor: optionalText(300),
      skillLevel: optionalText(30),
      job: optionalText(80),
      education: optionalText(80),
      city: optionalText(80),
      heightCm: z.number().int().min(120).max(230).nullable(),
      workoutStyle: optionalText(40),
      preferredTime: optionalText(40),
      playFrequency: optionalText(40),
      homeVenue: optionalText(120),
      availability: z.array(shortText(30).min(1)).max(10),
      // Discovery preferences
      ageMin: z.number().int().min(18).max(99),
      ageMax: z.number().int().min(18).max(99),
      genderPreference: z.enum(['ALL', 'MEN', 'WOMEN']),
      maxDistanceKm: z.number().int().min(1).max(200),
      ghostMode: z.boolean(),
      language: AppLanguage,
    })
    .partial()
    .strict(),
);

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const LocationBody = z.object({ latitude, longitude });

const MIN_AGE = 18;
const birthDate = z.iso.date().refine(
  (v) => {
    const d = new Date(`${v}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - d.getUTCFullYear();
    const m = now.getUTCMonth() - d.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
    return age >= MIN_AGE && age < 100;
  },
  { message: `You must be at least ${MIN_AGE}` },
);

export const OnboardingBody = ageRange(
  z.object({
    name: shortText(60).min(1),
    birthDate,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    genderPreference: z.enum(['ALL', 'MEN', 'WOMEN']).default('ALL'),
    ageMin: z.number().int().min(18).max(99).default(18),
    ageMax: z.number().int().min(18).max(99).default(50),
    sports: SportsBody.shape.sports.min(1, 'Pick at least one sport'),
    language: AppLanguage,
    acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
    location: LocationBody.optional(),
  }),
);

export const PromptsBody = z.object({
  prompts: z
    .array(z.object({ questionId: z.uuid(), answer: z.string().trim().min(1).max(150) }))
    .max(3, 'At most 3 prompts')
    .refine((list) => new Set(list.map((p) => p.questionId)).size === list.length, {
      message: 'Each question can be answered once',
    }),
});

export const PhotoOrderBody = z.object({
  ids: z.array(z.uuid()).min(1).max(4),
});

export const PhotoIdParams = z.object({ id: z.uuid() });

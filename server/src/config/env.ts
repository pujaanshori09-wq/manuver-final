import { z } from 'zod';

const list = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().url(),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    GOOGLE_CLIENT_IDS: list,
    // Server-side Google OAuth (web client). Both empty = Google sign-in disabled.
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    // Public origins the app may reach this API through (tunnel, localhost, production domain).
    // Google redirects back to <origin>/v1/auth/google/callback, so each must be registered in Google Cloud.
    OAUTH_ORIGINS: list,

    // Email (Resend). Empty key = emails are written to the log in development.
    RESEND_API_KEY: z.string().default(''),
    EMAIL_FROM: z.string().default('Manuver <onboarding@resend.dev>'),
    CORS_ORIGINS: list,
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),

    // Photo storage: "local" disk (development) or an S3-compatible bucket (Supabase Storage, Backblaze B2, Cloudflare R2).
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    /** R2: https://<account id>.r2.cloudflarestorage.com */
    S3_ENDPOINT: z.string().default(''),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().default(''),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    /** Public address of the bucket (r2.dev subdomain or your own domain), without a trailing slash. */
    S3_PUBLIC_URL: z.string().default(''),
    /**
     * "true" sends requests as <endpoint>/<bucket>/<key> instead of <bucket>.<endpoint>/<key>.
     * Supabase Storage needs it; R2 and Backblaze B2 work either way.
     */
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((e, ctx) => {
    if (e.STORAGE_DRIVER === 's3') {
      for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL'] as const) {
        if (!e[k]) ctx.addIssue({ code: 'custom', path: [k], message: `${k} is required when STORAGE_DRIVER=s3` });
      }
    }
    if (e.NODE_ENV === 'production') {
      // The example values from .env.example must never sign real tokens.
      for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (/change-me/i.test(e[k])) ctx.addIssue({ code: 'custom', path: [k], message: `${k} is still the example value` });
      }
      if (e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['JWT_REFRESH_SECRET'], message: 'Use two different JWT secrets' });
      }
      // Without it sign-up verification and password reset emails would fail silently.
      if (!e.RESEND_API_KEY) ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Required in production' });
      if (!e.PUBLIC_BASE_URL.startsWith('https://')) {
        ctx.addIssue({ code: 'custom', path: ['PUBLIC_BASE_URL'], message: 'Must be an https:// address in production' });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/** Checks a set of variables; exported so tests can try configurations. */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Fail fast with a readable list instead of a crash deep inside a request.
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = parseEnv(process.env);
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

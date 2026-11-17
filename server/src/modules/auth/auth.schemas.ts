import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email')
  .max(254);

// Length over complexity rules: 8+ characters, capped so bcrypt's 72-byte limit isn't hit silently.
const password = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters');

export const RegisterBody = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(60).optional(),
});

export const LoginBody = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const RefreshBody = z.object({
  refreshToken: z.string().min(20).max(200),
});

export const GoogleBody = z.object({
  idToken: z.string().min(20),
});

export const ForgotBody = z.object({ email, returnUrl: z.string().max(500).optional() });

export const ResetBody = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const GoogleStartQuery = z.object({
  origin: z.string().max(200),
  returnUrl: z.string().max(500),
});

export const HandoffBody = z.object({ code: z.string().min(20).max(200) });

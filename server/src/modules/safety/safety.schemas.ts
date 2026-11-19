import { z } from 'zod';

export const UserIdParams = z.object({ userId: z.uuid() });

export const BlockBody = z.object({ userId: z.uuid() });

/** Machine-readable reasons; the app shows them translated. */
export const ReportReason = z.enum(['RUDE', 'SPAM', 'FAKE', 'INAPPROPRIATE', 'UNDERAGE', 'OTHER']);

export const ReportBody = z.object({
  userId: z.uuid(),
  reason: ReportReason,
  details: z.string().trim().max(2000).optional(),
});

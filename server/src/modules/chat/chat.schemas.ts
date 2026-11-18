import { z } from 'zod';

export const MatchIdParams = z.object({ id: z.uuid() });
export const MessageIdParams = z.object({ id: z.uuid() });

const Invite = z.object({
  sport: z.string().trim().min(1).max(40),
  venueName: z.string().trim().min(1).max(120),
  scheduledAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(300).nullable().optional(),
});

export const SendMessageBody = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TEXT'),
    /** Client-generated; resending the same id returns the stored message instead of a duplicate. */
    clientId: z.uuid(),
    content: z.string().trim().min(1).max(2000),
  }),
  z.object({
    type: z.literal('SPARING_INVITE'),
    clientId: z.uuid(),
    content: z.string().trim().min(1).max(200),
    invite: Invite,
  }),
]);

export const RespondBody = z.object({ status: z.enum(['ACCEPTED', 'DECLINED']) });

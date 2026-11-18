import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { chatApi, type ChatMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Message } from '../types/database';

/** shortcut: new messages arrive by polling every 3 s; switch to Socket.IO once the API is deployed off the dev tunnel. */
const POLL_MS = 3000;

/** Idempotency key for a send, not a secret, so Math.random is enough. */
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Server message → the shape the chat screen and invite card already render. */
function toMessage(m: ChatMessage): Message {
  return {
    id: m.id,
    client_id: m.clientId ?? undefined,
    sender_id: m.senderId,
    content: m.content,
    created_at: m.createdAt,
    type: m.type === 'SPARING_INVITE' ? 'sparing_invite' : 'text',
    metadata: m.invite
      ? {
          sport: m.invite.sport,
          venue_name: m.invite.venueName,
          scheduled_at: m.invite.scheduledAt,
          note: m.invite.note,
          status: (m.inviteStatus ?? 'PENDING').toLowerCase(),
        }
      : undefined,
  };
}

export function useChat(matchId: string | string[] | undefined) {
  const queryClient = useQueryClient();
  const { me } = useAuth();
  const currentUserId = me?.id ?? null;
  const id = typeof matchId === 'string' ? matchId : undefined;
  const key = ['chat', id] as const;

  const {
    data: messages = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: key,
    enabled: !!id,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<Message[]> => {
      const saved = (await chatApi.messages(id!)).map(toMessage);
      // Keep our own sends the server list does not have yet: still sending, failed, or saved
      // after this poll left (newer than anything it returned).
      const savedIds = new Set(saved.map((m) => m.client_id));
      const newest = saved.at(-1)?.created_at ?? '';
      const pending = (queryClient.getQueryData<Message[]>(key) ?? []).filter(
        (m) =>
          m.sender_id === currentUserId &&
          !!m.client_id &&
          !savedIds.has(m.client_id) &&
          (!!m.status || m.created_at > newest),
      );
      return [...saved, ...pending];
    },
  });

  const replace = useCallback(
    (tempId: string, next: Message | Partial<Message> | null) =>
      queryClient.setQueryData<Message[]>(key, (old = []) => {
        if (next === null) return old.filter((m) => m.id !== tempId);
        // A poll may already have brought the saved copy in; then just drop the placeholder.
        if ('id' in next && next.id && next.id !== tempId && old.some((m) => m.id === next.id)) {
          return old.filter((m) => m.id !== tempId);
        }
        return old.map((m) => (m.id === tempId ? { ...m, ...next } : m));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, id],
  );

  /** Send a pending message; swap in the saved one, or mark it failed so it can be retried. */
  const deliver = useCallback(
    async (temp: Message): Promise<boolean> => {
      if (!id || !temp.client_id) return false;
      replace(temp.id, { status: 'sending' });
      try {
        const m = temp.metadata;
        const saved = await chatApi.send(
          id,
          temp.type === 'sparing_invite'
            ? {
                clientId: temp.client_id,
                type: 'SPARING_INVITE',
                content: temp.content,
                invite: { sport: m.sport, venueName: m.venue_name, scheduledAt: m.scheduled_at, note: m.note ?? null },
              }
            : { clientId: temp.client_id, type: 'TEXT', content: temp.content },
        );
        replace(temp.id, { ...toMessage(saved), status: undefined });
        return true;
      } catch {
        replace(temp.id, { status: 'failed' });
        return false;
      }
    },
    [id, replace],
  );

  const enqueue = (partial: Pick<Message, 'content'> & Partial<Pick<Message, 'type' | 'metadata'>>) => {
    if (!id || !currentUserId) return Promise.resolve(false);
    const clientId = uuid();
    const temp: Message = {
      id: `tmp-${clientId}`,
      client_id: clientId,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      status: 'sending',
      ...partial,
    };
    queryClient.setQueryData<Message[]>(key, (old = []) => [...old, temp]);
    return deliver(temp);
  };

  const sendMessage = (text: string) => {
    const content = text.trim();
    return content ? enqueue({ content }) : Promise.resolve(false);
  };

  const sendSparingInvite = (inviteData: { sport: string; venue_name: string; scheduled_at: string; note: string | null }) =>
    enqueue({
      content: `Sparing ${inviteData.sport} @ ${inviteData.venue_name}`.slice(0, 200),
      type: 'sparing_invite',
      metadata: { ...inviteData, status: 'pending' },
    });

  const retryMessage = (tempId: string) => {
    const temp = (queryClient.getQueryData<Message[]>(key) ?? []).find((m) => m.id === tempId);
    return temp ? deliver(temp) : Promise.resolve(false);
  };

  const discardMessage = (tempId: string) => replace(tempId, null);

  /** Accept/decline an invite. Returns false (and rolls back) when the server refuses. */
  const updateInviteStatus = async (messageId: string, newStatus: 'accepted' | 'declined'): Promise<boolean> => {
    const previous = queryClient.getQueryData<Message[]>(key);
    queryClient.setQueryData<Message[]>(key, (old = []) =>
      old.map((m) => (m.id === messageId ? { ...m, metadata: { ...m.metadata, status: newStatus } } : m)),
    );
    try {
      await chatApi.respond(messageId, newStatus === 'accepted' ? 'ACCEPTED' : 'DECLINED');
      return true;
    } catch {
      queryClient.setQueryData(key, previous);
      return false;
    }
  };

  return {
    messages,
    loading,
    error,
    refetch,
    currentUserId,
    sendMessage,
    sendSparingInvite,
    retryMessage,
    discardMessage,
    updateInviteStatus,
  };
}

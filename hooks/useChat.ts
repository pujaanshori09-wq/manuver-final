import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Message } from '../types/database';

const isTemp = (id: string) => id.startsWith('tmp-');

export function useChat(matchId: string | string[] | undefined) {
  const queryClient = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const tempCounter = useRef(0);
  const key = ['chat', matchId] as const;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const {
    data: messages = [],
    isLoading: loading,
    error,
    refetch,
  } = useQuery({
    queryKey: key,
    enabled: !!matchId,
    queryFn: async (): Promise<Message[]> => {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId as string)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      return (data ?? []) as Message[];
    },
  });

  // Realtime: new rows from the other person (and echoes of our own sends).
  useEffect(() => {
    if (!matchId) return;
    const id = matchId as string;
    let hasSubscribed = false;

    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${id}` },
        (payload) => {
          const row = payload.new as Message;
          queryClient.setQueryData<Message[]>(key, (old = []) => {
            if (old.some((m) => m.id === row.id)) return old;
            // Echo of our own pending send: swap the placeholder for the saved row
            // instead of showing the message twice.
            const pending = old.findIndex(
              (m) =>
                isTemp(m.id) &&
                m.sender_id === row.sender_id &&
                m.content === row.content &&
                (m.type ?? 'text') === (row.type ?? 'text'),
            );
            if (pending >= 0) {
              const next = [...old];
              next[pending] = row;
              return next;
            }
            return [...old, row];
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // After a reconnect we may have missed rows: reload once.
          if (hasSubscribed) queryClient.invalidateQueries({ queryKey: key });
          hasSubscribed = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, queryClient]);

  const patch = useCallback(
    (tempId: string, change: Partial<Message> | null) => {
      queryClient.setQueryData<Message[]>(key, (old = []) =>
        change === null ? old.filter((m) => m.id !== tempId) : old.map((m) => (m.id === tempId ? { ...m, ...change } : m)),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, matchId],
  );

  /** Insert a pending message; swap in the saved row, or mark it failed so it can be retried. */
  const deliver = useCallback(
    async (temp: Message): Promise<boolean> => {
      const id = matchId as string;
      patch(temp.id, { status: 'sending' });

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          match_id: id,
          sender_id: temp.sender_id,
          content: temp.content,
          ...(temp.type && temp.type !== 'text' ? { type: temp.type, metadata: temp.metadata } : {}),
        })
        .select()
        .single();

      if (insertError || !data) {
        patch(temp.id, { status: 'failed' });
        return false;
      }

      queryClient.setQueryData<Message[]>(key, (old = []) => {
        // Realtime may already have swapped this placeholder for the saved row.
        if (old.some((m) => m.id === (data as Message).id)) return old.filter((m) => m.id !== temp.id);
        return old.map((m) => (m.id === temp.id ? (data as Message) : m));
      });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, patch, queryClient],
  );

  const enqueue = useCallback(
    (partial: Pick<Message, 'content'> & Partial<Pick<Message, 'type' | 'metadata'>>) => {
      if (!matchId || !currentUserId) return Promise.resolve(false);
      const temp: Message = {
        id: `tmp-${Date.now()}-${tempCounter.current++}`,
        sender_id: currentUserId,
        created_at: new Date().toISOString(),
        status: 'sending',
        ...partial,
      };
      queryClient.setQueryData<Message[]>(key, (old = []) => [...old, temp]);
      return deliver(temp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, currentUserId, deliver, queryClient],
  );

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content) return Promise.resolve(false);
    // Push notifications are sent server-side (messages webhook → notify-message).
    return enqueue({ content });
  };

  const sendSparingInvite = (inviteData: any) =>
    enqueue({
      content: `Sparing ${inviteData.sport} @ ${inviteData.venue_name}`,
      type: 'sparing_invite',
      metadata: { ...inviteData, status: 'pending' },
    });

  const retryMessage = (tempId: string) => {
    const temp = (queryClient.getQueryData<Message[]>(key) ?? []).find((m) => m.id === tempId);
    return temp ? deliver(temp) : Promise.resolve(false);
  };

  const discardMessage = (tempId: string) => patch(tempId, null);

  /** Accept/decline an invite. Returns false (and rolls back) when the server refuses. */
  const updateInviteStatus = async (messageId: string, newStatus: 'accepted' | 'declined'): Promise<boolean> => {
    const previous = queryClient.getQueryData<Message[]>(key);
    queryClient.setQueryData<Message[]>(key, (old = []) =>
      old.map((m) => (m.id === messageId ? { ...m, metadata: { ...m.metadata, status: newStatus } } : m)),
    );

    const { error: rpcError } = await supabase.rpc('respond_to_sparing_invite', {
      p_message_id: messageId,
      p_status: newStatus,
    });

    if (rpcError) {
      queryClient.setQueryData(key, previous);
      return false;
    }
    return true;
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

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/store/useAuthStore';
import {
  ensureMessageThread,
  ensureOwnerLmThread,
  fetchMessageableLineManagers,
  fetchMessageThreads,
  fetchThreadMessages,
  markThreadRead,
  sendMessage,
  type Message,
  type MessageableLineManager,
  type MessageThread,
} from '@/src/services/messages.services';

const THREADS_KEY = ['message-threads'];
const LM_CONTACTS_KEY = ['messageable-line-managers'];
const messagesKey = (threadId: string) => ['thread-messages', threadId];

export function useMessageThreads() {
  const user = useAuthStore((s) => s.user);
  return useQuery<MessageThread[]>({
    queryKey: [...THREADS_KEY, user?.id],
    queryFn: () => fetchMessageThreads(user?.id ?? ''),
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

/** Confirmed projects (investor) or owned projects (owner) → Prism LMs to message. */
export function useMessageableLineManagers() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const enabled =
    !!user?.id && (role === 'INVESTOR' || role === 'PROJECT_OWNER');
  return useQuery<MessageableLineManager[]>({
    queryKey: [...LM_CONTACTS_KEY, user?.id, role],
    queryFn: () =>
      fetchMessageableLineManagers(
        user!.id,
        role === 'PROJECT_OWNER' ? 'PROJECT_OWNER' : 'INVESTOR',
      ),
    enabled,
    staleTime: 30_000,
  });
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: messagesKey(threadId ?? ''),
    queryFn: () => fetchThreadMessages(threadId ?? ''),
    enabled: !!threadId,
    staleTime: 5_000,
  });
}

export function useEnsureMessageThread() {
  return useMutation({
    mutationFn: ({ projectId, investorId }: { projectId: string; investorId: string }) =>
      ensureMessageThread(projectId, investorId),
  });
}

export function useEnsureOwnerLmThread() {
  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) => ensureOwnerLmThread(projectId),
  });
}

export function useSendMessage(threadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(threadId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: messagesKey(threadId) });
      qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}

export function useMarkThreadRead(threadId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markThreadRead(threadId ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: THREADS_KEY });
    },
  });
}

/**
 * Subscribes to INSERTs on `messages` scoped to a thread. Every new message
 * pushed by the DB triggers a react-query cache append so the UI paints
 * without a manual refetch. Also invalidates the threads list to keep
 * preview + unread counters fresh in the sidebar.
 */
export function useMessagesRealtime(threadId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as any;
          const newMsg: Message = {
            id: row.id,
            threadId: row.thread_id,
            senderId: row.sender_id,
            body: row.body,
            createdAt: row.created_at,
            readAt: row.read_at,
          };
          qc.setQueryData<Message[]>(messagesKey(threadId), (prev) => {
            if (!prev) return [newMsg];
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          qc.invalidateQueries({ queryKey: THREADS_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, qc]);
}

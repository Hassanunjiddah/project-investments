import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import {
  loadNotifications,
  getLastReadAt,
  markAllRead,
  type Notification,
} from '@/src/services/notifications.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { supabase } from '@/src/services/supabase';

/**
 * Role-aware notifications feed. Polls every 45s and also invalidates on
 * realtime inserts into public.notifications so activity / proofs feel instant.
 */
export function useNotifications() {
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', role, userId],
    queryFn: () => loadNotifications(role),
    enabled: !!role && !!userId,
    refetchInterval: 45_000,
    staleTime: 15_000,
    retry: 0,
  });

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const { items, unreadCount } = useMemo(() => {
    const list: Notification[] = query.data ?? [];
    const uid = useAuthStore.getState().session?.user.id ?? null;
    const lastReadAt = getLastReadAt(uid);
    const unread = list.filter((n) => n.createdAt > lastReadAt);
    return { items: list, unreadCount: unread.length };
  }, [query.data]);

  const markRead = () => {
    const uid = useAuthStore.getState().session?.user.id ?? null;
    markAllRead(uid);
    query.refetch();
  };

  return {
    items,
    unreadCount,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    markRead,
  };
}

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  loadNotifications,
  getLastReadAt,
  markAllRead,
  type Notification,
} from '@/src/services/notifications.services';
import { useAuthStore } from '@/src/store/useAuthStore';

/**
 * Role-aware notifications feed. Polls every 45s (aggressive enough to feel
 * live, gentle enough on the DB). Unread state is client-side.
 */
export function useNotifications() {
  const role = useAuthStore((s) => s.role);

  const query = useQuery({
    queryKey: ['notifications', role],
    queryFn: () => loadNotifications(role),
    enabled: !!role,
    refetchInterval: 45_000,
    staleTime: 30_000,
    retry: 0,
  });

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

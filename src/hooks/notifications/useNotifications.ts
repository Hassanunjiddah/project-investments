import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  loadNotifications,
  getLastReadAt,
  markAllRead,
  type Notification,
} from '@/src/services/notifications.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { supabase } from '@/src/services/supabase';
import { playNotifyEngagement } from '@/src/utils/notifyEngagement';
import { useUiStore } from '@/src/store/useUiStore';

/**
 * Shared realtime channel — `useNotifications` is mounted from AppHeader,
 * DesktopLeftRail, and home screens at once. Re-using the same topic and
 * calling `.on()` after `.subscribe()` throws on web and blanks #root.
 */
const channelFans = new Set<() => void>();
let sharedChannel: RealtimeChannel | null = null;
let sharedUserId: string | null = null;

function fanOut() {
  channelFans.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

function retainNotificationsChannel(userId: string, onEvent: () => void): () => void {
  channelFans.add(onEvent);

  if (!sharedChannel || sharedUserId !== userId) {
    if (sharedChannel) {
      void supabase.removeChannel(sharedChannel);
    }
    sharedChannel = null;
    sharedUserId = userId;
    sharedChannel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => fanOut(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => fanOut(),
      )
      .subscribe();
  }

  return () => {
    channelFans.delete(onEvent);
    if (channelFans.size === 0 && sharedChannel) {
      void supabase.removeChannel(sharedChannel);
      sharedChannel = null;
      sharedUserId = null;
    }
  };
}

/**
 * Role-aware notifications feed. Polls every 45s and also invalidates on
 * realtime inserts into public.notifications so activity / proofs feel instant.
 */
export function useNotifications() {
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const queryClient = useQueryClient();
  const setBellPulse = useUiStore((s) => s.setBellPulse);
  const prevUnreadRef = useRef<number | null>(null);
  const seededRef = useRef(false);
  /** Forces unread recount when last-read watermark changes (list data may be unchanged). */
  const [readVersion, setReadVersion] = useState(0);

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
    return retainNotificationsChannel(userId, () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });
  }, [userId, queryClient]);

  const { items, unreadCount, lastReadAt } = useMemo(() => {
    const list: Notification[] = query.data ?? [];
    const uid = useAuthStore.getState().session?.user.id ?? null;
    const watermark = getLastReadAt(uid);
    const unread = list.filter((n) => n.createdAt > watermark);
    return { items: list, unreadCount: unread.length, lastReadAt: watermark };
    // readVersion intentionally included — watermark lives outside React Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, readVersion]);

  // Engagement: chime + haptic + bell pulse when unread count rises.
  useEffect(() => {
    if (!query.data) return;
    if (!seededRef.current) {
      seededRef.current = true;
      prevUnreadRef.current = unreadCount;
      return;
    }
    const prev = prevUnreadRef.current ?? 0;
    if (unreadCount > prev) {
      void playNotifyEngagement();
      setBellPulse(true);
      setTimeout(() => setBellPulse(false), 1600);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount, query.data, setBellPulse]);

  const markRead = useCallback(() => {
    const uid = useAuthStore.getState().session?.user.id ?? null;
    markAllRead(uid);
    setReadVersion((v) => v + 1);
    prevUnreadRef.current = 0;
    void query.refetch();
  }, [query]);

  return {
    items,
    unreadCount,
    lastReadAt,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
    markRead,
  };
}

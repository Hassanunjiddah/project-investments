import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/store/useAuthStore';

/**
 * A single item in the investor's live activity feed. Normalised across
 * multiple Supabase source tables (`distribution_notices`, `invites`,
 * `audit_events`) so the drawer UI can render them uniformly.
 */
export type ActivityEvent = {
  id: string;
  kind:
    | 'distribution_posted'
    | 'invite_ready_to_pledge'
    | 'invite_committed'
    | 'invite_confirmed'
    | 'invite_declined';
  title: string;
  subtitle?: string;
  projectId: string | null;
  projectName?: string | null;
  createdAt: string;
  /** Route to open when the user taps the event, if any. */
  href?: string;
};

const MAX_FEED = 30;

type FeedState = {
  events: ActivityEvent[];
  /** Number of unseen events since the drawer was last opened. */
  unread: number;
  /** True when both realtime channels are subscribed. Powers the "live" dot. */
  live: boolean;
};

/**
 * Live investor activity feed.
 *
 * Combines:
 *   • an initial fetch of the last 20 distribution notices and invites
 *     for the current investor.
 *   • two Supabase realtime subscriptions:
 *       — INSERT on distribution_notices where investor_id = current
 *       — UPDATE on invites where investor_id = current (status changes)
 *
 * When either fires, we prepend a normalised ActivityEvent and bump the
 * unread counter. Consumers call `markAllRead()` when the drawer opens.
 */
export function useLiveActivity() {
  const user = useAuthStore((s) => s.user);
  const investorId = user?.id;

  const [state, setState] = useState<FeedState>({ events: [], unread: 0, live: false });
  const seededRef = useRef(false);
  const channelReadyRef = useRef({ notices: false, invites: false });

  // Both channels must land at `SUBSCRIBED` before we flip `live` on.
  const markChannelReady = useCallback((channel: 'notices' | 'invites', ready: boolean) => {
    channelReadyRef.current[channel] = ready;
    const bothReady = channelReadyRef.current.notices && channelReadyRef.current.invites;
    setState((prev) => (prev.live === bothReady ? prev : { ...prev, live: bothReady }));
  }, []);

  // Prepend an event to the rolling window, dedupe by id.
  const pushEvent = useCallback((incoming: ActivityEvent, initial = false) => {
    setState((prev) => {
      if (prev.events.some((e) => e.id === incoming.id)) return prev;
      const events = [incoming, ...prev.events].slice(0, MAX_FEED);
      return {
        ...prev,
        events,
        // Only new realtime events increment unread; the initial seed
        // arrives as "already seen" so the badge starts at 0.
        unread: initial ? prev.unread : prev.unread + 1,
      };
    });
  }, []);

  const markAllRead = useCallback(() => {
    setState((prev) => (prev.unread === 0 ? prev : { ...prev, unread: 0 }));
  }, []);

  // ── Initial seed ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!investorId || seededRef.current) return;
    seededRef.current = true;

    (async () => {
      // Recent distribution notices for this investor.
      const { data: notices } = await supabase
        .from('distribution_notices')
        .select('id, project_id, projects(name), reference, profit_minor, created_at, is_final')
        .eq('investor_id', investorId)
        .order('created_at', { ascending: false })
        .limit(15);

      (notices ?? []).forEach((n: any) => {
        pushEvent(
          {
            id: `notice:${n.id}`,
            kind: 'distribution_posted',
            title: n.is_final
              ? `Final distribution posted · ${n.reference}`
              : `New distribution posted · ${n.reference}`,
            subtitle: n.projects?.name ?? undefined,
            projectId: n.project_id ?? null,
            projectName: n.projects?.name ?? null,
            createdAt: n.created_at,
            href: '/(tabs)/statements',
          },
          true,
        );
      });

      // Recent invites (status changes matter — the audit trail lives in
      // invite.updated_at). We seed with the latest 10.
      const { data: invites } = await supabase
        .from('invites')
        .select('id, project_id, projects(name), status, updated_at, created_at')
        .eq('investor_id', investorId)
        .order('updated_at', { ascending: false })
        .limit(10);

      (invites ?? []).forEach((iv: any) => {
        const kind = statusToKind(iv.status);
        if (!kind) return;
        pushEvent(
          {
            id: `invite:${iv.id}:${iv.status}`,
            kind,
            title: kindTitle(kind, iv.projects?.name ?? 'a project'),
            subtitle: humanTimeSince(iv.updated_at ?? iv.created_at),
            projectId: iv.project_id ?? null,
            projectName: iv.projects?.name ?? null,
            createdAt: iv.updated_at ?? iv.created_at,
            href: `/(tabs)/portfolio/projects/${iv.project_id}`,
          },
          true,
        );
      });
    })().catch(() => {
      /* Silent — activity feed is a "nice to have"; never fail loud. */
    });
  }, [investorId, pushEvent]);

  // ── Realtime subscriptions ──────────────────────────────────────────
  useEffect(() => {
    if (!investorId) return;

    const noticeChan = supabase
      .channel(`activity:notices:${investorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'distribution_notices',
          filter: `investor_id=eq.${investorId}`,
        },
        (payload) => {
          const row: any = payload.new;
          pushEvent({
            id: `notice:${row.id}`,
            kind: 'distribution_posted',
            title: row.is_final
              ? `Final distribution posted · ${row.reference}`
              : `New distribution posted · ${row.reference}`,
            subtitle: 'Just now',
            projectId: row.project_id ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
            href: '/(tabs)/statements',
          });
        },
      )
      .subscribe((status) => markChannelReady('notices', status === 'SUBSCRIBED'));

    const inviteChan = supabase
      .channel(`activity:invites:${investorId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'invites',
          filter: `investor_id=eq.${investorId}`,
        },
        (payload) => {
          const row: any = payload.new;
          const kind = statusToKind(row.status);
          if (!kind) return;
          pushEvent({
            id: `invite:${row.id}:${row.status}:${row.updated_at}`,
            kind,
            title: kindTitle(kind, 'your project'),
            subtitle: 'Just now',
            projectId: row.project_id ?? null,
            createdAt: row.updated_at ?? new Date().toISOString(),
            href: `/(tabs)/portfolio/projects/${row.project_id}`,
          });
        },
      )
      .subscribe((status) => markChannelReady('invites', status === 'SUBSCRIBED'));

    return () => {
      markChannelReady('notices', false);
      markChannelReady('invites', false);
      supabase.removeChannel(noticeChan);
      supabase.removeChannel(inviteChan);
    };
  }, [investorId, pushEvent, markChannelReady]);

  const sortedEvents = useMemo(
    () =>
      [...state.events].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [state.events],
  );

  return {
    events: sortedEvents,
    unread: state.unread,
    live: state.live,
    markAllRead,
  };
}

// ── helpers ────────────────────────────────────────────────────────────
function statusToKind(status: string | null | undefined): ActivityEvent['kind'] | null {
  switch (status) {
    case 'INVITED':
      return 'invite_ready_to_pledge';
    case 'COMMITTED':
    case 'PROOF_SUBMITTED':
      return 'invite_committed';
    case 'CONFIRMED':
      return 'invite_confirmed';
    case 'DECLINED':
    case 'CANCELLED':
      return 'invite_declined';
    default:
      return null;
  }
}

function kindTitle(kind: ActivityEvent['kind'], projectName: string): string {
  switch (kind) {
    case 'distribution_posted':
      return `New distribution posted · ${projectName}`;
    case 'invite_ready_to_pledge':
      return `Invitation ready to pledge · ${projectName}`;
    case 'invite_committed':
      return `Payment recorded · ${projectName}`;
    case 'invite_confirmed':
      return `Investment confirmed · ${projectName}`;
    case 'invite_declined':
      return `Invitation closed · ${projectName}`;
  }
}

function humanTimeSince(iso: string | null | undefined): string {
  if (!iso) return '';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

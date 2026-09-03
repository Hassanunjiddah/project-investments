// Prism Capital — role-aware notification feed.
//
// Aggregates real-time signals from existing sources — NO new backend infra:
//   • CEO      → list_pending_declarations() + pending projects
//   • LM       → invites in PROOF_SUBMITTED on their owned projects
//   • Investor → their invites (invited/accepted/committed) + notices minted +
//                pledges expiring in ≤ 12h
//
// Each notification is derived, so there's no persistence layer — "unread" is
// tracked client-side via `prism.notifications.lastReadAt.<userId>` in
// localStorage. That's enough for a bell badge without adding DB tables.

import { supabase } from '@/src/services/supabase';
import { fetchInvitations } from '@/src/services/invitations.services';
import { listInvestorNotices } from '@/src/services/transparency.services';
import { fetchPendingDeclarations } from '@/src/services/profitDeclarations.services';
import type { Role as UserRole } from '@/src/constants/roles';
import { managerConfirmProofHref, investorProjectHref } from '@/src/helpers/routing';

export type NotificationType =
  | 'invite-received'
  | 'invite-payment-pending'
  | 'pledge-expiring'
  | 'payment-confirmed'
  | 'notice-minted'
  | 'proof-submitted'
  | 'declaration-pending'
  | 'project-pending'
  // Persisted rows from public.notifications (written by DB triggers)
  | 'activity-post'
  | 'declaration-submitted'
  | 'declaration-approved'
  | 'declaration-rejected'
  | 'project-submitted'
  | 'project-approved'
  | 'project-rejected'
  | 'new-message'
  | 'doc-requested'
  | 'doc-fulfilled';

export type Notification = {
  id: string;
  type: NotificationType;
  /** Short title (one line, e.g. "New distribution notice"). */
  title: string;
  /** Longer description (e.g. "PRSM-PRJ-114 · ₦1,260,000"). */
  message: string;
  /** Optional reference chip (statement / declaration / project code). */
  reference?: string;
  /** Route to open when tapped. */
  href: string;
  /** ISO — used for unread-since comparison + sort. */
  createdAt: string;
  /** Feather / Ionicons name; consumer picks icon set. */
  icon: string;
};

// ── Aggregator ─────────────────────────────────────────────────────────
export async function loadNotifications(role: UserRole | null): Promise<Notification[]> {
  if (!role) return [];
  return Promise.race([
    _loadNotificationsInner(role).catch(() => [] as Notification[]),
    // Hard 8s ceiling so a slow RPC never freezes the notification bell.
    new Promise<Notification[]>((resolve) => setTimeout(() => resolve([]), 8000)),
  ]);
}

// DB `notifications.type` → feed presentation. SUBMITTED types are omitted
// because the CEO feed already derives live "awaiting approval" items from
// pending declarations/projects — those disappear once handled, which is
// better UX than a permanent history row duplicating them.
const DB_NOTIFICATION_META: Partial<Record<string, { type: NotificationType; icon: string }>> = {
  ACTIVITY_POST: { type: 'activity-post', icon: 'rss' },
  DECLARATION_APPROVED: { type: 'declaration-approved', icon: 'check-circle' },
  DECLARATION_REJECTED: { type: 'declaration-rejected', icon: 'x-circle' },
  PROJECT_APPROVED: { type: 'project-approved', icon: 'check-circle' },
  PROJECT_REJECTED: { type: 'project-rejected', icon: 'x-circle' },
  NEW_MESSAGE: { type: 'new-message', icon: 'message-circle' },
  PROOF_SUBMITTED: { type: 'proof-submitted', icon: 'upload' },
  TARGET_REACHED: { type: 'project-approved', icon: 'check-circle' },
  DRAWDOWN_REQUESTED: { type: 'declaration-pending', icon: 'upload' },
  DRAWDOWN_DECIDED: { type: 'declaration-approved', icon: 'check-circle' },
  WITHDRAWAL_REQUESTED: { type: 'declaration-pending', icon: 'upload' },
  WITHDRAWAL_DECIDED: { type: 'declaration-approved', icon: 'check-circle' },
  PROFIT_PROPOSED: { type: 'declaration-pending', icon: 'upload' },
  DECLARATION_SUBMITTED: { type: 'declaration-pending', icon: 'upload' },
  DOC_REQUESTED: { type: 'doc-requested', icon: 'file-text' },
  DOC_FULFILLED: { type: 'doc-fulfilled', icon: 'check-circle' },
};

/** Rewrite LM project routes to the investor-visible portfolio stack. */
function investorSafeHref(href: string | null | undefined, projectId: string | null): string {
  if (href?.includes('/(tabs)/portfolio/') || href?.includes('/portfolio/projects/')) return href;
  if (href?.startsWith('/projects/')) {
    return href.replace('/projects/', '/(tabs)/portfolio/projects/');
  }
  if (href?.startsWith('/(tabs)/projects/')) {
    return href.replace('/(tabs)/projects/', '/(tabs)/portfolio/projects/');
  }
  if (projectId) return `/(tabs)/portfolio/projects/${projectId}`;
  return '/(tabs)/notifications';
}

/** Ensure staff deep links land on the actionable tab (query params intact). */
function resolveStaffHref(
  type: string,
  href: string | null | undefined,
  projectId: string | null,
  entityId: string | null,
): string {
  if (type === 'PROOF_SUBMITTED' && projectId && entityId) {
    return String(managerConfirmProofHref(projectId, entityId));
  }
  if (type === 'NEW_MESSAGE' && entityId) {
    return `/(tabs)/messages/${entityId}`;
  }
  if (
    (type === 'DECLARATION_SUBMITTED' || type === 'PROFIT_PROPOSED') &&
    projectId &&
    !href?.includes('tab=')
  ) {
    return `/projects/${projectId}?tab=profits`;
  }
  if (type === 'DRAWDOWN_REQUESTED' || type === 'DRAWDOWN_DECIDED') {
    if (projectId && !href?.includes('tab=')) {
      return `/projects/${projectId}?tab=drawdowns`;
    }
  }
  if (type === 'WITHDRAWAL_REQUESTED' && projectId && !href?.includes('tab=')) {
    return `/projects/${projectId}?tab=withdrawals`;
  }
  if ((type === 'DOC_REQUESTED' || type === 'DOC_FULFILLED') && projectId) {
    if (href?.includes('tab=documents')) return href;
    const requestQs =
      type === 'DOC_REQUESTED' && entityId ? `&request=${entityId}` : '';
    return `/projects/${projectId}?tab=documents${requestQs}`;
  }
  if (href) return href;
  if (projectId) return `/projects/${projectId}`;
  return '/(tabs)/notifications';
}

async function fetchPersistedNotifications(
  uid: string,
  role: UserRole,
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, project_id, entity_id, href, created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];

  const out: Notification[] = [];
  for (const row of data) {
    const meta = DB_NOTIFICATION_META[row.type];
    if (!meta) continue;
    const href =
      role === 'INVESTOR'
        ? investorSafeHref(row.href, row.project_id)
        : resolveStaffHref(row.type, row.href, row.project_id, row.entity_id);
    out.push({
      id: `db-${row.id}`,
      type: meta.type,
      title: row.title,
      message: row.body ?? '',
      href,
      createdAt: row.created_at,
      icon: meta.icon,
    });
  }
  return out;
}

async function _loadNotificationsInner(role: UserRole): Promise<Notification[]> {
  const out: Notification[] = [];
  const now = Date.now();

  const uid = (await supabase.auth.getSession()).data.session?.user?.id ?? null;

  // Persisted notification rows (activity posts, declaration/approval
  // decisions, new messages) apply to every role.
  if (uid) {
    out.push(...(await fetchPersistedNotifications(uid, role).catch(() => [])));
  }

  // ── INVESTOR feed ────────────────────────────────────────────────────
  if (role === 'INVESTOR' && uid) {
    const [invites, notices] = await Promise.all([
      fetchInvitations(uid).catch(() => []),
      listInvestorNotices().catch(() => []),
    ]);

    // Live invitations
    for (const inv of invites) {
      if (inv.status === 'DECLINED') continue;
      const projectName = inv.projectName ?? 'a project';
      const fallbackTime =
        inv.pledgedAt ?? inv.verifiedAt ?? new Date(0).toISOString();
      const projectRef = inv.paymentReference?.split('-').slice(0, 2).join('-');

      const projectHref = String(investorProjectHref(inv.projectId, inv.id));

      if (inv.status === 'INVITED' || inv.status === 'ACCEPTED') {
        out.push({
          id: `inv-${inv.id}`,
          type: 'invite-received',
          title: 'You have a project invitation',
          message: `Review the invitation to ${projectName}.`,
          reference: projectRef,
          href: projectHref,
          createdAt: fallbackTime,
          icon: 'mail',
        });
      }
      if (inv.status === 'COMMITTED' || inv.status === 'PROOF_SUBMITTED') {
        out.push({
          id: `pay-${inv.id}`,
          type: 'invite-payment-pending',
          title:
            inv.status === 'PROOF_SUBMITTED'
              ? 'Awaiting Line Manager confirmation'
              : 'Payment pending',
          message: `${projectName} · complete the transfer to allot your units.`,
          reference: inv.paymentReference ?? projectRef,
          href: projectHref,
          createdAt: inv.pledgedAt ?? fallbackTime,
          icon: 'clock',
        });
      }
      if (inv.status === 'CONFIRMED') {
        out.push({
          id: `conf-${inv.id}`,
          type: 'payment-confirmed',
          title: 'Payment confirmed · units allotted',
          message: `${projectName} · ${inv.unitsAllotted ?? '—'} units credited.`,
          reference: inv.paymentReference ?? projectRef,
          href: projectHref,
          createdAt: inv.verifiedAt ?? fallbackTime,
          icon: 'check-circle',
        });
      }

      // Pledge expiring in ≤ 12h — stable createdAt so acknowledge can clear the badge.
      if (inv.pledgeExpiresAt && (inv.status === 'COMMITTED' || inv.status === 'PROOF_SUBMITTED')) {
        const expiryMs = new Date(inv.pledgeExpiresAt).getTime();
        const hoursLeft = (expiryMs - now) / (1000 * 60 * 60);
        if (hoursLeft > 0 && hoursLeft <= 12) {
          out.push({
            id: `expire-${inv.id}`,
            type: 'pledge-expiring',
            title: 'Pledge expires soon',
            message: `${projectName} · pledge expires in ${Math.max(1, Math.round(hoursLeft))}h.`,
            reference: inv.paymentReference ?? projectRef,
            href: projectHref,
            createdAt: inv.pledgedAt ?? inv.pledgeExpiresAt,
            icon: 'alert-triangle',
          });
        }
      }
    }

    // Distribution notices
    for (const n of notices) {
      out.push({
        id: `notice-${n.id}`,
        type: 'notice-minted',
        title: n.isFinal ? 'Final distribution issued' : 'New distribution notice',
        message: `${n.projectName} · your share ${formatKoboShort(n.profitMinor)}${n.isFinal ? ` + capital ${formatKoboShort(n.capitalReturnedMinor)}` : ''}.`,
        reference: n.reference,
        href: `/(tabs)/statements`,
        createdAt: n.createdAt,
        icon: 'file-text',
      });
    }
  }

  // ── LINE MANAGER feed ────────────────────────────────────────────────
  if (role === 'LINE_MANAGER' && uid) {
    // Proof-submitted invites need LM confirmation. Filter by projects.created_by
    // (Prism Line Manager), not project_owner_id (originator).
    const { data, error } = await supabase
      .from('invites')
      .select(
        'id, project_id, status, payment_reference, updated_at, projects!inner(name, code, created_by), profiles!invites_investor_id_fkey(full_name)',
      )
      .eq('status', 'PROOF_SUBMITTED')
      .eq('projects.created_by', uid)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Skip live rows already covered by a persisted PROOF_SUBMITTED (same invite).
      const coveredInviteIds = new Set(
        out
          .filter((n) => n.type === 'proof-submitted' && n.href.includes('invite='))
          .map((n) => {
            try {
              return new URLSearchParams(n.href.split('?')[1] ?? '').get('invite');
            } catch {
              return null;
            }
          })
          .filter((id): id is string => !!id),
      );

      for (const row of data as Array<Record<string, unknown>>) {
        const proj = row.projects as { name?: string; code?: string; created_by?: string } | null;
        const investor = row.profiles as { full_name?: string } | null;
        const inviteId = String(row.id);
        const projectId = String(row.project_id);
        if (coveredInviteIds.has(inviteId)) continue;
        out.push({
          id: `proof-${inviteId}`,
          type: 'proof-submitted',
          title: 'Payment proof submitted',
          message: `${investor?.full_name ?? 'Investor'} · ${proj?.name ?? proj?.code ?? 'Project'} awaits confirmation.`,
          reference: (row.payment_reference as string | undefined) ?? proj?.code,
          href: String(managerConfirmProofHref(projectId, inviteId)),
          createdAt: (row.updated_at as string | undefined) ?? new Date().toISOString(),
          icon: 'upload',
        });
      }
    }
  }

  // ── CEO / ADMIN feed ─────────────────────────────────────────────────
  if (role === 'ADMIN' || role === 'CEO') {
    const declarations = await fetchPendingDeclarations().catch(() => []);
    const projRes = await supabase
      .from('projects')
      .select('id, code, name, submitted_at, approval_status')
      .eq('approval_status', 'PENDING')
      .order('submitted_at', { ascending: false })
      .limit(20)
      .then((r) => r)
      .catch(() => ({ data: [] as Array<Record<string, unknown>>, error: null }));

    for (const d of declarations) {
      out.push({
        id: `decl-${d.id}`,
        type: 'declaration-pending',
        title: 'Declaration awaiting approval',
        message: `${d.label ?? d.reference} · investor pool ${formatKoboShort(d.investorPoolMinor)}.`,
        reference: d.reference,
        href: `/projects/${d.projectId}?tab=profits`,
        createdAt: d.declaredAt,
        icon: 'shield',
      });
    }
    for (const p of (projRes.data ?? []) as Array<Record<string, unknown>>) {
      out.push({
        id: `proj-${p.id}`,
        type: 'project-pending',
        title: 'Project awaits approval',
        message: `${p.code} · ${p.name}`,
        reference: p.code as string | undefined,
        href: `/projects/${p.id}`,
        createdAt: (p.submitted_at as string | undefined) ?? new Date().toISOString(),
        icon: 'folder',
      });
    }
  }

  // Sort desc by createdAt
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return out;
}

// ── unread tracking (memory + localStorage) ────────────────────────────
function readStorageKey(userId: string | null): string {
  return `prism.notifications.lastReadAt.${userId ?? 'anon'}`;
}

const lastReadMemory = new Map<string, string>();

export function getLastReadAt(userId: string | null): string {
  const key = userId ?? 'anon';
  const mem = lastReadMemory.get(key);
  if (mem) return mem;
  if (typeof window === 'undefined' || !window.localStorage) return new Date(0).toISOString();
  return window.localStorage.getItem(readStorageKey(userId)) ?? new Date(0).toISOString();
}

export function markAllRead(userId: string | null): void {
  const iso = new Date().toISOString();
  const key = userId ?? 'anon';
  lastReadMemory.set(key, iso);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(readStorageKey(userId), iso);
  }
  // Also stamp persisted rows server-side (fire-and-forget; RLS scopes to own rows).
  if (userId) {
    supabase
      .from('notifications')
      .update({ read_at: iso })
      .eq('user_id', userId)
      .is('read_at', null)
      .then(() => {});
  }
}

// ── helpers ─────────────────────────────────────────────────────────────
function formatKoboShort(minor: number): string {
  const n = minor / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${Math.round(n).toLocaleString('en-NG')}`;
}

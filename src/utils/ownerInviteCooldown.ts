/** Cooldown between project-owner invite emails (UI + API). */
export const OWNER_INVITE_RESEND_MS = 5 * 60 * 1000;

function storageKey(projectId: string): string {
  return `prism.ownerInvite.lastSent.${projectId}`;
}

export function getOwnerInviteLastSentAt(projectId: string): number | null {
  if (!projectId) return null;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function markOwnerInviteSent(projectId: string, at = Date.now()): void {
  if (!projectId) return;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(storageKey(projectId), String(at));
  } catch {
    /* best-effort */
  }
}

export function ownerInviteResendRemainingMs(projectId: string, now = Date.now()): number {
  const last = getOwnerInviteLastSentAt(projectId);
  if (!last) return 0;
  return Math.max(0, OWNER_INVITE_RESEND_MS - (now - last));
}

export function formatResendCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

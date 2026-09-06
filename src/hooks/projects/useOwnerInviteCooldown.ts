import { useEffect, useState, useCallback } from 'react';
import { ownerInviteResendRemainingMs } from '@/src/utils/ownerInviteCooldown';

/** Tick the owner-invite resend cooldown. */
export function useOwnerInviteCooldown(projectId: string) {
  const [remainingMs, setRemainingMs] = useState(0);
  const active = remainingMs > 0;

  const refresh = useCallback(() => {
    if (!projectId) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(ownerInviteResendRemainingMs(projectId));
  }, [projectId]);

  useEffect(() => {
    refresh();
    if (!projectId) return;
    if (!active && ownerInviteResendRemainingMs(projectId) <= 0) return;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [projectId, active, refresh]);

  return { remainingMs, refresh };
}


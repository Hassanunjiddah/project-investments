import { useCallback, useEffect, useRef } from 'react';

type Options = {
  /** How long of no activity before the "you'll be signed out" warning fires. Default 29m. */
  warnAfterMs?: number;
  /** How long between warning and hard expire. Default 60s. */
  expireAfterWarnMs?: number;
  /** When we transition idle → warning. */
  onWarn: () => void;
  /** When the idle period fully elapses. */
  onExpire: () => void;
  /** Optional gate — pass `false` to disable (e.g. no active session). */
  enabled?: boolean;
};

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'visibilitychange',
] as const;

/**
 * Idle-timeout hook. Fires `onWarn` after `warnAfterMs` of no user activity,
 * then `onExpire` `expireAfterWarnMs` later unless the caller calls `reset()`
 * (e.g. "Stay signed in"). Activity during the warning window does not reset —
 * the user must confirm explicitly.
 *
 * Web-only — noops on native (RN has its own idle strategies).
 */
export function useIdleTimeout({
  warnAfterMs = 29 * 60 * 1000,
  expireAfterWarnMs = 60 * 1000,
  onWarn,
  onExpire,
  enabled = true,
}: Options): { reset: () => void } {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);
  const onWarnRef = useRef(onWarn);
  const onExpireRef = useRef(onExpire);
  onWarnRef.current = onWarn;
  onExpireRef.current = onExpire;

  const clearAll = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
    warnTimer.current = null;
    expireTimer.current = null;
  }, []);

  const scheduleWarn = useCallback(() => {
    clearAll();
    warned.current = false;
    warnTimer.current = setTimeout(() => {
      warned.current = true;
      onWarnRef.current();
      expireTimer.current = setTimeout(() => onExpireRef.current(), expireAfterWarnMs);
    }, warnAfterMs);
  }, [clearAll, warnAfterMs, expireAfterWarnMs]);

  const reset = useCallback(() => {
    scheduleWarn();
  }, [scheduleWarn]);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const onActivity = () => {
      if (warned.current) return;
      scheduleWarn();
    };

    scheduleWarn();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      clearAll();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [enabled, scheduleWarn, clearAll]);

  return { reset };
}

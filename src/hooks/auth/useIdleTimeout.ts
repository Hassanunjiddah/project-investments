import { useEffect, useRef } from 'react';

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

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'visibilitychange',
];

/**
 * Idle-timeout hook. Fires `onWarn` after `warnAfterMs` of no user activity,
 * then `onExpire` `expireAfterWarnMs` later unless activity resumes.
 *
 * Web-only — noops on native (RN has its own idle strategies).
 */
export function useIdleTimeout({
  warnAfterMs = 29 * 60 * 1000,
  expireAfterWarnMs = 60 * 1000,
  onWarn,
  onExpire,
  enabled = true,
}: Options) {
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warned = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    const clearAll = () => {
      if (warnTimer.current) clearTimeout(warnTimer.current);
      if (expireTimer.current) clearTimeout(expireTimer.current);
      warnTimer.current = null;
      expireTimer.current = null;
    };

    const scheduleWarn = () => {
      clearAll();
      warned.current = false;
      warnTimer.current = setTimeout(() => {
        warned.current = true;
        onWarn();
        expireTimer.current = setTimeout(onExpire, expireAfterWarnMs);
      }, warnAfterMs);
    };

    const onActivity = () => {
      // If we're currently in the warning window, don't cancel — the user
      // must explicitly hit "Stay signed in" to reset. This prevents a lucky
      // stray mouse move from silently keeping a stale session alive.
      if (warned.current) return;
      scheduleWarn();
    };

    scheduleWarn();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      clearAll();
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
    };
  }, [warnAfterMs, expireAfterWarnMs, onWarn, onExpire, enabled]);
}

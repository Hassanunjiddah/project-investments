/** localStorage flag — when `'false'`, auth tokens use sessionStorage only. */
export const KEEP_SIGNED_IN_KEY = 'prism.keepSignedIn';

/**
 * sessionStorage gate — set only after the user enters their password in
 * this browser tab. Survives refresh, dies when the tab/window closes.
 * Restored Supabase tokens alone never unlock the workspace.
 */
export const GATE_UNLOCKED_KEY = 'prism.gateUnlocked';

export function loadKeepSignedIn(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const v = window.localStorage.getItem(KEEP_SIGNED_IN_KEY);
  // Default OFF — financial workspace requires an explicit opt-in to persist.
  return v === 'true';
}

export function saveKeepSignedIn(keep: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(KEEP_SIGNED_IN_KEY, String(keep));
}

export function isGateUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(GATE_UNLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGateUnlocked(unlocked: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) {
      window.sessionStorage.setItem(GATE_UNLOCKED_KEY, '1');
    } else {
      window.sessionStorage.removeItem(GATE_UNLOCKED_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

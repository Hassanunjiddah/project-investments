/** localStorage flag — when `'false'`, auth tokens use sessionStorage only. */
export const KEEP_SIGNED_IN_KEY = 'prism.keepSignedIn';

export function loadKeepSignedIn(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  const v = window.localStorage.getItem(KEEP_SIGNED_IN_KEY);
  return v === null ? true : v === 'true';
}

export function saveKeepSignedIn(keep: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(KEEP_SIGNED_IN_KEY, String(keep));
}

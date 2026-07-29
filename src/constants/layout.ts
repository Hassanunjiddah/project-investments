import { Platform, useWindowDimensions } from 'react-native';

/**
 * Single source of truth for responsive shell geometry.
 * All breakpoint / rail / panel values must come from here — never hardcode
 * these in components (960 vs 1024 drift caused half-desktop layouts before).
 */

/** Viewport width at which the web app switches to the desktop shell. */
export const DESKTOP_BREAKPOINT = 960;

/** Width of the fixed desktop left navigation rail. */
export const RAIL_WIDTH = 240;

/** Width of the right-hand context panel on desktop detail screens. */
export const CONTEXT_PANEL_WIDTH = 320;

/** Max readable width for single-column forms on desktop. */
export const FORM_MAX_WIDTH = 640;

/** True when the current viewport should use the desktop shell (web only). */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

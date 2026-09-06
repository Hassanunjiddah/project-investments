import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

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

/**
 * Web pages scroll on the document, not inside a locked RN viewport.
 * `minHeight` fills short screens; `overflow: 'visible'` lets content grow
 * (RN Views default to overflow hidden, which clips and eats wheel events).
 * Do not set `height` — that re-locks the shell and kills window scroll.
 */
export function useWebFillStyle(): ViewStyle {
  const { height } = useWindowDimensions();
  if (Platform.OS !== 'web') {
    return { flex: 1, width: '100%' };
  }
  const vh =
    typeof window !== 'undefined' && window.innerHeight
      ? window.innerHeight
      : height;
  return {
    flexGrow: 1,
    width: '100%',
    minHeight: vh,
    overflow: 'visible',
  };
}

/** Web: let the window scroll. Native: the list itself scrolls. */
export const listScrollEnabled = Platform.OS !== 'web';

/**
 * List container style. Native: bounded box so the list scrolls internally.
 * Web: natural height (`flex: 1` would pin the list to the scrollport height,
 * RN-web clips the overflow, and the page never gets anything to scroll).
 */
export const listFillStyle: ViewStyle =
  Platform.OS === 'web'
    ? // RN-web ScrollView defaults to flexShrink:1, which compresses the list
      // to the scrollport height and clips it. Force natural height instead.
      { flexGrow: 0, flexShrink: 0 }
    : { flex: 1, minHeight: 0 };


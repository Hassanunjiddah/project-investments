import { Platform, type ViewStyle } from 'react-native';
import { colors } from '@/src/constants/colors';
import type { ColorScheme } from '@/src/constants/colors';

/**
 * Cross-platform focus-ring style fragment. On web it uses a real
 * `outline` (2px solid gold + 4px halo via `outline-offset`) so we don't
 * fight the browser's default focus behaviour. On native RN it falls back
 * to a colored border that toggles on `focused`.
 *
 * Usage on RN-Web (Pressable / TextInput):
 *   style={{
 *     ...(focused ? focusRingStyle(scheme) : null),
 *   }}
 *
 * Usage on native: add `focusRingStyle(scheme, focused)` conditionally.
 */
export function focusRingStyle(
  scheme: ColorScheme,
  focused: boolean = true,
): ViewStyle {
  if (!focused) return {};
  const ring = colors[scheme].focusRing;

  if (Platform.OS === 'web') {
    return {
      outlineStyle: 'solid',
      outlineColor: ring.ring,
      outlineWidth: 2,
      outlineOffset: 2,
      boxShadow: `0 0 0 4px ${ring.halo}`,
    } as ViewStyle;
  }
  return { borderColor: ring.ring, borderWidth: 2 };
}

/**
 * Web-only helper: apply this to a component that already carries a
 * default 3-side border to avoid double-outline collisions. Returns an
 * empty object on native.
 */
export function webFocusOutlineReset(): ViewStyle {
  if (Platform.OS !== 'web') return {};
  return {
    outlineStyle: 'none',
  } as unknown as ViewStyle;
}

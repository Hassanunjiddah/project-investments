import {
  Pressable,
  View,
  StyleSheet,
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';

type Tone = 'default' | 'brand' | 'success' | 'warning' | 'danger';

type Props = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Higher elevation for hero cards. Defaults to `sm`. */
  elevated?: keyof typeof elevation;
  /** Pressable behavior: `false` renders a plain View. */
  interactive?: boolean;
  /** Accent tone — tints border, subtle background wash, or none. */
  tone?: Tone;
  /** Remove default padding — used by cards that need edge-to-edge content. */
  flush?: boolean;
};

/**
 * Prism Capital Card — Phase B refresh.
 *
 * Softer navy-tinted shadows in light theme (was pure #000 rgba which
 * felt harsh). Tonal accent tints via the `tone` prop for cards that
 * need to feel "warning" or "success" without a full banner.
 *
 * Backwards compatible: `elevated`, `interactive`, `style`, all props
 * on Pressable retained.
 */
export function Card({
  children,
  style,
  elevated = 'sm',
  interactive = true,
  tone = 'default',
  flush = false,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  // Navy-tinted shadow set — replaces the raw #000 shadow of the old
  // system so drop-shadows feel like they belong in the same palette.
  const navyShadow = {
    sm: {
      shadowColor: '#0A1F3D',
      shadowOpacity: scheme === 'light' ? 0.06 : 0,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    md: {
      shadowColor: '#0A1F3D',
      shadowOpacity: scheme === 'light' ? 0.09 : 0,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
    lg: {
      shadowColor: '#0A1F3D',
      shadowOpacity: scheme === 'light' ? 0.14 : 0,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  }[elevated];

  const toneAccent = {
    default: { bg: palette.surface,          border: palette.border },
    brand:   { bg: palette.brand[50],        border: palette.brand[100] },
    success: { bg: palette.semantic.success.bg, border: palette.semantic.success.border },
    warning: { bg: palette.semantic.warning.bg, border: palette.semantic.warning.border },
    danger:  { bg: palette.semantic.danger.bg,  border: palette.semantic.danger.border },
  }[tone];

  const baseStyle: ViewStyle = {
    backgroundColor: toneAccent.bg,
    borderColor: toneAccent.border,
    padding: flush ? 0 : spacing.md + 4,
    ...navyShadow,
  };

  if (!interactive) {
    return <View style={[styles.card, baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.card,
        baseStyle,
        Platform.OS === 'web' && hovered
          ? {
              transform: [{ translateY: -2 }],
              shadowOpacity: scheme === 'light' ? 0.16 : 0,
              shadowRadius: 18,
            }
          : null,
        pressed ? { opacity: 0.95, transform: [{ scale: 0.997 }] } : null,
        style,
      ]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.card,
    marginBottom: spacing.sm + 4,
    transitionProperty: 'transform, box-shadow, opacity, background-color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
  },
});

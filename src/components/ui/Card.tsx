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

type Props = Omit<PressableProps, 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Higher elevation for hero cards. Defaults to `sm` (barely-there). */
  elevated?: keyof typeof elevation;
  /** Pressable behavior: `false` renders a plain View so tap doesn't feel weird. */
  interactive?: boolean;
};

/**
 * Refined card (Feb 2026): larger radius (16px), quiet 1px border, subtle
 * shadow, hover-lift on web only. When `interactive={false}` renders a
 * plain View so decorative cards don't add tap noise.
 */
export function Card({
  children,
  style,
  elevated = 'sm',
  interactive = true,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const shadow = elevation[elevated];

  const baseStyle: ViewStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    ...shadow,
  };

  if (!interactive) {
    return <View style={[styles.card, baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      style={({ pressed, hovered }) => [
        styles.card,
        baseStyle,
        // Hover-lift on web (RN-Web supports `hovered`); mobile ignores it.
        Platform.OS === 'web' && hovered
          ? { transform: [{ translateY: -1 }], ...elevation.md }
          : null,
        pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null,
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
    borderRadius: radii.lg,
    padding: spacing.md + 4,
    marginBottom: spacing.sm + 4,
    // @ts-expect-error web-only CSS property (RN-Web accepts this)
    transitionProperty: 'transform, box-shadow, opacity',
    transitionDuration: '160ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
});

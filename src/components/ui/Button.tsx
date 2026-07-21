import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'outlineDanger';
type ButtonSize = 'md' | 'sm' | 'lg';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  'data-testid'?: string;
};

/**
 * Refined button (Feb 2026): rounded-xl (12px) surface, weightier text,
 * springy press state (scale 0.97), refined disabled state that reads as
 * "off" without looking dead grey. Touch target 44px+ per accessibility.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const testId = (props as Record<string, unknown>)['data-testid'] as string | undefined;
  const restProps = props as PressableProps & Record<string, unknown>;

  const variantStyles = {
    primary: { bg: palette.primary, text: '#FFFFFF', border: 'transparent' },
    secondary: { bg: palette.surfaceMuted, text: palette.text, border: 'transparent' },
    danger: { bg: palette.error, text: '#FFFFFF', border: 'transparent' },
    outline: { bg: 'transparent', text: palette.primary, border: palette.primary },
    outlineDanger: { bg: 'transparent', text: palette.error, border: palette.error },
  }[variant];

  const isOutline = variant === 'outline' || variant === 'outlineDanger';
  const sizeStyle = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const textSizeStyle = size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;

  const isDisabled = disabled || loading;
  // Disabled uses a *tinted* muted surface rather than a dead grey — reads as
  // "off" but keeps a hint of the palette so it doesn't feel like a broken
  // element.
  const disabledBg = isOutline ? 'transparent' : palette.surfaceMuted;
  const disabledText = palette.muted;

  return (
    <Pressable
      testID={testId}
      style={({ pressed }) => [
        styles.button,
        sizeStyle,
        {
          backgroundColor: isDisabled ? disabledBg : variantStyles.bg,
          borderColor: isDisabled && isOutline ? palette.border : variantStyles.border,
          borderWidth: isOutline ? 1 : 0,
          opacity: isDisabled ? 0.8 : 1,
          // Springy scale on press — RN-Web renders this as a CSS transform.
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
        },
        style,
      ]}
      disabled={isDisabled}
      {...restProps}
    >
      {loading ? (
        <ActivityIndicator color={isDisabled ? disabledText : variantStyles.text} />
      ) : (
        <Text
          style={[
            styles.text,
            textSizeStyle,
            { color: isDisabled ? disabledText : variantStyles.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    // @ts-expect-error web-only CSS property (RN-Web accepts this)
    transitionProperty: 'transform, opacity, background-color',
    transitionDuration: '150ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  md: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  sm: {
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm + 4,
  },
  lg: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  text: {
    fontWeight: typography.weights.semibold,
    letterSpacing: -0.1,
  },
  textMd: { fontSize: typography.sizes.sm },
  textSm: { fontSize: typography.sizes.xs },
  textLg: { fontSize: typography.sizes.md },
});

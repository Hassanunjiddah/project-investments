import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  Platform,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '@/src/constants/colors';
import { spacing, radii, motion } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'            // NEW — light-blue tinted surface with navy text
  | 'danger'
  | 'outline'
  | 'outlineDanger'
  | 'ghost';          // NEW — text-only, no chrome

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonShape = 'rounded' | 'pill';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Corner shape. Defaults to 'rounded' (12px). 'pill' → fully rounded. */
  shape?: ButtonShape;
  /** Loading spinner replaces the text. */
  loading?: boolean;
  /** Full-width flex 1. Defaults false. */
  fullWidth?: boolean;
  /** Node to render before the label (e.g. an <Icon />). */
  leftIcon?: ReactNode;
  /** Node to render after the label. */
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  'data-testid'?: string;
};

/**
 * Prism Capital Button — Phase B refresh.
 *
 * New in Phase B:
 * • `soft` variant  — light-blue tinted fill with navy text (used for
 *                     Portfolio secondary CTAs and inline confirmations).
 * • `ghost` variant — chrome-less link-style button.
 * • `pill` shape    — fully rounded (999) for hero CTAs & action tiles.
 * • Icon slots     — leftIcon / rightIcon render alongside the label.
 * • Hover-lift    — on web, hover raises the button 1px + softens shadow.
 *
 * Backwards compatible: `variant`, `size`, `loading`, `disabled`,
 * `data-testid` all keep their old semantics.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  loading,
  fullWidth,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const testId = (props as Record<string, unknown>)['data-testid'] as string | undefined;
  const restProps = props as PressableProps & Record<string, unknown>;

  const variantStyles = {
    primary:       { bg: palette.primary,        text: '#FFFFFF',           border: 'transparent',    hoverBg: palette.primaryHover },
    secondary:     { bg: palette.surfaceMuted,   text: palette.text,        border: 'transparent',    hoverBg: palette.brand[100] },
    soft:          { bg: palette.brand[50],      text: palette.brand[700],  border: palette.brand[100], hoverBg: palette.brand[100] },
    danger:        { bg: palette.error,          text: '#FFFFFF',           border: 'transparent',    hoverBg: palette.semantic.danger.fg },
    outline:       { bg: 'transparent',          text: palette.primary,     border: palette.primary,  hoverBg: palette.brand[50] },
    outlineDanger: { bg: 'transparent',          text: palette.error,       border: palette.error,    hoverBg: palette.semantic.danger.bg },
    ghost:         { bg: 'transparent',          text: palette.brand[700],  border: 'transparent',    hoverBg: palette.brand[50] },
  }[variant];

  const isOutline = variant === 'outline' || variant === 'outlineDanger';
  const isGhost = variant === 'ghost';
  const isSoft = variant === 'soft';

  const sizeStyle = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const textSizeStyle = size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  const isDisabled = disabled || loading;
  const disabledBg = isOutline || isGhost ? 'transparent' : palette.surfaceMuted;
  const disabledText = palette.muted;

  const cornerRadius =
    shape === 'pill' ? radii.chip : size === 'lg' ? radii.md : radii.button;

  return (
    <Pressable
      testID={testId}
      style={({ pressed, hovered }) => [
        styles.button,
        sizeStyle,
        { borderRadius: cornerRadius },
        fullWidth && styles.fullWidth,
        {
          backgroundColor: isDisabled
            ? disabledBg
            : hovered && Platform.OS === 'web'
              ? variantStyles.hoverBg
              : variantStyles.bg,
          borderColor: isDisabled && (isOutline || isSoft)
            ? palette.border
            : variantStyles.border,
          borderWidth: isOutline || isSoft ? 1 : 0,
          opacity: isDisabled ? 0.75 : 1,
          transform: [
            {
              scale:
                pressed && !isDisabled
                  ? 0.97
                  : hovered && !isDisabled && !isGhost && Platform.OS === 'web'
                    ? 1.005
                    : 1,
            },
            {
              translateY:
                hovered && !isDisabled && variant === 'primary' && Platform.OS === 'web' ? -1 : 0,
            },
          ],
        },
        style,
      ]}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      {...restProps}
    >
      {loading ? (
        <ActivityIndicator color={isDisabled ? disabledText : variantStyles.text} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? (
            <View style={styles.iconSlot}>{withIconTone(leftIcon, isDisabled ? disabledText : variantStyles.text, iconSize)}</View>
          ) : null}
          <Text
            style={[
              styles.text,
              textSizeStyle,
              { color: isDisabled ? disabledText : variantStyles.text },
            ]}
          >
            {title}
          </Text>
          {rightIcon ? (
            <View style={styles.iconSlot}>{withIconTone(rightIcon, isDisabled ? disabledText : variantStyles.text, iconSize)}</View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

// Consumers can pass either a JSX element or a function that receives
// (tone, size). Both are supported.
function withIconTone(icon: ReactNode, tone: string, size: number): ReactNode {
  if (typeof icon === 'function') {
    return (icon as (tone: string, size: number) => ReactNode)(tone, size);
  }
  return icon;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: 'transform, background-color, box-shadow, border-color',
    transitionDuration: `${motion.duration.std}ms`,
    transitionTimingFunction: motion.easing.standard,
  },
  fullWidth: { alignSelf: 'stretch', flex: 1 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: 44, paddingVertical: 12, paddingHorizontal: spacing.md },
  sm: { minHeight: 36, paddingVertical: 8,  paddingHorizontal: spacing.sm + 4 },
  lg: { minHeight: 52, paddingVertical: 14, paddingHorizontal: spacing.lg },
  text: {
    fontWeight: typography.weights.semibold,
    letterSpacing: -0.1,
  },
  textMd: { fontSize: typography.sizes.sm },
  textSm: { fontSize: typography.sizes.xs },
  textLg: { fontSize: typography.sizes.md },
});

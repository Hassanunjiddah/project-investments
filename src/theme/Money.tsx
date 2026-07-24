import { Text, type TextProps, type TextStyle, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { typography, tabularNums } from '@/src/constants/typography';

type Variant = 'body' | 'strong' | 'display' | 'hero';

type Props = TextProps & {
  /** Numeric value in MINOR units (kobo). */
  amount: number;
  /** Show ₦ symbol prefix (default true). */
  showSymbol?: boolean;
  /** Show decimals below ₦1 (default false — most flows are whole naira). */
  showDecimals?: boolean;
  /** Text variant. */
  variant?: Variant;
  /** Extra style. */
  style?: TextProps['style'];
  /** Optional color override; defaults to `text`. */
  color?: string;
};

/**
 * `<Money />` — the single source of truth for rendering monetary figures.
 * Always tabular-numeric, always locale-formatted, always aligned right.
 * Use this in place of any hand-rolled `₦${amount / 100}` interpolation.
 */
export function Money({
  amount,
  showSymbol = true,
  showDecimals = false,
  variant = 'body',
  style,
  color,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const naira = amount / 100;
  const formatted = showDecimals
    ? naira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(naira).toLocaleString('en-NG');

  const variantStyle: TextStyle =
    variant === 'hero'
      ? {
          fontFamily: typography.families.display,
          fontSize: typography.display.lg.fontSize,
          lineHeight: typography.display.lg.lineHeight,
          letterSpacing: typography.display.lg.letterSpacing,
          fontWeight: typography.display.lg.fontWeight,
        }
      : variant === 'display'
        ? {
            fontFamily: typography.families.display,
            fontSize: typography.display.md.fontSize,
            lineHeight: typography.display.md.lineHeight,
            letterSpacing: typography.display.md.letterSpacing,
            fontWeight: typography.display.md.fontWeight,
          }
        : variant === 'strong'
          ? {
              fontFamily: typography.families.ui,
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.semibold,
            }
          : {
              fontFamily: typography.families.ui,
              fontSize: typography.sizes.md,
              fontWeight: typography.weights.regular,
            };

  return (
    <Text
      style={[
        styles.base,
        tabularNums,
        variantStyle,
        { color: color ?? palette.text },
        style,
      ]}
      {...props}
    >
      {showSymbol ? '₦' : ''}
      {formatted}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    // Web-only: right alignment happens at the container level; here we
    // just make sure inline flow is clean.
    textAlign: 'right',
  },
});

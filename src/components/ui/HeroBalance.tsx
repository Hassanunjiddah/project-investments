import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { CountUp } from '@/src/components/ui/CountUp';
import { formatNaira } from '@/src/utils/currency';

type Props = {
  /** Big label above the amount, e.g. "TOTAL INVESTED" or "AVAILABLE BALANCE". */
  label?: string;
  /** Value in kobo minor units (integer). */
  valueMinor: number;
  /** Optional prefix currency mark. Defaults to '₦'. */
  currency?: string;
  /** Optional delta chip content — e.g. "+₦45,000 this month". */
  delta?: { label: string; direction?: 'up' | 'down' | 'neutral' };
  /** Optional subtitle line below (e.g. "as of 27 Jul"). */
  subtitle?: string;
  /** Suppress the CountUp animation on mount (used when embedded in lists). */
  staticValue?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Override alignment. Defaults to 'left'. */
  align?: 'left' | 'center';
  /** Overall size. Defaults to 'lg'. */
  size?: 'md' | 'lg' | 'xl';
};

/**
 * HeroBalance — the marquee monetary display used on Home, Portfolio,
 * Earnings, and Statements. Editorial serif for the numeric value, tiny
 * eyebrow label, optional delta chip, and a CountUp on mount that
 * respects reduce-motion.
 */
export function HeroBalance({
  label,
  valueMinor,
  currency = '₦',
  delta,
  subtitle,
  staticValue = false,
  style,
  align = 'left',
  size = 'lg',
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const naira = valueMinor / 100;
  const numberSize = size === 'xl' ? 56 : size === 'md' ? 34 : 44;
  const lineHeight = size === 'xl' ? 60 : size === 'md' ? 38 : 48;

  const deltaTone =
    delta?.direction === 'up'
      ? palette.semantic.success
      : delta?.direction === 'down'
        ? palette.semantic.danger
        : palette.semantic.info;

  return (
    <View style={[styles.wrap, align === 'center' && styles.center, style]}>
      {label ? (
        <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      ) : null}

      <View style={styles.valueRow}>
        <Text
          style={[
            styles.currency,
            {
              color: palette.textSecondary,
              fontSize: Math.round(numberSize * 0.5),
              lineHeight,
            },
          ]}
        >
          {currency}
        </Text>
        {staticValue ? (
          <Text
            style={[
              styles.value,
              tabularNums,
              { color: palette.text, fontSize: numberSize, lineHeight },
            ]}
          >
            {Math.round(naira).toLocaleString('en-NG')}
          </Text>
        ) : (
          <CountUp
            to={naira}
            style={{
              ...styles.value,
              ...tabularNums,
              color: palette.text,
              fontSize: numberSize,
              lineHeight,
            }}
            format={(n) =>
              // Show up to two decimals only if there are kobo. Keeps the
              // hero clean for round amounts while remaining accurate.
              Math.abs(naira - Math.floor(naira)) < 0.005
                ? Math.round(n).toLocaleString('en-NG')
                : n.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
            }
          />
        )}
      </View>

      {(delta || subtitle) && (
        <View style={[styles.footer, align === 'center' && styles.centerRow]}>
          {delta ? (
            <View
              style={[
                styles.deltaChip,
                { backgroundColor: deltaTone.bg, borderColor: deltaTone.border },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  tabularNums,
                  { color: deltaTone.fg },
                ]}
              >
                {delta.direction === 'up' ? '↑ ' : delta.direction === 'down' ? '↓ ' : ''}
                {delta.label}
              </Text>
            </View>
          ) : null}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Convenience: format an amount for a delta chip. */
export function formatDelta(minor: number): { label: string; direction: 'up' | 'down' | 'neutral' } {
  if (minor === 0) return { label: '±' + formatNaira(0), direction: 'neutral' };
  return {
    label: (minor > 0 ? '+' : '') + formatNaira(minor),
    direction: minor > 0 ? 'up' : 'down',
  };
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs + 2,
    // Serif figures with negative letter-spacing can paint past the left edge;
    // a hair of padding keeps the ₦ and first digit visible inside cards.
    paddingLeft: 2,
  },
  center: { alignItems: 'center', paddingLeft: 0 },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'wrap',
  },
  currency: {
    fontFamily: typography.families.display,
    fontWeight: typography.weights.medium,
  },
  value: {
    fontFamily: typography.families.display,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  centerRow: { justifyContent: 'center' },
  deltaChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  deltaText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: 20,
  },
});

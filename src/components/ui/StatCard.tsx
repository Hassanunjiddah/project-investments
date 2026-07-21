import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  change?: string;
  changePositive?: boolean;
  /**
   * When true, the card renders in the "hero" style (larger value, more
   * generous padding, tinted background) suitable for the primary metric
   * in a bento grid.
   */
  hero?: boolean;
};

/**
 * Refined stat card (Feb 2026): icon tile has a soft tinted background,
 * value uses tabular-nums for aligned digits, subtle border + shadow.
 * Hero variant blows up the value + adds a primary-tinted background for
 * dashboard-defining metrics.
 */
export function StatCard({
  label,
  value,
  icon,
  change,
  changePositive = true,
  hero = false,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const bg = hero ? palette.primaryLight : palette.surface;
  const iconBg = hero ? palette.surface : palette.primaryLight;
  const iconColor = palette.primary;

  return (
    <View
      style={[
        styles.card,
        hero ? styles.heroCard : styles.regularCard,
        {
          backgroundColor: bg,
          borderColor: hero ? 'transparent' : palette.border,
          ...(hero ? elevation.md : elevation.sm),
        },
      ]}
    >
      <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={hero ? 20 : 16} color={iconColor} />
      </View>
      <Text
        style={[
          styles.label,
          { color: palette.textSecondary, marginTop: hero ? spacing.md : spacing.sm },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          hero ? styles.heroValue : styles.value,
          { color: hero ? palette.primary : palette.text },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {change ? (
        <Text
          style={[styles.change, { color: changePositive ? palette.success : palette.warning }]}
          numberOfLines={1}
        >
          {change}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  card: {
    minWidth: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  regularCard: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: spacing.md,
  },
  heroCard: {
    flexGrow: 1,
    flexBasis: '100%',
    padding: spacing.lg,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.4,
    marginTop: 2,
    // @ts-expect-error web-only CSS property
    fontVariantNumeric: 'tabular-nums',
  },
  heroValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.8,
    marginTop: 4,
    // @ts-expect-error web-only CSS property
    fontVariantNumeric: 'tabular-nums',
  },
  change: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: 4,
  },
});

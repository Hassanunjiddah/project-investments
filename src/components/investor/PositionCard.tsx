import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import type { PortfolioEntry } from '@/src/types/portfolio.types';

type Props = {
  entry: PortfolioEntry;
  onPress?: () => void;
};

/**
 * PositionCard — investor's per-project holding row on the Home screen.
 *
 * Robinhood-style compact card that surfaces the mark-to-market picture
 * at a glance:
 *   - Project name & sector on the left
 *   - "Units × NAV/unit" on the right
 *   - Position value + P&L pill on the bottom row
 *
 * Auto-updates when a profit declaration is approved because the parent
 * screen re-fetches via TanStack Query on realtime invalidation.
 */
export function PositionCard({ entry, onPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const isUp = entry.pnlMinor >= 0;
  const pnlPct = Math.abs(entry.pnlBps) / 100;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.projectName} — ${entry.unitsHeld} units, ${formatNaira(entry.positionValueMinor)}`}
      data-testid={`position-card-${entry.projectId}`}
      testID={`position-card-${entry.projectId}`}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.name, { color: palette.text }]}
            numberOfLines={1}
          >
            {entry.projectName}
          </Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
            {entry.projectSector ?? '—'} · {entry.unitsHeld}{' '}
            {entry.unitsHeld === 1 ? 'unit' : 'units'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.navValue, { color: palette.text }, tabularNums]}>
            {formatNaira(entry.navPerUnitMinor)}
          </Text>
          <Text style={[styles.navLabel, { color: palette.textSecondary }]}>
            per unit
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.posLabel, { color: palette.textSecondary }]}>
            POSITION VALUE
          </Text>
          <Text style={[styles.posValue, { color: palette.text }, tabularNums]}>
            {formatNaira(entry.positionValueMinor)}
          </Text>
        </View>
        <View
          style={[
            styles.pnlPill,
            {
              backgroundColor: isUp
                ? palette.semantic.success.bg
                : palette.semantic.danger.bg,
            },
          ]}
        >
          <Ionicons
            name={isUp ? 'trending-up' : 'trending-down'}
            size={12}
            color={isUp ? palette.semantic.success.fg : palette.semantic.danger.fg}
          />
          <Text
            style={[
              styles.pnlText,
              {
                color: isUp ? palette.semantic.success.fg : palette.semantic.danger.fg,
              },
            ]}
          >
            {isUp ? '+' : '−'}
            {formatNaira(Math.abs(entry.pnlMinor))} · {pnlPct.toFixed(2)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  meta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  navValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  posLabel: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  posValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  pnlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pnlText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.2,
  },
});

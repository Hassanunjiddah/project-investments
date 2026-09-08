import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { formatUnitsLabel } from '@/src/utils/units';
import { MiniSparkline } from '@/src/components/ui/MiniSparkline';
import { useProjectNavSeries } from '@/src/hooks/nav/useProjectNavSeries';
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
  // One percentage only: the investor's effective share of declared profit
  // (unit ownership × investor pool split, e.g. 80% of units × 70% pool = 56%).
  // ownershipPct is derived from live total_units, so a CEO-approved raise
  // dilutes it automatically. The pool/ownership breakdown lives on the
  // project financials tab, not here — two percentages side by side confused
  // investors.
  const effectiveSharePct =
    entry.profitSplitInvestorPct != null && entry.ownershipPct != null
      ? (entry.ownershipPct * entry.profitSplitInvestorPct) / 100
      : undefined;
  const { data: navSeries } = useProjectNavSeries(entry.projectId);
  // Extract just the numeric NAV points for the sparkline.
  const sparkPoints = (navSeries ?? []).map((p) => p.navPerUnitMinor / 100);
  // Only render the spark if there is at least one declaration point
  // (i.e. more than just the synthetic inception anchor).
  const { width } = useWindowDimensions();
  // The fixed 110px sparkline crowds out name/value on small phones.
  const showSpark = sparkPoints.length >= 2 && width >= 400;
  const sparkColor = isUp ? palette.semantic.success.fg : palette.semantic.danger.fg;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.projectName} — ${entry.unitsHeld} units, ${formatNaira(entry.positionValueMinor)}`}
      data-testid={`position-card-${entry.projectId}`}
      testID={`position-card-${entry.projectId}`}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {entry.projectName}
          </Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]} numberOfLines={1}>
            {[entry.projectSector ?? '—', formatUnitsLabel(entry.unitsHeld)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {showSpark ? (
          <View style={styles.sparkWrap} testID={`position-card-spark-${entry.projectId}`}>
            <MiniSparkline points={sparkPoints} color={sparkColor} width={110} height={36} />
          </View>
        ) : null}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.navValue, { color: palette.text }, tabularNums]}>
            {formatNaira(entry.navPerUnitMinor)}
          </Text>
          <Text style={[styles.navLabel, { color: palette.textSecondary }]}>per unit</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      {entry.projectTargetMinor != null || effectiveSharePct != null ? (
        <View style={styles.shareRow} testID={`position-card-share-${entry.projectId}`}>
          <View style={styles.shareCol}>
            <Text style={[styles.posLabel, { color: palette.textSecondary }]}>You invested</Text>
            <Text style={[styles.shareValue, { color: palette.text }, tabularNums]}>
              {formatNaira(entry.capitalKobo)}
            </Text>
          </View>
          {entry.projectTargetMinor != null ? (
            <View style={styles.shareCol}>
              <Text style={[styles.posLabel, { color: palette.textSecondary }]}>
                Project capital
              </Text>
              <Text style={[styles.shareValue, { color: palette.text }, tabularNums]}>
                {formatNaira(entry.projectTargetMinor)}
              </Text>
            </View>
          ) : null}
          {entry.profitSplitInvestorPct != null ? (
            <View style={styles.shareCol}>
              <Text style={[styles.posLabel, { color: palette.textSecondary }]}>
                Profit split
              </Text>
              <Text style={[styles.shareValue, { color: palette.text }, tabularNums]}>
                {entry.profitSplitInvestorPct.toFixed(0)}/
                {(100 - entry.profitSplitInvestorPct).toFixed(0)}
              </Text>
            </View>
          ) : null}
          {effectiveSharePct != null ? (
            <View style={styles.shareCol}>
              <Text style={[styles.posLabel, { color: palette.textSecondary }]}>
                Your profit share
              </Text>
              <Text style={[styles.shareValue, { color: palette.primary }, tabularNums]}>
                {effectiveSharePct.toFixed(1)}%
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.posLabel, { color: palette.textSecondary }]}>POSITION VALUE</Text>
          <Text style={[styles.posValue, { color: palette.text }, tabularNums]}>
            {formatNaira(entry.positionValueMinor)}
          </Text>
        </View>
        <View
          style={[
            styles.pnlPill,
            {
              backgroundColor: isUp ? palette.semantic.success.bg : palette.semantic.danger.bg,
            },
          ]}
        >
          <Ionicons
            name={isUp ? 'trending-up' : 'trending-down'}
            size={12}
            color={isUp ? palette.semantic.success.fg : palette.semantic.danger.fg}
          />
          <Text style={[styles.pnlText, { color: isUp ? palette.semantic.success.fg : palette.semantic.danger.fg }]}>
            {isUp ? '+' : '−'}
            {formatNaira(Math.abs(entry.pnlMinor))} · {pnlPct.toFixed(2)}%
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.muted} />
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
  sparkWrap: {
    width: 110,
    height: 36,
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
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
  shareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  shareCol: { flexGrow: 1, minWidth: 92 },
  shareValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
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

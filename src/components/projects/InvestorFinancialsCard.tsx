import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { formatUnits, formatUnitsLabel, ownershipPct as calcOwnershipPct } from '@/src/utils/units';
import { EmptyState } from '@/src/components/ui/EmptyState';
import {
  useProfitUpdates,
  useInvestorPayoutForInvite,
} from '@/src/hooks/profits/useProfits';
import moment from 'moment';

type Props = {
  projectId: string;
  projectName: string;
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  inviteId: string;
  capitalMinor: number;
  projectedProfitMinor: number;
  projectRealisedProfitMinor: number;
  profitSplitInvestorBps: number;
  projectRaisedMinor: number;
  projectTargetMinor: number;
  /** Units allotted (or pledged) for this investor. */
  unitsHeld?: number;
  totalUnits?: number;
  unitPriceMinor?: number;
};

/** Investor ₦ share of a project profit figure, preferring unit ownership. */
function computeInvestorShare(
  projectProfitMinor: number,
  investorBps: number,
  capitalMinor: number,
  raisedMinor: number,
  unitsHeld?: number,
  totalUnits?: number,
): number {
  if (projectProfitMinor <= 0) return 0;
  const investorPool = Math.round((projectProfitMinor * investorBps) / 10000);
  if (totalUnits && totalUnits > 0 && unitsHeld != null && unitsHeld > 0) {
    return Math.round((investorPool * unitsHeld) / totalUnits);
  }
  if (raisedMinor <= 0) return 0;
  return Math.round((investorPool * capitalMinor) / raisedMinor);
}

export function InvestorFinancialsCard({
  projectId,
  projectStage,
  inviteId,
  capitalMinor,
  projectedProfitMinor,
  projectRealisedProfitMinor,
  profitSplitInvestorBps,
  projectRaisedMinor,
  projectTargetMinor,
  unitsHeld = 0,
  totalUnits = 0,
  unitPriceMinor = 0,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const { data: updates = [], isLoading: updatesLoading } = useProfitUpdates(projectId);
  const { data: payout } = useInvestorPayoutForInvite(inviteId);

  const yourShareMinor = computeInvestorShare(
    projectRealisedProfitMinor,
    profitSplitInvestorBps,
    capitalMinor,
    projectRaisedMinor,
    unitsHeld,
    totalUnits,
  );

  const unitOwnershipPct = calcOwnershipPct(unitsHeld, totalUnits);
  const capitalOwnershipPct =
    projectRaisedMinor > 0 ? (capitalMinor / projectRaisedMinor) * 100 : 0;
  const ownershipPct = unitOwnershipPct > 0 ? unitOwnershipPct : capitalOwnershipPct;

  // Effective share of project net profit after the investor split.
  const effectiveProfitPct = (ownershipPct * profitSplitInvestorBps) / 10000;
  const perUnitNav =
    unitsHeld > 0
      ? Math.round(capitalMinor / unitsHeld) +
        (yourShareMinor > 0 ? Math.round(yourShareMinor / unitsHeld) : 0)
      : unitPriceMinor;

  return (
    <View>
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        data-testid="investor-financials-card"
      >
        <Text style={[styles.label, { color: palette.textSecondary }]}>Your capital</Text>
        <Text style={[styles.big, { color: palette.text }, tabularNums]} data-testid="investor-capital">
          {formatNaira(capitalMinor, false)}
        </Text>

        {unitsHeld > 0 ? (
          <View
            style={[styles.unitsBanner, { backgroundColor: palette.primaryLight }]}
            data-testid="investor-units-banner"
          >
            <View style={styles.unitsBannerCol}>
              <Text style={[styles.label, { color: palette.primary }]}>Your units</Text>
              <Text style={[styles.medium, { color: palette.primary }, tabularNums]}>
                {formatUnitsLabel(unitsHeld)}
                {totalUnits > 0 ? ` / ${formatUnits(totalUnits)}` : ''}
              </Text>
            </View>
            <View style={styles.unitsBannerCol}>
              <Text style={[styles.label, { color: palette.primary }]}>NAV / unit</Text>
              <Text style={[styles.medium, { color: palette.primary }, tabularNums]}>
                {perUnitNav > 0 ? formatNaira(perUnitNav) : '—'}
              </Text>
            </View>
            <View style={styles.unitsBannerCol}>
              <Text style={[styles.label, { color: palette.primary }]}>Ownership</Text>
              <Text style={[styles.medium, { color: palette.primary }, tabularNums]}>
                {ownershipPct.toFixed(1)}%
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.targetRow}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Project target</Text>
          <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
            {formatNaira(projectTargetMinor, false)}
          </Text>
        </View>

        <View style={styles.gridRow}>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Estimated profit</Text>
            <Text style={[styles.medium, { color: palette.primary }, tabularNums]}>
              {formatNaira(projectedProfitMinor)}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Realised so far</Text>
            <Text
              style={[styles.medium, { color: palette.success }, tabularNums]}
              data-testid="investor-realised-profit"
            >
              {formatNaira(yourShareMinor)}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Your profit share</Text>
            <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
              {effectiveProfitPct.toFixed(1)}%
            </Text>
          </View>
          {unitPriceMinor > 0 ? (
            <View style={styles.gridCell}>
              <Text style={[styles.label, { color: palette.textSecondary }]}>Unit price</Text>
              <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
                {formatNaira(unitPriceMinor)}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.hint, { color: palette.muted }]}>
          {unitsHeld > 0 && totalUnits > 0
            ? `Your share of each declaration = investor pool × (${formatUnits(unitsHeld)} / ${formatUnits(totalUnits)} units).`
            : 'Your realised profit = project realised × investor split × your ownership share.'}
        </Text>
      </View>

      {projectStage === 'END' && payout ? (
        <View
          style={[
            styles.card,
            { backgroundColor: palette.primaryLight, borderColor: palette.primary },
          ]}
          data-testid="investor-final-payout"
        >
          <Text style={[styles.label, { color: palette.primary }]}>Final payout</Text>
          <Text style={[styles.big, { color: palette.primary }, tabularNums]}>
            {formatNaira(payout.capitalMinor + payout.profitMinor, false)}
          </Text>
          <Text style={[styles.hint, { color: palette.primary }]}>
            Capital {formatNaira(payout.capitalMinor)} + Profit {formatNaira(payout.profitMinor)}
            {payout.paidAt ? ` · Paid ${moment(payout.paidAt).calendar()}` : ' · Awaiting payout'}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.feedTitle, { color: palette.text }]}>Profit updates</Text>
      {updatesLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : updates.length === 0 ? (
        <EmptyState
          title="No profit updates yet"
          message="Once the manager posts realised profit, your unit share appears here."
        />
      ) : (
        updates.map((u) => {
          const shareForRow = computeInvestorShare(
            u.amountMinor,
            profitSplitInvestorBps,
            capitalMinor,
            projectRaisedMinor,
            unitsHeld,
            totalUnits,
          );
          const perUnitShare =
            unitsHeld > 0 ? Math.round(shareForRow / unitsHeld) : 0;
          return (
            <View
              key={u.id}
              style={[
                styles.row,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
              data-testid={`investor-update-${u.id}`}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.rowAmount, { color: palette.success }, tabularNums]}>
                  +{formatNaira(shareForRow)}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.muted }]}>
                  {moment(u.createdAt).calendar()}
                </Text>
              </View>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                Your share of {formatNaira(u.amountMinor)} project profit
                {unitsHeld > 0
                  ? ` · ${formatUnitsLabel(unitsHeld)}${
                      perUnitShare > 0 ? ` × ${formatNaira(perUnitShare)}/unit` : ''
                    }`
                  : ''}
              </Text>
              {u.note ? (
                <Text style={[styles.rowNote, { color: palette.textSecondary }]}>{u.note}</Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.xs,
    marginBottom: 2,
  },
  big: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  medium: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  unitsBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  unitsBannerCol: { flexGrow: 1, flexBasis: '28%', minWidth: 88 },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  gridCell: { minWidth: 90 },
  targetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  feedTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  rowMeta: { fontSize: typography.sizes.xs },
  rowSub: { fontSize: typography.sizes.xs, marginTop: 2 },
  rowNote: { fontSize: typography.sizes.sm, marginTop: 4 },
});

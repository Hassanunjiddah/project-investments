import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
  useInvestorProfitSummary,
} from '@/src/hooks/profits/useProfits';
import { useSession } from '@/src/hooks/auth/useSession';
import { fetchMyProjectInvites } from '@/src/services/invitations.services';
import { calendarTime } from '@/src/utils/date';

type Props = {
  projectId: string;
  projectName: string;
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  inviteId: string;
  capitalMinor: number;
  projectedProfitMinor: number;
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
  profitSplitInvestorBps,
  projectRaisedMinor,
  projectTargetMinor,
  unitsHeld = 0,
  totalUnits = 0,
  unitPriceMinor = 0,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { user } = useSession();

  const { data: updates = [], isLoading: updatesLoading } = useProfitUpdates(projectId);
  const { data: payout } = useInvestorPayoutForInvite(inviteId);
  const { data: profitSummary = [] } = useInvestorProfitSummary();

  // The investor may hold several confirmed invites on one project (original
  // pledge + additional-raise pledges). Aggregate the whole position and keep
  // each invite's confirmation date to attribute profit to the right period.
  const { data: myInvites = [] } = useQuery({
    queryKey: ['invites', 'mine', projectId, user?.id ?? ''],
    queryFn: () => fetchMyProjectInvites(projectId, user!.id),
    enabled: !!user?.id && !!projectId,
  });
  const confirmedInvites = myInvites.filter((i) => i.status === 'CONFIRMED');
  const aggUnitsHeld =
    confirmedInvites.reduce((s, i) => s + (i.unitsAllotted ?? i.unitsPledged ?? 0), 0) ||
    unitsHeld;
  const aggCapitalMinor =
    confirmedInvites.reduce((s, i) => s + (i.amountMinor ?? 0), 0) || capitalMinor;

  /** Units the investor actually held at a point in time (0 = not yet invested). */
  const unitsAt = (dateIso: string): number => {
    if (confirmedInvites.length === 0) return unitsHeld;
    const at = new Date(dateIso).getTime();
    return confirmedInvites.reduce((s, i) => {
      const confirmedAt = i.verifiedAt ?? i.pledgedAt;
      return confirmedAt && new Date(confirmedAt).getTime() <= at
        ? s + (i.unitsAllotted ?? i.unitsPledged ?? 0)
        : s;
    }, 0);
  };

  // Realised profit comes from immutable distribution notices (per declaration,
  // per invite) via get_investor_profit_summary — never recomputed from current
  // units, so pledging into a later raise cannot claim past distributions.
  const yourShareMinor = profitSummary
    .filter((r) => r.projectId === projectId)
    .reduce((s, r) => s + r.investorShareMinor, 0);

  const unitOwnershipPct = calcOwnershipPct(aggUnitsHeld, totalUnits);
  const capitalOwnershipPct =
    projectRaisedMinor > 0 ? (aggCapitalMinor / projectRaisedMinor) * 100 : 0;
  const ownershipPct = unitOwnershipPct > 0 ? unitOwnershipPct : capitalOwnershipPct;

  // Effective share of project net profit after the investor split.
  const effectiveProfitPct = (ownershipPct * profitSplitInvestorBps) / 10000;
  const perUnitNav =
    aggUnitsHeld > 0
      ? Math.round(aggCapitalMinor / aggUnitsHeld) +
        (yourShareMinor > 0 ? Math.round(yourShareMinor / aggUnitsHeld) : 0)
      : unitPriceMinor;

  return (
    <View>
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        data-testid="investor-financials-card"
      >
        <Text style={[styles.label, { color: palette.textSecondary }]}>Your capital</Text>
        <Text style={[styles.big, { color: palette.text }, tabularNums]} data-testid="investor-capital">
          {formatNaira(aggCapitalMinor, false)}
        </Text>

        {aggUnitsHeld > 0 ? (
          <View
            style={[styles.unitsBanner, { backgroundColor: palette.primaryLight }]}
            data-testid="investor-units-banner"
          >
            <View style={styles.unitsBannerCol}>
              <Text style={[styles.label, { color: palette.primary }]}>Your units</Text>
              <Text style={[styles.medium, { color: palette.primary }, tabularNums]}>
                {formatUnitsLabel(aggUnitsHeld)}
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
          <Text style={[styles.label, { color: palette.textSecondary }]}>
            Total project capital
          </Text>
          <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
            {formatNaira(projectTargetMinor, false)}
          </Text>
        </View>
        {projectRaisedMinor > 0 && projectRaisedMinor !== projectTargetMinor ? (
          <View style={styles.targetRow}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Raised so far</Text>
            <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
              {formatNaira(projectRaisedMinor, false)}
            </Text>
          </View>
        ) : null}

        <View style={styles.gridRow}>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Investor pool</Text>
            <Text style={[styles.medium, { color: palette.text }, tabularNums]}>
              {(profitSplitInvestorBps / 100).toFixed(1)}%
            </Text>
          </View>
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
          {aggUnitsHeld > 0 && totalUnits > 0
            ? `Your share of each declaration = declared profit × ${(profitSplitInvestorBps / 100).toFixed(0)}% investor pool × (${formatUnits(aggUnitsHeld)} / ${formatUnits(totalUnits)} units). Units pledged in an additional raise only count towards declarations made after your payment is confirmed — past distributions stay with the investors who held units at the time.`
            : 'Your realised profit is the sum of your distribution notices — one per approved declaration while you held units.'}
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
            {payout.paidAt ? ` · Paid ${calendarTime(payout.paidAt)}` : ' · Awaiting payout'}
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
          // Share is based on units held when the update was posted, so a
          // later pledge never claims profit from before the investment.
          const unitsAtUpdate = unitsAt(u.createdAt);
          const shareForRow =
            unitsAtUpdate > 0
              ? computeInvestorShare(
                  u.amountMinor,
                  profitSplitInvestorBps,
                  aggCapitalMinor,
                  projectRaisedMinor,
                  unitsAtUpdate,
                  totalUnits,
                )
              : 0;
          const perUnitShare =
            unitsAtUpdate > 0 ? Math.round(shareForRow / unitsAtUpdate) : 0;
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
                <Text
                  style={[
                    styles.rowAmount,
                    { color: unitsAtUpdate > 0 ? palette.success : palette.muted },
                    tabularNums,
                  ]}
                >
                  {unitsAtUpdate > 0 ? `+${formatNaira(shareForRow)}` : formatNaira(u.amountMinor)}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.muted }]}>
                  {calendarTime(u.createdAt)}
                </Text>
              </View>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                {unitsAtUpdate > 0
                  ? `Your share of ${formatNaira(u.amountMinor)} project profit · ${formatUnitsLabel(unitsAtUpdate)}${
                      perUnitShare > 0 ? ` × ${formatNaira(perUnitShare)}/unit` : ''
                    }`
                  : 'Project profit posted before your investment — not included in your share'}
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

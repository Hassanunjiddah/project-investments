import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
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
};

function computeInvestorShare(
  projectRealisedMinor: number,
  investorBps: number,
  capitalMinor: number,
  raisedMinor: number,
): number {
  if (raisedMinor <= 0) return 0;
  return Math.round(
    (projectRealisedMinor * investorBps * capitalMinor) / (10000 * raisedMinor),
  );
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
  );

  const ownershipPct =
    projectRaisedMinor > 0 ? (capitalMinor / projectRaisedMinor) * 100 : 0;

  return (
    <View>
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        data-testid="investor-financials-card"
      >
        <Text style={[styles.label, { color: palette.textSecondary }]}>Your capital</Text>
        <Text style={[styles.big, { color: palette.text }]} data-testid="investor-capital">
          {formatNaira(capitalMinor, false)}
        </Text>

        <View style={styles.gridRow}>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Estimated profit</Text>
            <Text style={[styles.medium, { color: palette.primary }]}>
              {formatNaira(projectedProfitMinor)}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Realised so far</Text>
            <Text
              style={[styles.medium, { color: palette.success }]}
              data-testid="investor-realised-profit"
            >
              {formatNaira(yourShareMinor)}
            </Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Ownership</Text>
            <Text style={[styles.medium, { color: palette.text }]}>{ownershipPct.toFixed(1)}%</Text>
          </View>
        </View>

        <Text style={[styles.hint, { color: palette.muted }]}>
          Your realised profit = project realised × investor split × your ownership share.
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
          <Text style={[styles.big, { color: palette.primary }]}>
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
          message="Once the manager posts realised profit, your share appears here."
        />
      ) : (
        updates.map((u) => {
          const shareForRow = computeInvestorShare(
            u.amountMinor,
            profitSplitInvestorBps,
            capitalMinor,
            projectRaisedMinor,
          );
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
                <Text style={[styles.rowAmount, { color: palette.success }]}>
                  +{formatNaira(shareForRow)}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.muted }]}>
                  {moment(u.createdAt).calendar()}
                </Text>
              </View>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                From {formatNaira(u.amountMinor)} project profit
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
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  gridCell: { minWidth: 90 },
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

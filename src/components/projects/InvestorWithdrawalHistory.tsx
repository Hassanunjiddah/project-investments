import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import {
  fetchWithdrawalsForInvite,
  type WithdrawalRequest,
} from '@/src/services/projectOps.services';

type Props = {
  inviteId: string;
};

function statusVariant(
  status: WithdrawalRequest['status'],
): 'warning' | 'info' | 'error' | 'success' {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
      return 'info';
    case 'REJECTED':
      return 'error';
    case 'PAID':
      return 'success';
    default:
      return 'warning';
  }
}

export function InvestorWithdrawalHistory({ inviteId }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['withdrawals', 'invite', inviteId],
    queryFn: () => fetchWithdrawalsForInvite(inviteId),
    enabled: !!inviteId,
  });

  return (
    <View style={styles.wrap} data-testid="investor-withdrawal-history">
      <Text style={[styles.title, { color: palette.text }]}>Your withdrawal requests</Text>
      <Text style={[styles.help, { color: palette.textSecondary }]}>
        Recorded against this position. PENDING and APPROVED amounts reduce available balance until
        paid or rejected.
      </Text>

      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No requests yet"
          message="When you request a withdrawal, it appears here with its status."
        />
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.ref, { color: palette.primary }]} selectable>
                {row.reference ?? '—'}
              </Text>
              <Badge label={row.status} variant={statusVariant(row.status)} />
            </View>
            <Text style={[styles.amount, { color: palette.text }, tabularNums]}>
              {formatNaira(row.amountMinor, false)}
            </Text>
            <Text style={[styles.meta, { color: palette.textSecondary }]}>
              Requested {moment(row.createdAt).calendar()}
              {row.decidedAt ? ` · Updated ${moment(row.decidedAt).calendar()}` : ''}
            </Text>
            {row.decisionNote ? (
              <Text style={[styles.note, { color: palette.muted }]}>{row.decisionNote}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.xs },
  title: { fontSize: typography.sizes.md, fontWeight: '700' },
  help: { fontSize: typography.sizes.sm, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: 4 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ref: { fontFamily: 'monospace', fontSize: typography.sizes.xs, fontWeight: '600', flex: 1 },
  amount: { fontSize: typography.sizes.md, fontWeight: '600' },
  meta: { fontSize: typography.sizes.xs },
  note: { fontSize: typography.sizes.xs, marginTop: 2 },
});

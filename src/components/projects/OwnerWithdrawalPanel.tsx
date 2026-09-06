import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira, nairaToKobo, parseNairaInput } from '@/src/utils/currency';
import { calendarTime } from '@/src/utils/date';
import { messageForWithdrawalError } from '@/src/utils/withdrawalError';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { EmptyState } from '@/src/components/ui/EmptyState';
import {
  fetchOwnerWithdrawalsForProject,
  ownerWithdrawableMinor,
  requestOwnerProfitWithdrawal,
  type WithdrawalRequest,
} from '@/src/services/projectOps.services';

type Props = {
  projectId: string;
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

export function OwnerWithdrawalPanel({ projectId }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const qc = useQueryClient();

  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: withdrawable = null,
    isLoading: balanceLoading,
    refetch: refetchBalance,
  } = useQuery({
    queryKey: ['owner-withdrawable', projectId],
    queryFn: () => ownerWithdrawableMinor(projectId),
    enabled: !!projectId,
  });

  const { data: rows = [], isLoading: listLoading } = useQuery({
    queryKey: ['withdrawals', 'owner', projectId],
    queryFn: () => fetchOwnerWithdrawalsForProject(projectId),
    enabled: !!projectId,
  });

  const refreshAvailable = async () => {
    setRefreshing(true);
    try {
      await refetchBalance();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not load balance',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const submit = async () => {
    try {
      const minor = nairaToKobo(parseNairaInput(amount));
      if (minor <= 0) {
        pushToast({ type: 'error', message: 'Enter an amount greater than zero.' });
        return;
      }
      if (withdrawable != null && minor > withdrawable) {
        pushToast({
          type: 'error',
          message: `Maximum available is ${formatNaira(withdrawable, false)}.`,
        });
        return;
      }
      setSubmitting(true);
      await requestOwnerProfitWithdrawal(projectId, minor);
      setAmount('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['owner-withdrawable', projectId] }),
        qc.invalidateQueries({ queryKey: ['withdrawals', 'owner', projectId] }),
        qc.invalidateQueries({ queryKey: ['withdrawals', projectId] }),
      ]);
      pushToast({
        type: 'success',
        message: 'Withdrawal requested — awaiting Prism.',
      });
    } catch (err) {
      pushToast({ type: 'error', message: messageForWithdrawalError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap} data-testid="owner-withdrawal-panel">
      <View
        style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}
      >
        <Text style={[styles.title, { color: palette.text }]}>Withdraw manager share</Text>
        <Text style={[styles.help, { color: palette.textSecondary }]}>
          Available:{' '}
          {balanceLoading || withdrawable == null ? '…' : formatNaira(withdrawable, false)}. Your
          share of approved declarations, less prior requests. Prism approves and pays out.
        </Text>
        <Button
          title="Refresh available"
          size="sm"
          variant="outline"
          loading={refreshing}
          onPress={() => void refreshAvailable()}
        />
        <TextInput
          label="Amount (₦)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder={
            withdrawable != null && withdrawable > 0
              ? `Max ${formatNaira(withdrawable, false)}`
              : undefined
          }
        />
        <Button
          title="Request withdrawal"
          loading={submitting}
          onPress={() => void submit()}
        />
      </View>

      <Text style={[styles.title, { color: palette.text }]}>Your withdrawal requests</Text>
      {listLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No requests yet"
          message="When you request a manager-share payout, it appears here with its status."
        />
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[styles.rowCard, { borderColor: palette.border, backgroundColor: palette.surface }]}
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
              Requested {calendarTime(row.createdAt)}
              {row.decidedAt ? ` · Updated ${calendarTime(row.decidedAt)}` : ''}
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
  wrap: { gap: spacing.md },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
  title: { fontSize: typography.sizes.md, fontWeight: '700' },
  help: { fontSize: typography.sizes.sm, lineHeight: 20 },
  rowCard: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: 4 },
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

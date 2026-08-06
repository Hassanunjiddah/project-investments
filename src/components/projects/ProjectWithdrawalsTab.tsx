import { View, Text, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import {
  decideProfitWithdrawal,
  fetchWithdrawalsForProject,
  markProfitWithdrawalPaid,
} from '@/src/services/projectOps.services';

type Props = {
  projectId: string;
  canDecide: boolean;
};

export function ProjectWithdrawalsTab({ projectId, canDecide }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['withdrawals', projectId],
    queryFn: () => fetchWithdrawalsForProject(projectId),
    enabled: !!projectId,
  });

  const decideMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decideProfitWithdrawal(id, approve),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawals', projectId] });
      pushToast({ type: 'success', message: 'Withdrawal updated.' });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => markProfitWithdrawalPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['withdrawals', projectId] });
      pushToast({ type: 'success', message: 'Marked as paid to investor.' });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  return (
    <View style={styles.wrap} data-testid="project-withdrawals-tab">
      <Text style={[styles.title, { color: palette.text }]}>Investor withdrawals</Text>
      <Text style={[styles.help, { color: palette.textSecondary }]}>
        Investors request realised profit payouts. Prism approves and marks paid when funds are
        sent.
      </Text>

      {isLoading ? (
        <Text style={{ color: palette.muted }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="No withdrawal requests"
          message="When investors request realised-profit payouts, they appear here for Prism to approve and mark paid."
        />
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.ref, { color: palette.primary }]} selectable>
                {row.reference}
              </Text>
              <Badge label={row.status} variant="accent" />
            </View>
            <Text style={[styles.amount, { color: palette.text }]}>
              {formatNaira(row.amountMinor)}
            </Text>
            {canDecide && row.status === 'PENDING' ? (
              <View style={styles.actions}>
                <Button
                  title="Reject"
                  size="sm"
                  variant="outlineDanger"
                  style={{ flex: 1 }}
                  onPress={() => decideMut.mutate({ id: row.id, approve: false })}
                />
                <Button
                  title="Approve"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => decideMut.mutate({ id: row.id, approve: true })}
                />
              </View>
            ) : null}
            {canDecide && row.status === 'APPROVED' ? (
              <Button
                title="Mark paid"
                size="sm"
                onPress={() => paidMut.mutate(row.id)}
                loading={paidMut.isPending}
              />
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: typography.sizes.lg, fontWeight: '700' },
  help: { fontSize: typography.sizes.sm, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: 6 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontFamily: 'monospace', fontSize: typography.sizes.xs, fontWeight: '600' },
  amount: { fontSize: typography.sizes.md, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
});

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import {
  decideFundDrawdown,
  fetchFundDrawdowns,
  markFundDrawdownPaid,
  requestFundDrawdown,
} from '@/src/services/projectOps.services';

type Props = {
  projectId: string;
  canRequest: boolean;
  canDecide: boolean;
};

export function ProjectDrawdownsTab({ projectId, canRequest, canDecide }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const qc = useQueryClient();

  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [category, setCategory] = useState<'FUND_USE' | 'RISK_MITIGATION' | 'OTHER'>('FUND_USE');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['fund-drawdowns', projectId],
    queryFn: () => fetchFundDrawdowns(projectId),
    enabled: !!projectId,
  });

  const accountOk =
    bankName.trim().length >= 2 &&
    accountName.trim().length >= 2 &&
    accountNumber.replace(/\s/g, '').length >= 8;

  const requestMut = useMutation({
    mutationFn: () =>
      requestFundDrawdown({
        projectId,
        amountMinor: nairaToKobo(parseFloat(amount) || 0),
        purpose,
        category,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.replace(/\s/g, ''),
      }),
    onSuccess: () => {
      setAmount('');
      setPurpose('');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      pushToast({
        type: 'success',
        message: 'Drawdown requested — Prism will transfer to the account you provided.',
      });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decideFundDrawdown(id, approve),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      pushToast({ type: 'success', message: 'Drawdown updated.' });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => markFundDrawdownPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      pushToast({
        type: 'success',
        message: 'Marked paid — capital raised reduced and ledger audited.',
      });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  return (
    <View style={styles.wrap} data-testid="project-drawdowns-tab">
      <Text style={[styles.title, { color: palette.text }]}>
        {canRequest ? 'Fund drawdowns' : 'Project owner requests'}
      </Text>
      <Text style={[styles.help, { color: palette.textSecondary }]}>
        {canRequest
          ? 'Request funds from Prism and include the bank account for payment. Your Line Manager approves, then marks paid when transferred — that amount is deducted from capital raised and logged in the ledger.'
          : 'Review drawdown requests. Approve or reject, then mark paid after you send funds to the listed account. Paid amounts deduct from capital raised and post to the project ledger.'}
      </Text>

      {canRequest ? (
        <View style={[styles.form, { borderColor: palette.border }]}>
          <TextInput
            label="Amount (₦)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            data-testid="drawdown-amount"
          />
          <TextInput
            label="Purpose"
            value={purpose}
            onChangeText={setPurpose}
            data-testid="drawdown-purpose"
            placeholder="e.g. Equipment purchase for phase 1"
          />
          <TextInput
            label="Bank name"
            value={bankName}
            onChangeText={setBankName}
            data-testid="drawdown-bank-name"
            placeholder="e.g. Access Bank"
          />
          <TextInput
            label="Account name"
            value={accountName}
            onChangeText={setAccountName}
            data-testid="drawdown-account-name"
            placeholder="Account holder name"
          />
          <TextInput
            label="Account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
            data-testid="drawdown-account-number"
            placeholder="NUBAN / account number"
          />
          <View style={styles.catRow}>
            {(
              [
                { key: 'FUND_USE' as const, label: 'Fund use' },
                { key: 'RISK_MITIGATION' as const, label: 'Risk' },
                { key: 'OTHER' as const, label: 'Other' },
              ] as const
            ).map((c) => {
              const active = category === c.key;
              return (
                <Button
                  key={c.key}
                  title={c.label}
                  size="sm"
                  variant={active ? 'primary' : 'outline'}
                  onPress={() => setCategory(c.key)}
                />
              );
            })}
          </View>
          <Button
            title="Request drawdown"
            onPress={() => requestMut.mutate()}
            loading={requestMut.isPending}
            disabled={
              !(parseFloat(amount) > 0) ||
              purpose.trim().length < 3 ||
              !accountOk ||
              requestMut.isPending
            }
            data-testid="drawdown-submit"
          />
        </View>
      ) : null}

      {!canRequest ? (
        <Text style={[styles.listHeading, { color: palette.text }]}>Incoming requests</Text>
      ) : (
        <Text style={[styles.listHeading, { color: palette.text }]}>Your requests</Text>
      )}

      {isLoading ? (
        <Text style={{ color: palette.muted }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: palette.muted }}>
          {canRequest
            ? 'No requests yet — submit your first drawdown above when you need funds.'
            : 'No project owner drawdown requests yet.'}
        </Text>
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
              {formatNaira(row.amountMinor)} · {row.category.replace(/_/g, ' ')}
            </Text>
            <Text style={[styles.purpose, { color: palette.textSecondary }]}>{row.purpose}</Text>
            {row.bankName && row.accountNumber ? (
              <Text style={[styles.purpose, { color: palette.text }]} selectable>
                Pay to · {row.bankName} · {row.accountName ?? '—'} · {row.accountNumber}
              </Text>
            ) : null}
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
                title="Mark paid (deduct capital)"
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
  form: { gap: spacing.sm, borderWidth: 1, borderRadius: 12, padding: spacing.md },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  listHeading: { fontSize: typography.sizes.md, fontWeight: '600', marginTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontFamily: typography.families.mono, fontSize: typography.sizes.xs },
  amount: { fontSize: typography.sizes.md, fontWeight: '600' },
  purpose: { fontSize: typography.sizes.sm, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});

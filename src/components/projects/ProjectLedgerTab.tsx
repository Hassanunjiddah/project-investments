import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import moment from 'moment';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useProjectLedger } from '@/src/hooks/ledger/useLedger';
import { formatNaira } from '@/src/utils/currency';

const ACCOUNT_LABELS: Record<string, string> = {
  project_bank: 'Project bank account',
  investor_capital: 'Investor capital',
  project_realised_pnl: 'Project P&L',
  platform_fee_payable: 'Prism Capital fee payable',
  manager_payable: 'Manager share payable',
  investor_payable: 'Investor profit payable',
  rounding_reserve: 'Rounding reserve',
};

export function ProjectLedgerTab({ projectId }: { projectId: string }) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: entries = [], isLoading } = useProjectLedger(projectId);

  // Group by transaction_ref
  const transactions = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const e of entries) {
      const bucket = map.get(e.transactionRef) ?? [];
      bucket.push(e);
      map.set(e.transactionRef, bucket);
    }
    return Array.from(map.entries())
      .map(([ref, rows]) => ({
        ref,
        rows: rows.sort((a, b) => a.sequence - b.sequence),
        createdAt: rows[0].createdAt,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [entries]);

  // Roll-up per account across all entries
  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    for (const e of entries) {
      const k = e.accountCode;
      bal[k] = (bal[k] ?? 0) + (e.direction === 'DR' ? e.amountMinor : -e.amountMinor);
    }
    return bal;
  }, [entries]);

  return (
    <ScrollView contentContainerStyle={styles.container} data-testid="project-ledger-tab">
      <Text style={[styles.h2, { color: palette.text }]}>General ledger</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Append-only double-entry log. Every business transaction (capital in, profit recognised,
        fees, payouts) is balanced — sum of debits equals sum of credits. This is the audit-proof
        source of truth beneath every dashboard number.
      </Text>

      {/* Balances summary */}
      {entries.length > 0 ? (
        <View style={[styles.balances, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.balancesTitle, { color: palette.textSecondary }]}>
            Account balances
          </Text>
          {Object.entries(balances).map(([acct, bal]) => (
            <View key={acct} style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: palette.text }]}>
                {ACCOUNT_LABELS[acct] ?? acct}
              </Text>
              <Text
                style={[
                  styles.balanceValue,
                  { color: bal >= 0 ? palette.text : '#DC2626' },
                ]}
              >
                {bal >= 0 ? '' : '-'}
                {formatNaira(Math.abs(bal))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Loading…</Text>
      ) : transactions.length === 0 ? (
        <EmptyState
          title="Ledger empty"
          message="Once investors have their payments verified or profits get approved, entries land here."
        />
      ) : (
        transactions.map((tx) => {
          const totalDR = tx.rows
            .filter((r) => r.direction === 'DR')
            .reduce((s, r) => s + r.amountMinor, 0);
          return (
            <View
              key={tx.ref}
              style={[styles.tx, { backgroundColor: palette.surface, borderColor: palette.border }]}
              data-testid={`ledger-tx-${tx.ref}`}
            >
              <View style={styles.txHead}>
                <Text style={[styles.mono, { color: palette.primary }]} selectable>
                  {tx.ref}
                </Text>
                <Text style={[styles.txDate, { color: palette.textSecondary }]}>
                  {moment(tx.createdAt).format('DD MMM YYYY, HH:mm')}
                </Text>
              </View>
              <Text style={[styles.txTotal, { color: palette.textSecondary }]}>
                Balanced · {formatNaira(totalDR)} DR = {formatNaira(totalDR)} CR
              </Text>
              <View style={styles.txLines}>
                {tx.rows.map((r) => (
                  <View key={r.id} style={styles.txLine}>
                    <View style={styles.lineLeft}>
                      <Text style={[styles.dirTag, { color: r.direction === 'DR' ? '#16A34A' : '#DC2626' }]}>
                        {r.direction}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.lineAccount, { color: palette.text }]}>
                          {ACCOUNT_LABELS[r.accountCode] ?? r.accountCode}
                        </Text>
                        {r.memo ? (
                          <Text style={[styles.lineMemo, { color: palette.textSecondary }]}>
                            {r.memo}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={[styles.lineAmount, { color: palette.text }]}>
                      {formatNaira(r.amountMinor)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  h2: { fontSize: typography.sizes.lg, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, marginTop: 4, marginBottom: spacing.md },
  balances: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  balancesTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontSize: typography.sizes.sm },
  balanceValue: { fontSize: typography.sizes.sm, fontFamily: 'monospace', fontWeight: '700' },
  tx: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  txHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontWeight: '700', fontSize: typography.sizes.xs },
  txDate: { fontSize: typography.sizes.xs },
  txTotal: {
    fontSize: typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  txLines: { marginTop: 4, gap: 4 },
  txLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  lineLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  dirTag: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: typography.sizes.xs,
    width: 26,
  },
  lineAccount: { fontSize: typography.sizes.sm, fontWeight: '600' },
  lineMemo: { fontSize: typography.sizes.xs },
  lineAmount: { fontFamily: 'monospace', fontSize: typography.sizes.sm, fontWeight: '600' },
});

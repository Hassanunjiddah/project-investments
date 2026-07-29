import { memo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import moment from 'moment';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useReconciliation } from '@/src/hooks/transparency/useTransparency';
import { formatNaira } from '@/src/utils/currency';

export const ProjectReconciliationTab = memo(function ProjectReconciliationTab({
  projectId,
}: {
  projectId: string;
}) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: rows = [], isLoading } = useReconciliation(projectId);

  // Semantic chip palette derived from theme tokens — AA contrast in both
  // light and dark themes. Falls back to muted for unknown status codes.
  const STATUS_CHIP: Record<string, { bg: string; fg: string; label: string }> = {
    COMMITTED: {
      bg: palette.semantic.warning.bg,
      fg: palette.semantic.warning.fg,
      label: 'Awaiting proof',
    },
    PROOF_SUBMITTED: {
      bg: palette.semantic.warning.bg,
      fg: palette.semantic.warning.fg,
      label: 'Needs verification',
    },
    CONFIRMED: {
      bg: palette.semantic.success.bg,
      fg: palette.semantic.success.fg,
      label: 'Verified',
    },
  };

  const totalExpected = rows.reduce((s, r) => s + r.expectedMinor, 0);
  const totalClaimed = rows.reduce((s, r) => s + r.claimedMinor, 0);
  const totalVariance = totalClaimed - totalExpected;
  const flagged = rows.filter((r) => r.varianceMinor !== 0 && r.status !== 'COMMITTED');

  return (
    <ScrollView contentContainerStyle={styles.container} data-testid="project-reconciliation-tab">
      <Text style={[styles.h2, { color: palette.text }]}>Reconciliation</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Expected inflow (units × unit price) vs actual amount claimed. Any variance means the
        receipt doesn't match the pledge — flag with Finance for bank statement match.
      </Text>

      {isLoading ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Loading…</Text>
      ) : rows.length === 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <EmptyState
            title="No inflows yet"
            message="Pledges and payment claims appear here for verification."
          />
        </View>
      ) : (
        <>
          <View
            style={[
              styles.summary,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
          >
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: palette.textSecondary }]}>
                Expected total
              </Text>
              <Text style={[styles.sumValue, { color: palette.text }]}>
                {formatNaira(totalExpected)}
              </Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: palette.textSecondary }]}>
                Claimed / verified
              </Text>
              <Text style={[styles.sumValue, { color: palette.text }]}>
                {formatNaira(totalClaimed)}
              </Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={[styles.sumLabel, { color: palette.textSecondary }]}>Net variance</Text>
              <Text
                style={[
                  styles.sumValue,
                  { color: totalVariance === 0 ? palette.primary : palette.semantic.danger.fg },
                ]}
              >
                {totalVariance >= 0 ? '+' : ''}
                {formatNaira(totalVariance)}
              </Text>
            </View>
            {flagged.length > 0 ? (
              <Text style={[styles.flagCount, { color: palette.semantic.danger.fg }]}>
                {flagged.length} row{flagged.length === 1 ? '' : 's'} flagged
              </Text>
            ) : null}
          </View>

          {rows.map((r) => {
            const st = STATUS_CHIP[r.status] ?? {
              bg: palette.surfaceMuted,
              fg: palette.textSecondary,
              label: r.status,
            };
            const flagged = r.varianceMinor !== 0 && r.status !== 'COMMITTED';
            return (
              <View
                key={r.inviteId}
                style={[
                  styles.row,
                  {
                    backgroundColor: palette.surface,
                    borderColor: flagged ? palette.semantic.danger.fg : palette.border,
                  },
                ]}
                data-testid={`recon-row-${r.paymentReference ?? r.inviteId}`}
              >
                <View style={styles.rowHead}>
                  <Text style={[styles.name, { color: palette.text }]}>
                    {r.investorName || 'Investor'}
                  </Text>
                  <View style={[styles.chip, { backgroundColor: st.bg }]}>
                    <Text
                      style={{ color: st.fg, fontSize: typography.sizes.xs, fontWeight: '700' }}
                    >
                      {st.label}
                    </Text>
                  </View>
                </View>
                {r.paymentReference ? (
                  <Text style={[styles.mono, { color: palette.primary }]} selectable>
                    {r.paymentReference}
                  </Text>
                ) : null}
                <View style={styles.grid}>
                  <Cell
                    palette={palette}
                    label="Units"
                    value={`${r.unitsAllotted ?? r.unitsPledged ?? 0}`}
                  />
                  <Cell palette={palette} label="Expected" value={formatNaira(r.expectedMinor)} />
                  <Cell
                    palette={palette}
                    label="Claimed"
                    value={formatNaira(r.claimedMinor)}
                    strong={flagged}
                  />
                  <Cell
                    palette={palette}
                    label="Variance"
                    value={`${r.varianceMinor >= 0 ? '+' : ''}${formatNaira(r.varianceMinor)}`}
                    color={r.varianceMinor === 0 ? palette.primary : palette.semantic.danger.fg}
                    strong={r.varianceMinor !== 0}
                  />
                </View>
                {r.claimBank || r.claimDate || r.claimNarration ? (
                  <Text style={[styles.body, { color: palette.textSecondary }]}>
                    {r.claimBank ?? ''}
                    {r.claimDate ? ` · ${moment(r.claimDate).format('DD MMM YYYY')}` : ''}
                    {r.claimNarration ? ` · "${r.claimNarration}"` : ''}
                  </Text>
                ) : null}
                {r.verifiedByName && r.verifiedAt ? (
                  <Text style={[styles.body, { color: palette.muted }]}>
                    Verified by {r.verifiedByName} · {moment(r.verifiedAt).fromNow()}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
});

function Cell({
  palette,
  label,
  value,
  color,
  strong,
}: {
  palette: any;
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.cellValue,
          {
            color: color ?? palette.text,
            fontWeight: strong ? '700' : '600',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  h2: { fontSize: typography.sizes.lg, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, marginTop: 4, marginBottom: spacing.md },
  summary: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 6,
  },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { fontSize: typography.sizes.sm },
  sumValue: { fontSize: typography.sizes.sm, fontFamily: 'monospace', fontWeight: '700' },
  flagCount: { fontSize: typography.sizes.xs, fontWeight: '700', marginTop: 4 },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  name: { fontSize: typography.sizes.md, fontWeight: '700' },
  mono: { fontFamily: 'monospace', fontSize: typography.sizes.xs, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  cell: { flexGrow: 1, flexBasis: '30%', minWidth: 110 },
  cellLabel: {
    fontSize: typography.sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cellValue: { fontSize: typography.sizes.sm, fontFamily: 'monospace' },
  body: { fontSize: typography.sizes.xs, marginTop: 4 },
});

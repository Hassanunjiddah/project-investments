import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Platform } from 'react-native';
import moment from 'moment';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useInvestorNotices } from '@/src/hooks/transparency/useTransparency';
import { formatNaira } from '@/src/utils/currency';
import { downloadNoticePdf, computeCumulative } from '@/src/utils/pdfStatement';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';

export default function StatementsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: notices = [], isLoading, refetch, isRefetching } = useInvestorNotices();
  const { data: profile } = useFetchProfile();
  const investorName = profile?.fullName ?? undefined;

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />
        }
        data-testid="statements-screen"
      >
        <Text style={[styles.h1, { color: palette.text }]}>Statements</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Immutable distribution notices — one per approved profit declaration on projects you're
          invested in. Every number is stamped at approval and can't change.
        </Text>

        {isLoading ? (
          <Text style={[styles.subtitle, { color: palette.textSecondary, marginTop: spacing.md }]}>
            Loading…
          </Text>
        ) : notices.length === 0 ? (
          <View style={{ marginTop: spacing.lg }}>
            <EmptyState
              title="No statements yet"
              message="Once a Line Manager declares profit on a project you're invested in and it's approved, the distribution notice will appear here."
            />
          </View>
        ) : (
          notices.map((n) => (
            <View
              key={n.id}
              style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
              data-testid={`notice-${n.reference}`}
            >
              <View style={styles.rowSpread}>
                <Text style={[styles.mono, { color: palette.primary }]} selectable>
                  {n.reference}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {n.isFinal ? (
                    <View style={[styles.finalChip, { backgroundColor: palette.primaryLight }]}>
                      <Text style={{ color: palette.primary, fontSize: typography.sizes.xs, fontWeight: '700' }}>
                        FINAL · CAPITAL RETURNED
                      </Text>
                    </View>
                  ) : null}
                  {Platform.OS === 'web' ? (
                    <Pressable
                      onPress={() =>
                        downloadNoticePdf(n, {
                          investorName,
                          investorEmail: profile?.email ?? undefined,
                          cumulative: computeCumulative(notices, n),
                        })
                      }
                      style={[styles.pdfBtn, { borderColor: palette.border, backgroundColor: palette.surface }]}
                      data-testid={`download-pdf-${n.reference}`}
                    >
                      <Text style={{ color: palette.text, fontSize: typography.sizes.xs, fontWeight: '600' }}>
                        Download PDF
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Text style={[styles.projectName, { color: palette.text }]}>
                {n.projectName}
              </Text>
              <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
                {n.declarationLabel || 'Profit distribution'} · {moment(n.createdAt).format('DD MMM YYYY')}
              </Text>

              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroLabel, { color: palette.textSecondary }]}>
                    Your share
                  </Text>
                  <Text style={[styles.heroValue, { color: palette.primary }]}>
                    {formatNaira(n.profitMinor)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroLabel, { color: palette.textSecondary }]}>
                    Units held
                  </Text>
                  <Text style={[styles.heroValue, { color: palette.text }]}>
                    {n.unitsHeld} × {formatNaira(n.perUnitMinor)}
                  </Text>
                </View>
              </View>

              {n.isFinal && n.capitalReturnedMinor > 0 ? (
                <View style={[styles.capitalNote, { backgroundColor: palette.primaryLight }]}>
                  <Text style={{ color: palette.primary, fontSize: typography.sizes.sm, fontWeight: '600' }}>
                    + Capital returned: {formatNaira(n.capitalReturnedMinor)}
                  </Text>
                  <Text style={{ color: palette.primary, fontSize: typography.sizes.xs }}>
                    Total credit: {formatNaira(n.profitMinor + n.capitalReturnedMinor)}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.waterfall, { borderColor: palette.border }]}>
                <Text style={[styles.waterfallTitle, { color: palette.textSecondary }]}>
                  How this was calculated ({n.declarationReference})
                </Text>
                <WfRow palette={palette} label="Gross profit" value={n.grossMinor} />
                <WfRow palette={palette} label="Net after costs" value={n.netMinor} />
                <WfRow
                  palette={palette}
                  label={`Prism Capital fee (${(n.platformFeeBps / 100).toFixed(1)}%)`}
                  value={-n.platformFeeMinor}
                />
                <WfRow
                  palette={palette}
                  label={`Investor pool (${(n.profitSplitInvestorBps / 100).toFixed(0)}%)`}
                  value={n.investorPoolMinor}
                  strong
                />
                <WfRow
                  palette={palette}
                  label={`Per unit`}
                  value={n.perUnitMinor}
                  strong
                />
                <View style={styles.hr} />
                <WfRow
                  palette={palette}
                  label={`Your ${n.unitsHeld} × ${formatNaira(n.perUnitMinor)}`}
                  value={n.profitMinor}
                  highlight={palette.primary}
                  strong
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

function WfRow({
  palette,
  label,
  value,
  strong,
  highlight,
}: {
  palette: any;
  label: string;
  value: number;
  strong?: boolean;
  highlight?: string;
}) {
  const isNeg = value < 0;
  return (
    <View style={styles.wfRow}>
      <Text
        style={{
          color: highlight ?? palette.textSecondary,
          fontWeight: strong ? '700' : '500',
          fontSize: typography.sizes.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: highlight ?? palette.text,
          fontWeight: strong ? '700' : '600',
          fontFamily: 'monospace',
          fontSize: typography.sizes.sm,
        }}
      >
        {isNeg ? '-' : ''}
        {formatNaira(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  h1: { fontSize: typography.sizes.xl, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  projectName: { fontSize: typography.sizes.lg, fontWeight: '700', marginTop: 4 },
  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontWeight: '700', fontSize: typography.sizes.sm },
  finalChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  pdfBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  heroRow: { flexDirection: 'row', marginTop: spacing.sm, gap: spacing.md },
  heroLabel: { fontSize: typography.sizes.xs, textTransform: 'uppercase', letterSpacing: 0.6 },
  heroValue: { fontSize: typography.sizes.xl, fontWeight: '700', fontFamily: 'monospace' },
  capitalNote: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    gap: 2,
  },
  waterfall: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: 6,
  },
  waterfallTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  wfRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hr: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
});

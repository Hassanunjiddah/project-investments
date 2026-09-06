import { View, Text, StyleSheet, FlatList, RefreshControl, Platform } from 'react-native';
import { useMemo } from 'react';

import { colors } from '@/src/constants/colors';
import { spacing, radii , scrollBottomInset} from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { DistributionNoticeCard } from '@/src/components/ui/DistributionNoticeCard';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { useInvestorNotices } from '@/src/hooks/transparency/useTransparency';
import type { InvestorNotice } from '@/src/services/transparency.services';
import { formatNaira } from '@/src/utils/currency';
import { listFillStyle, listScrollEnabled } from '@/src/constants/layout';
import { computeCumulative } from '@/src/utils/statementMath';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { formatMonthYear } from '@/src/utils/date';

export default function StatementsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: notices = [], isLoading, refetch, isRefetching } = useInvestorNotices();
  const { data: profile } = useFetchProfile();
  const investorName = profile?.fullName ?? undefined;

  // Aggregate: total received across all statements (profit + capital returned).
  const totals = useMemo(() => {
    let received = 0;
    let count = notices.length;
    for (const n of notices) {
      received += n.profitMinor + (n.capitalReturnedMinor ?? 0);
    }
    return { received, count };
  }, [notices]);

  const header = (
    <>
      <Text style={[styles.h1, { color: palette.text }]}>Statements</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        Immutable distribution notices — one per approved profit declaration on projects you're
        invested in.
      </Text>
      {notices.length > 0 ? (
        <View style={styles.heroWrap}>
          <Card interactive={false} elevated="md">
            <HeroBalance
              label="TOTAL RECEIVED"
              valueMinor={totals.received}
              subtitle={`${totals.count} ${totals.count === 1 ? 'notice' : 'notices'} across your projects`}
              size="lg"
            />
          </Card>
        </View>
      ) : null}
    </>
  );

  return (
    <ScreenLayout>
      <FlatList
        data={notices}
        style={listFillStyle}
        scrollEnabled={listScrollEnabled}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.primary} />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading ? (
            <Text style={[styles.subtitle, { color: palette.textSecondary, marginTop: spacing.md }]}>
              Loading…
            </Text>
          ) : (
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                title="No statements yet"
                message="Once a Line Manager declares profit on a project you're invested in and it's approved, the distribution notice will appear here."
              />
            </View>
          )
        }
        renderItem={({ item: n }) => (
          <NoticeBlock
            notice={n}
            onDownload={
              Platform.OS === 'web'
                ? () =>
                    void import('@/src/utils/pdfStatement').then(({ downloadNoticePdf }) =>
                      downloadNoticePdf(n, {
                        investorName,
                        investorEmail: profile?.email ?? undefined,
                        cumulative: computeCumulative(notices, n),
                      }),
                    )
                : undefined
            }
          />
        )}
        testID="statements-screen"
      />
    </ScreenLayout>
  );
}

// -----------------------------------------------------------------------
// NoticeBlock — DistributionNoticeCard as the header, with an expandable
// waterfall detail card beneath. We keep the detailed breakdown that
// existed before so investors can see gross → net → fee → per-unit →
// their share.
// -----------------------------------------------------------------------
function NoticeBlock({
  notice,
  onDownload,
}: {
  notice: InvestorNotice;
  onDownload?: () => void;
}) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const period =
    notice.declarationLabel && notice.declarationLabel.length <= 12
      ? notice.declarationLabel
      : formatMonthYear(notice.createdAt);

  return (
    <View style={styles.block} data-testid={`notice-${notice.reference}`}>
      <DistributionNoticeCard
        reference={notice.reference}
        projectName={notice.projectName}
        amountMinor={notice.profitMinor}
        postedAt={notice.createdAt}
        period={period}
        onDownload={onDownload}
      />

      {notice.isFinal && notice.capitalReturnedMinor > 0 ? (
        <Card tone="brand" interactive={false} style={styles.capitalCard}>
          <Text style={[styles.capitalTitle, { color: palette.brand[700] }]}>
            Final distribution · capital returned
          </Text>
          <View style={styles.capitalRow}>
            <Text style={[styles.capitalLabel, { color: palette.brand[700] }]}>Capital</Text>
            <Text style={[styles.capitalValue, tabularNums, { color: palette.brand[700] }]}>
              {formatNaira(notice.capitalReturnedMinor)}
            </Text>
          </View>
          <View style={styles.capitalRow}>
            <Text style={[styles.capitalLabel, { color: palette.brand[700], fontWeight: '700' }]}>
              Total credit
            </Text>
            <Text
              style={[
                styles.capitalValue,
                tabularNums,
                { color: palette.brand[700], fontWeight: '700' },
              ]}
            >
              {formatNaira(notice.profitMinor + notice.capitalReturnedMinor)}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card interactive={false} style={styles.waterfallCard}>
        <Text style={[styles.waterfallTitle, { color: palette.textSecondary }]}>
          How this was calculated · {notice.declarationReference}
        </Text>
        <WfRow palette={palette} label="Gross profit" value={notice.grossMinor} />
        <WfRow palette={palette} label="Net after costs" value={notice.netMinor} />
        <WfRow
          palette={palette}
          label={`Prism Capital fee (${(notice.platformFeeBps / 100).toFixed(1)}%)`}
          value={-notice.platformFeeMinor}
        />
        <WfRow
          palette={palette}
          label={`Investor pool (${(notice.profitSplitInvestorBps / 100).toFixed(0)}%)`}
          value={notice.investorPoolMinor}
          strong
        />
        <WfRow palette={palette} label="Per unit" value={notice.perUnitMinor} strong />
        <View style={[styles.hr, { backgroundColor: palette.border }]} />
        <WfRow
          palette={palette}
          label={`Your ${notice.unitsHeld} × ${formatNaira(notice.perUnitMinor)}`}
          value={notice.profitMinor}
          highlight={palette.primary}
          strong
        />
      </Card>
    </View>
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
          flex: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: highlight ?? palette.text,
          fontWeight: strong ? '700' : '600',
          fontFamily: typography.families.mono,
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
  container: { padding: spacing.md, paddingBottom: scrollBottomInset },
  h1: {
    fontFamily: typography.families.display,
    fontSize: 32,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  heroWrap: {
    marginTop: 4,
    marginBottom: spacing.md,
  },
  block: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  capitalCard: {
    marginBottom: 0,
  },
  capitalTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  capitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  capitalLabel: { fontSize: typography.sizes.sm, fontWeight: '600' },
  capitalValue: { fontSize: typography.sizes.sm, fontWeight: '600' },
  waterfallCard: {
    marginBottom: 0,
    gap: 4,
  },
  waterfallTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  wfRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  hr: { height: 1, marginVertical: 4 },
});

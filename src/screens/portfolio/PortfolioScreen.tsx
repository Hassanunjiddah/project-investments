import { FlatList, Text, View, RefreshControl, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SkeletonCard } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { computePortfolioStats } from '@/src/services/portfolio.services';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function PortfolioScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data, isLoading, isError, error, refetch, isRefetching } = useFetchPortfolio();

  if (isLoading) {
    return (
      <ScreenLayout>
        <Text style={[styles.heading, { color: palette.text }]}>Portfolio</Text>
        <View style={{ gap: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </ScreenLayout>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="alert-circle"
        title="Could not load portfolio"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const entries = data ?? [];
  const stats = computePortfolioStats(entries);

  return (
    <ScreenLayout>
      <Text style={[styles.heading, { color: palette.text }]}>Portfolio</Text>

      <StatGrid>
        <StatCard
          icon="cash-outline"
          label="Invested"
          value={formatNaira(stats.investedKobo)}
          numericValue={stats.investedKobo / 100}
          formatValue={(n) => `₦${Math.round(n).toLocaleString('en-NG')}`}
        />
        <StatCard
          icon="trending-up-outline"
          label="Projected"
          value={formatNaira(stats.projectedProfitKobo)}
        />
        <StatCard
          icon="checkmark-done-outline"
          label="Realised"
          value={formatNaira(stats.realisedProfitKobo)}
        />
      </StatGrid>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
            title="No holdings yet"
            message="Once your investments are confirmed by the line manager, they'll appear here."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowTop}>
              <Text style={[styles.projectName, { color: palette.text }]}>{item.projectName}</Text>
              <Text
                style={[
                  styles.stageTag,
                  {
                    color: item.projectStage === 'END' ? palette.success : palette.primary,
                    backgroundColor: palette.primaryLight,
                  },
                ]}
              >
                {item.projectStage}
              </Text>
            </View>
            <View style={styles.stats}>
              <Text style={[styles.stat, { color: palette.textSecondary }]}>
                Capital: {formatNaira(item.capitalKobo)}
              </Text>
              <Text style={[styles.stat, { color: palette.primary }]}>
                Projected return: {formatNaira(item.projectedReturnKobo)}
              </Text>
              {item.realisedReturnKobo !== undefined && item.realisedReturnKobo > 0 ? (
                <Text
                  style={[styles.stat, { color: palette.success }]}
                  data-testid={`portfolio-realised-${item.id}`}
                >
                  Realised return: {formatNaira(item.realisedReturnKobo)}
                </Text>
              ) : null}
            </View>
          </Card>
        )}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  projectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  stageTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    overflow: 'hidden',
  },
  stats: {
    gap: spacing.xs,
  },
  stat: {
    fontSize: typography.sizes.sm,
  },
});

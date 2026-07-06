import { FlatList, Text, View, RefreshControl, StyleSheet, useColorScheme } from 'react-native';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function PortfolioScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const { data, isLoading, isError, error, refetch, isRefetching } = useFetchPortfolio();

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load portfolio"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const entries = data ?? [];

  return (
    <ScreenLayout>
      <Text style={[styles.heading, { color: palette.text }]}>Portfolio</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.projectId}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="No holdings"
            message="Confirmed investments will appear in your portfolio."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={[styles.projectName, { color: palette.text }]}>{item.projectName}</Text>
            <View style={styles.stats}>
              <Text style={[styles.stat, { color: palette.textSecondary }]}>
                Capital: {formatNaira(item.capitalKobo)}
              </Text>
              <Text style={[styles.stat, { color: palette.primary }]}>
                Projected return: {formatNaira(item.projectedReturnKobo)}
              </Text>
              {item.realisedReturnKobo !== undefined ? (
                <Text style={[styles.stat, { color: palette.success }]}>
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
  projectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  stats: {
    gap: spacing.xs,
  },
  stat: {
    fontSize: typography.sizes.sm,
  },
});

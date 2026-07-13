import { useState } from 'react';
import { FlatList, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { InvestmentCard } from '@/src/components/investor/InvestmentCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { InvestmentStatus } from '@/db';

export default function InvestorPortfolioScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const userId = useMockUserId();
  const [filter, setFilter] = useState<InvestmentStatus>('active');
  const version = useMockDataStore((s) => s.version);
  const getInvestorDashboard = useMockDataStore((s) => s.getInvestorDashboard);
  const getInvestorPortfolio = useMockDataStore((s) => s.getInvestorPortfolio);

  void version;
  const { stats } = getInvestorDashboard(userId);
  const portfolio = getInvestorPortfolio(userId, filter);

  const activeCount = getInvestorPortfolio(userId, 'active').length;
  const completedCount = getInvestorPortfolio(userId, 'completed').length;

  const segments = [
    { key: 'active', label: `Active (${activeCount})` },
    { key: 'completed', label: `Completed (${completedCount})` },
    { key: 'withdrawal', label: 'Withdrawals' },
  ];

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Portfolio</Text>
      <PortfolioCard
        variant="portfolio"
        totalInvestedKobo={stats.totalInvestedKobo}
        projectedProfitKobo={stats.projectedProfitKobo}
        realisedProfitKobo={stats.realisedProfitKobo}
      />
      <SegmentedControl
        segments={segments}
        activeKey={filter}
        onChange={(k) => setFilter(k as InvestmentStatus)}
      />
      <FlatList
        data={portfolio}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <InvestmentCard
            project={item.project}
            investment={item}
            onPress={() => router.push(`/(tabs)/projects/${item.projectId}`)}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: palette.muted }]}>
            No investments in this category
          </Text>
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});

import { ScrollView, View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { PendingActionCard } from '@/src/components/investor/PendingActionCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function InvestorHomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const getInvestorDashboard = useMockDataStore((s) => s.getInvestorDashboard);

  void version;
  const { stats, pendingActions, recentUpdates } = getInvestorDashboard(userId);

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader userName="Ibrahim" notificationCount={pendingActions.length} />
        <GreetingHeader name="Ibrahim" subtitle="Track your portfolio and pending actions." />

        <PortfolioCard
          totalInvestedKobo={stats.totalInvestedKobo}
          projectedProfitKobo={stats.projectedProfitKobo}
          realisedProfitKobo={stats.realisedProfitKobo}
        />

        <StatGrid>
          <StatCard
            icon="pie-chart-outline"
            label="Active"
            value={String(stats.activeInvestments)}
          />
          <StatCard
            icon="wallet-outline"
            label="Withdraw"
            value={formatNaira(stats.availableToWithdrawKobo)}
          />
          <StatCard
            icon="trending-up-outline"
            label="ROI"
            value={`${stats.portfolioRoiPct}%`}
          />
        </StatGrid>

        <SectionHeader
          title="Pending Actions"
          count={pendingActions.length}
          actionLabel="View all"
        />
        {pendingActions.map((action) => (
          <PendingActionCard
            key={action.id}
            action={action}
            onPress={() => router.push(`/(tabs)/projects/${action.projectId}`)}
          />
        ))}

        <SectionHeader title="Recent Updates" actionLabel="View all" />
        {recentUpdates.map((update) => (
          <View
            key={update.id}
            style={[styles.updateRow, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={[styles.updateThumb, { backgroundColor: palette.primaryLight }]}>
              <Text style={[styles.thumbLetter, { color: palette.primary }]}>
                {update.projectName.charAt(0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.updateTitle, { color: palette.text }]}>
                {update.projectName}
              </Text>
              <Text style={[styles.updateMsg, { color: palette.textSecondary }]}>
                {update.message}
              </Text>
            </View>
            <Text style={[styles.elapsed, { color: palette.muted }]}>{update.elapsed}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  updateThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
  updateTitle: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  updateMsg: { fontSize: 10, marginTop: 2 },
  elapsed: { fontSize: 10 },
});

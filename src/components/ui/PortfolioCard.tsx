import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';

type Props = {
  /** Headline portfolio value (typically invested + projected profit) */
  portfolioValueKobo: number;
  investedKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo: number;
  variant?: 'home' | 'portfolio';
  showEye?: boolean;
};

export function PortfolioCard({
  portfolioValueKobo,
  investedKobo,
  projectedProfitKobo,
  realisedProfitKobo,
  variant = 'home',
  showEye = true,
}: Props) {
  const title = variant === 'portfolio' ? 'Portfolio Value' : 'Total Invested';
  const headline = variant === 'portfolio' ? portfolioValueKobo : investedKobo;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.caption}>{title}</Text>
        {variant === 'portfolio' ? (
          <View style={styles.filterChip}>
            <Text style={styles.filterText}>All</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
          </View>
        ) : showEye ? (
          <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.8)" />
        ) : null}
      </View>
      <Text style={styles.mainValue}>{formatNaira(headline)}</Text>
      <View style={styles.divider} />
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Invested</Text>
          <Text style={styles.statValue}>{formatNaira(investedKobo)}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Projected Profit</Text>
          <Text style={styles.statValue}>{formatNaira(projectedProfitKobo)}</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Realised Profit</Text>
          <Text style={styles.statValue}>{formatNaira(realisedProfitKobo)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1B6B3A',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  caption: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.sizes.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  filterText: { color: 'rgba(255,255,255,0.9)', fontSize: 10 },
  mainValue: {
    color: '#FFF',
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.sm,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCol: { flex: 1 },
  statLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, marginBottom: 2 },
  statValue: {
    color: '#FFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});

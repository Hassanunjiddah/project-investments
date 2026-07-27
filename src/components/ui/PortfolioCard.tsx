import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira } from '@/src/utils/currency';
import { CountUp } from '@/src/components/ui/CountUp';

type Props = {
  /** Headline portfolio value (invested + projected profit). */
  portfolioValueKobo: number;
  investedKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo: number;
  variant?: 'home' | 'portfolio';
  showEye?: boolean;
  /** Optional callback for the top-right filter chip (portfolio variant). */
  onFilterPress?: () => void;
};

/**
 * PortfolioCard — Prism Capital investor hero card (Phase C rewrite).
 *
 * Deep-navy gradient background (web) with the four-facet brand highlight
 * baked in as a soft radial via CSS. Big editorial-serif headline value
 * with a CountUp on mount; three stat columns underneath.
 *
 * Backwards-compatible with all previous call-sites.
 */
export function PortfolioCard({
  portfolioValueKobo,
  investedKobo,
  projectedProfitKobo,
  realisedProfitKobo,
  variant = 'home',
  showEye = true,
  onFilterPress,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const title = variant === 'portfolio' ? 'Portfolio Value' : 'Total Invested';
  const headline = variant === 'portfolio' ? portfolioValueKobo : investedKobo;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.brand[700],
          borderColor: palette.brand[800],
        },
        // Web-only radial highlight in the top-right, echoing the tetrahedron logo
        Platform.OS === 'web'
          ? ({
              backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${palette.brand[500]}55 0%, ${palette.brand[700]}00 60%), linear-gradient(135deg, ${palette.brand[800]} 0%, ${palette.brand[700]} 55%, ${palette.brand[600]} 100%)`,
            } as any)
          : null,
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.caption}>{title}</Text>
        {variant === 'portfolio' && onFilterPress ? (
          <Pressable
            onPress={onFilterPress}
            style={styles.filterChip}
            accessibilityRole="button"
            accessibilityLabel="Filter portfolio"
          >
            <Text style={styles.filterText}>All</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.8)" />
          </Pressable>
        ) : showEye ? (
          <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.75)" />
        ) : null}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.currencyMark}>₦</Text>
        <CountUp
          to={headline / 100}
          style={{ ...styles.mainValue, ...tabularNums }}
          format={(n) => Math.round(n).toLocaleString('en-NG')}
        />
      </View>

      <View style={styles.divider} />

      <View style={styles.statsRow}>
        <StatCol label="Invested" value={formatNaira(investedKobo)} />
        <StatCol label="Projected profit" value={formatNaira(projectedProfitKobo)} />
        <StatCol label="Realised profit" value={formatNaira(realisedProfitKobo)} />
      </View>
    </View>
  );
}

function StatCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tabularNums]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    // navy shadow on web only
    shadowColor: '#0A1F3D',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  caption: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  filterText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: spacing.sm + 2,
  },
  currencyMark: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: typography.families.display,
    fontSize: 26,
    fontWeight: typography.weights.medium,
    lineHeight: 42,
  },
  mainValue: {
    color: '#FFFFFF',
    fontFamily: typography.families.display,
    fontSize: 44,
    fontWeight: typography.weights.medium,
    letterSpacing: -1,
    lineHeight: 48,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: spacing.sm + 2,
  },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCol: { flex: 1, gap: 2 },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});

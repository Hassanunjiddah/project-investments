import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira } from '@/src/utils/currency';
import type { Project } from '@/src/types/project.types';

type Props = {
  projects: Project[];
  onProjectPress?: (projectId: string) => void;
};

/**
 * Per-project manager profit breakdown for the LM dashboard.
 *
 * Manager share = `realised_profit * (10000 - profit_split_investor_bps) / 10000`.
 * Only projects with a non-zero realised profit are shown so the list stays
 * scannable. Sorted by manager share descending (biggest contributors first).
 */
export function ManagerProfitBreakdown({ projects, onProjectPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const rows = projects
    .map((p) => {
      const managerBps = 10000 - p.profitSplitInvestorBps;
      const managerShareKobo = Math.round((p.realisedProfitMinor * managerBps) / 10000);
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        realisedKobo: p.realisedProfitMinor,
        managerShareKobo,
        managerPct: managerBps / 100,
      };
    })
    .filter((r) => r.realisedKobo > 0)
    .sort((a, b) => b.managerShareKobo - a.managerShareKobo);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No profits yet"
        message="When you post realised profits on a project, your share will show here."
      />
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Card
          key={row.id}
          interactive={!!onProjectPress}
          onPress={onProjectPress ? () => onProjectPress(row.id) : undefined}
          style={styles.row}
          testID={`profit-source-${row.id}`}
        >
          <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
            <Ionicons name="trending-up" size={16} color={palette.primary} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={[styles.meta, { color: palette.textSecondary }]}>
              {formatNaira(row.realisedKobo)} realised · {row.managerPct.toFixed(0)}% share
            </Text>
          </View>
          <Text style={[styles.amount, { color: palette.primary }]}>
            {formatNaira(row.managerShareKobo)}
          </Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  meta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    // @ts-expect-error web-only CSS
    fontVariantNumeric: 'tabular-nums',
  },
});

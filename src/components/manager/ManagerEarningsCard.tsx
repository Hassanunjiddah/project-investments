import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';

type Props = {
  managerShareKobo: number;
  totalRealisedKobo: number;
  projectCount: number;
  loading?: boolean;
};

export function ManagerEarningsCard({
  managerShareKobo,
  totalRealisedKobo,
  projectCount,
  loading,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const hasEarnings = managerShareKobo > 0 || totalRealisedKobo > 0;

  return (
    <View
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      data-testid="manager-earnings-card"
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
          <Ionicons name="wallet-outline" size={16} color={palette.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Your share</Text>
          {loading ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <Text
              style={[styles.value, { color: palette.text }]}
              data-testid="manager-earnings-share"
            >
              {formatNaira(managerShareKobo, false)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Realised</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>
            {formatNaira(totalRealisedKobo)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Earning projects</Text>
          <Text style={[styles.metaValue, { color: palette.text }]}>{projectCount}</Text>
        </View>
      </View>

      {!hasEarnings && !loading ? (
        <Text style={[styles.hint, { color: palette.muted }]}>
          No profit realised yet. Post profit updates on active projects to see your share here.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.xs,
    marginBottom: 2,
  },
  value: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    rowGap: spacing.sm,
  },
  metaItem: { minWidth: 90, flexShrink: 1 },
  metaLabel: {
    fontSize: typography.sizes.xs,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  hint: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/src/components/ui/Card';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira } from '@/src/utils/currency';
import type { EarningBreakdownRow } from '@/src/types/profit.types';

type Props = {
  rows: EarningBreakdownRow[];
  amountLabel: string;
  emptyMessage: string;
  onProjectPress?: (projectId: string) => void;
};

export function EarningBreakdownList({
  rows,
  amountLabel,
  emptyMessage,
  onProjectPress,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  if (rows.length === 0) {
    return <EmptyState title="No earnings yet" message={emptyMessage} />;
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => (
        <Card
          key={row.projectId}
          interactive={!!onProjectPress}
          onPress={onProjectPress ? () => onProjectPress(row.projectId) : undefined}
          style={styles.row}
          testID={`earning-source-${row.projectId}`}
        >
          <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
            <Ionicons name="trending-up" size={16} color={palette.primary} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {row.projectName}
            </Text>
            <Text style={[styles.meta, { color: palette.textSecondary }]}>
              {row.raiseFeeMinor > 0 || row.profitFeeMinor > 0
                ? [
                    row.raiseFeeMinor > 0
                      ? `Raise fee ${formatNaira(row.raiseFeeMinor)}`
                      : null,
                    row.profitFeeMinor > 0
                      ? `${amountLabel} ${formatNaira(row.profitFeeMinor)}`
                      : null,
                    row.declarationCount > 0
                      ? `${row.declarationCount} declaration${row.declarationCount === 1 ? '' : 's'}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : `${formatNaira(row.grossMinor)} gross · ${row.declarationCount} declaration${
                    row.declarationCount === 1 ? '' : 's'
                  } · ${amountLabel}`}
            </Text>
          </View>
          <View style={styles.amountCol}>
            <Text style={[styles.amount, { color: palette.primary }]}>
              {formatNaira(row.amountMinor)}
            </Text>
            {row.raiseFeeMinor > 0 && row.profitFeeMinor > 0 ? (
              <Text style={[styles.totalHint, { color: palette.textSecondary }]}>total</Text>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: typography.sizes.sm, fontWeight: '600' },
  meta: { fontSize: typography.sizes.xs, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontSize: typography.sizes.sm, fontWeight: '700' },
  totalHint: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});

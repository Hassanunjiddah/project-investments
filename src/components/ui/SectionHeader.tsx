import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, count, actionLabel, onAction }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
        {count !== undefined ? (
          <View style={[styles.countPill, { borderColor: palette.border }]}>
            <Text style={[styles.countText, { color: palette.textSecondary }]}>{count}</Text>
          </View>
        ) : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction}>
          <Text style={[styles.action, { color: palette.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  countPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countText: { fontSize: 10, fontWeight: typography.weights.medium },
  action: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
});

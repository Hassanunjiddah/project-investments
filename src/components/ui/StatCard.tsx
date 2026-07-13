import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  change?: string;
  changePositive?: boolean;
};

export function StatCard({ label, value, icon, change, changePositive = true }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
        <Ionicons name={icon} size={14} color={palette.primary} />
      </View>
      <Text style={[styles.value, { color: palette.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, { color: palette.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      {change ? (
        <Text
          style={[styles.change, { color: changePositive ? palette.success : palette.warning }]}
          numberOfLines={1}
        >
          {change}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  card: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 0,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  value: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    marginBottom: 2,
  },
  change: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
});

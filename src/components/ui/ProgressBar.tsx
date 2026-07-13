import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  progress: number;
  showLabel?: boolean;
  height?: number;
};

export function ProgressBar({ progress, showLabel = true, height = 8 }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.wrap}>
      <View style={[styles.track, { backgroundColor: palette.border, height }]}>
        <View
          style={[styles.fill, { backgroundColor: palette.primary, width: `${pct}%`, height }]}
        />
      </View>
      {showLabel ? (
        <Text style={[styles.label, { color: palette.textSecondary }]}>{pct}%</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  fill: { borderRadius: 999 },
  label: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, minWidth: 36 },
});

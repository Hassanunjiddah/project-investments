import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';
import { spacing } from '@/src/constants/spacing';

type Props = {
  size?: 'small' | 'large';
  label?: string;
};

export function Spinner({ size = 'large', label }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={palette.primary} />
      {label ? <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
});

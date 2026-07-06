import { ScrollView, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Segment = {
  key: string;
  label: string;
};

type Props = {
  segments: Segment[];
  activeKey: string;
  onChange: (key: string) => void;
};

export function SegmentedControl({ segments, activeKey, onChange }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {segments.map((seg) => {
        const active = seg.key === activeKey;
        return (
          <Pressable
            key={seg.key}
            style={[
              styles.pill,
              {
                backgroundColor: active ? palette.primaryLight : palette.surface,
                borderColor: active ? palette.primary : palette.border,
              },
            ]}
            onPress={() => onChange(seg.key)}
          >
            <Text
              style={[
                styles.label,
                { color: active ? palette.primary : palette.textSecondary },
                active && styles.activeLabel,
              ]}
            >
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  activeLabel: {
    fontWeight: typography.weights.semibold,
  },
});

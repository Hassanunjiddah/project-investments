import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  categories: string[];
  active: string;
  onChange: (category: string) => void;
};

export function CategoryChips({ categories, active, onChange }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      {categories.map((cat) => {
        const selected = cat === active;
        return (
          <Pressable
            key={cat}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? palette.primary : palette.surface,
                borderColor: selected ? palette.primary : palette.border,
              },
            ]}
            onPress={() => onChange(cat)}
          >
            <Text style={[styles.label, { color: selected ? '#FFF' : palette.textSecondary }]}>
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  label: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
});

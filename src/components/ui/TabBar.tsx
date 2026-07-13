import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type Tab = {
  key: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
};

export function TabBar({ tabs, activeKey, onChange }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.wrap, { borderBottomColor: palette.border }]}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <Text
              style={[
                styles.label,
                { color: active ? palette.primary : palette.muted },
                active && styles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
            {active ? (
              <View style={[styles.underline, { backgroundColor: palette.primary }]} />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  content: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tab: {
    paddingBottom: spacing.sm,
    position: 'relative',
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  activeLabel: {
    fontWeight: typography.weights.semibold,
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
});

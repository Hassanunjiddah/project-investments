import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
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
  disabledKeys?: string[];
};

export function TabBar({ tabs, activeKey, onChange, disabledKeys = [] }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  // On web, render a semantic <div role="tablist"> with real <button role="tab">
  // children — RN-Web 0.21 does not forward role/aria-selected on Pressable
  // reliably, so we render the DOM ourselves for accessibility parity.
  if (Platform.OS === 'web') {
    return (
      <div
        role="tablist"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: spacing.lg,
          overflowX: 'auto',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomStyle: 'solid',
          borderBottomColor: palette.border,
          marginBottom: spacing.md,
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          const disabled = disabledKeys.includes(tab.key);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              aria-disabled={disabled || undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.key)}
              style={{
                minHeight: 44,
                paddingTop: spacing.sm,
                paddingBottom: spacing.sm,
                paddingLeft: 4,
                paddingRight: 4,
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: active ? palette.primary : palette.muted,
                fontSize: typography.sizes.sm,
                fontWeight: active ? typography.weights.semibold : typography.weights.medium,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: palette.primary,
                  transform: active ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'center',
                  transition: 'transform 180ms ease',
                  opacity: active ? 1 : 0,
                }}
              />
            </button>
          );
        })}
      </div>
    );
  }

  // Native fallback — same visual, RN Pressable path.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.wrap, { borderBottomColor: palette.border }]}
      contentContainerStyle={styles.content}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const disabled = disabledKeys.includes(tab.key);
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={tab.label}
          >
            <Text
              style={[
                styles.label,
                { color: active ? palette.primary : palette.muted },
                disabled && { color: palette.muted },
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
    minHeight: 44,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    justifyContent: 'center',
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

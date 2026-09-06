import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { MappedError } from '@/src/utils/authErrors';

type Props = { err: MappedError | null };

/**
 * Inline auth error banner. Renders nothing when `err` is null. Uses the
 * semantic.danger pair (AA-verified). Shows title + optional hint that
 * tells the user what to do.
 */
export function AuthErrorBanner({ err }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  if (!err) return null;
  const sem = palette.semantic.danger;
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: sem.bg, borderColor: sem.border },
      ]}
      testID={err.testTag}
      data-testid={err.testTag}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Feather name="alert-triangle" size={16} color={sem.fg} style={{ marginTop: 2 }} />
      <View style={styles.body}>
        <Text style={[styles.title, { color: sem.fg }]}>{err.title}</Text>
        {err.hint ? <Text style={[styles.hint, { color: sem.fg }]}>{err.hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  hint: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
});

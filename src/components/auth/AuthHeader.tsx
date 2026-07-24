import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

/** Right-panel headline block for auth screens. Uses Fraunces display. */
export function AuthHeader({ eyebrow, title, subtitle }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  return (
    <View style={styles.wrap}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: palette.primary }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    gap: 6,
  },
  eyebrow: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.families.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -0.6,
    fontWeight: '600',
  },
  subtitle: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
});

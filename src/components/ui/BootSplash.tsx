import { View, Text, StyleSheet, Platform } from 'react-native';
import { PrismLoader } from '@/src/components/ui/PrismLoader';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SITE_NAME } from '@/src/constants/site';
import { useUiStore } from '@/src/store/useUiStore';

type Props = {
  message?: string;
};

/**
 * Full-viewport branded loading shell — never leave users on a white blank
 * while auth/session/route transitions settle.
 */
export function BootSplash({ message = 'Loading…' }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View
      style={[styles.shell, { backgroundColor: palette.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      // @ts-expect-error web test id
      data-testid="boot-splash"
      testID="boot-splash"
    >
      <PrismLoader size="lg" />
      <Text style={[styles.brand, { color: palette.text }]}>{SITE_NAME}</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>
    </View>
  );
}

/** Hide the static HTML boot splash once React has painted. */
export function dismissHtmlBootSplash() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const el = document.getElementById('prism-boot');
  if (!el) return;
  el.classList.add('prism-boot-hide');
  window.setTimeout(() => el.remove(), 280);
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  brand: {
    fontFamily: typography.families.display,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.3,
    marginTop: spacing.sm,
  },
  message: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});

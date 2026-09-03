import { View, Text, StyleSheet, Platform, Image } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SITE_NAME } from '@/src/constants/site';
import { useUiStore } from '@/src/store/useUiStore';

type Props = {
  message?: string;
};

const LOGO_URI = '/images/prism-logo-512.png';

/**
 * Full-viewport branded loading shell — never leave users on a white blank
 * while auth/session/route transitions settle. Uses the official Prism
 * Capital mark (not a decorative spinner).
 */
export function BootSplash({ message = 'Loading…' }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View
      style={[styles.shell, { backgroundColor: palette.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      data-testid="boot-splash"
      testID="boot-splash"
    >
      {Platform.OS === 'web' ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- decorative with aria-hidden
        <img
          src={LOGO_URI}
          alt=""
          aria-hidden
          width={72}
          height={72}
          style={{
            objectFit: 'contain',
            display: 'block',
            borderRadius: 14,
          }}
        />
      ) : (
        <Image source={{ uri: LOGO_URI }} style={styles.logo} accessibilityIgnoresInvertColors />
      )}
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
  logo: {
    width: 72,
    height: 72,
    borderRadius: 14,
    resizeMode: 'contain',
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

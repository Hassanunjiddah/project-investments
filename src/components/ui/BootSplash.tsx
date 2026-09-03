import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Image, Animated, Easing } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing, prefersReducedMotion } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SITE_NAME } from '@/src/constants/site';
import { useUiStore } from '@/src/store/useUiStore';

type Props = {
  message?: string;
};

const LOGO_URI = '/images/prism-logo-512.png';
const SPIN_MS = 1600;

/**
 * Full-viewport branded loading shell — official Prism Capital mark with a
 * slow rotate (respects prefers-reduced-motion).
 */
export function BootSplash({ message = 'Loading…' }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const rotate = useRef(new Animated.Value(0)).current;
  const reduce = prefersReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate, reduce]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const mark =
    Platform.OS === 'web' ? (
      <div
        style={{
          width: 72,
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: reduce ? undefined : `prism-logo-spin ${SPIN_MS}ms linear infinite`,
        }}
      >
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
        <style>{`
          @keyframes prism-logo-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    ) : (
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Image source={{ uri: LOGO_URI }} style={styles.logo} accessibilityIgnoresInvertColors />
      </Animated.View>
    );

  return (
    <View
      style={[styles.shell, { backgroundColor: palette.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      testID="boot-splash"
    >
      {mark}
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

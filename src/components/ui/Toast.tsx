import { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, View, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import type { ToastItem } from '@/src/store/useUiStore';

type Props = {
  toast: ToastItem;
  onDismiss: () => void;
};

/**
 * Premium slide-in toast (Feb 2026): icon + text, subtle border, ambient
 * shadow. Uses the current theme's surface so it feels native rather than
 * jarring. Auto-fades in on mount.
 */
export function Toast({ toast, onDismiss }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, opacity]);

  const config = {
    success: {
      accent: palette.success,
      icon: 'check-circle' as const,
    },
    error: {
      accent: palette.error,
      icon: 'alert-circle' as const,
    },
    info: {
      accent: palette.info,
      icon: 'info' as const,
    },
  }[toast.type];

  // Screen-reader affordance (web): errors are assertive, everything else
  // is polite so they don't interrupt a reader mid-sentence.
  const ariaRole = toast.type === 'error' ? 'alert' : 'status';
  const ariaLive = toast.type === 'error' ? 'assertive' : 'polite';

  return (
    <Animated.View
      style={{ transform: [{ translateY }], opacity }}
      // @ts-expect-error web-only ARIA passthrough
      accessibilityRole={ariaRole}
      accessibilityLiveRegion={ariaLive}
      role={ariaRole}
      aria-live={ariaLive}
      aria-atomic="true"
    >
      <Pressable
        onPress={onDismiss}
        accessibilityLabel={`${toast.type} notification: ${toast.message}. Tap to dismiss.`}
        style={[
          styles.toast,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            ...elevation.lg,
          },
        ]}
      >
        <View style={[styles.iconTile, { backgroundColor: config.accent + '1A' }]}>
          <Feather name={config.icon} size={16} color={config.accent} />
        </View>
        <View style={styles.textCol}>
          <Text
            style={[styles.text, { color: palette.text }]}
            numberOfLines={3}
          >
            {toast.message}
          </Text>
          {toast.reference ? (
            <Text
              style={[styles.reference, { color: palette.textSecondary }]}
              numberOfLines={1}
            >
              {toast.reference}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    minWidth: 260,
    maxWidth: 420,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    lineHeight: 20,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  reference: {
    fontFamily: typography.families.mono,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.3,
  },
});

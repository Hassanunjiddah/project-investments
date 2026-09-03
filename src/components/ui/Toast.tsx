import { useEffect, useRef } from 'react';
import { Pressable, Text, StyleSheet, View, Animated, Platform } from 'react-native';
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

const AUTO_DISMISS_MS = 4000;
const EXIT_MS = 220;

/**
 * Premium slide-in / fade-out toast. Enter on mount; after AUTO_DISMISS_MS
 * (or on press) play exit then call onDismiss so the store removes it.
 */
export function Toast({ toast, onDismiss }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissed = useRef(false);

  const runExit = () => {
    if (dismissed.current) return;
    dismissed.current = true;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 12,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss();
    });
  };

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

    const timer = setTimeout(runExit, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
    // Intentionally once per toast id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const ariaRole = toast.type === 'error' ? 'alert' : 'status';
  const ariaLive = toast.type === 'error' ? 'assertive' : 'polite';

  const inner = (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      <Pressable
        onPress={runExit}
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
          <Text style={[styles.text, { color: palette.text }]} numberOfLines={3}>
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

  if (Platform.OS === 'web') {
    return (
      <div
        role={ariaRole}
        aria-live={ariaLive}
        aria-atomic="true"
        aria-label={`${toast.type} notification`}
      >
        {inner}
      </div>
    );
  }

  return inner;
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

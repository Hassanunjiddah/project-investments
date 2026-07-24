import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { prefersReducedMotion } from '@/src/constants/spacing';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/**
 * Shimmer skeleton block. On web + reduced-motion the shimmer collapses
 * to a static tinted surface. Uses only local tokens (no libraries).
 */
export function Skeleton({ width = '100%', height = 14, radius = 6, style }: SkeletonProps) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        {
          width: width as unknown as number,
          height,
          borderRadius: radius,
          backgroundColor: palette.surfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** One row of skeleton cells — useful in tables. */
export function SkeletonRow({ cells = 3 }: { cells?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: cells }).map((_, i) => (
        <Skeleton key={i} height={12} style={{ flex: 1 } as ViewStyle} />
      ))}
    </View>
  );
}

/** Card-shaped skeleton — one title + two lines. */
export function SkeletonCard() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}
    >
      <Skeleton width="60%" height={16} />
      <Skeleton width="90%" height={12} />
      <Skeleton width="40%" height={12} />
    </View>
  );
}

/** Table skeleton — header + `rows` rows. */
export function SkeletonTable({ rows = 4, cells = 3 }: { rows?: number; cells?: number }) {
  return (
    <View style={styles.table}>
      <SkeletonRow cells={cells} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} cells={cells} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    paddingVertical: 10,
  },
  card: {
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  table: {
    gap: 4,
  },
});

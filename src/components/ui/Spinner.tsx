import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  size?: 'small' | 'large';
  label?: string;
};

/**
 * Refined spinner (Feb 2026): custom rotating ring with a coloured leading
 * arc, so it reads as "brand loading" rather than generic OS spinner.
 */
export function Spinner({ size = 'large', label }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotate]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const dimension = size === 'small' ? 20 : 32;

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          borderWidth: size === 'small' ? 2 : 3,
          borderColor: palette.surfaceMuted,
          borderTopColor: palette.primary,
          transform: [{ rotate: spin }],
        }}
      />
      {label ? <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
});

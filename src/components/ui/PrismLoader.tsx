import { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Animated, Easing } from 'react-native';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';
import { prefersReducedMotion } from '@/src/constants/spacing';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  size?: Size;
  /** Duration of one full spin. Defaults to 1400ms — slow enough to feel
   *  premium, fast enough to signal activity. */
  spinMs?: number;
  /** Fill the parent instead of using a fixed size. */
  fill?: boolean;
};

/**
 * PrismLoader — Prism Capital's signature loading indicator.
 *
 * A rotating tetrahedron rendered from the four brand hexes as flat
 * geometric facets. On web we use a CSS keyframe animation (which is
 * more efficient than JS-driven RN animations for a continuous spin).
 * On native we fall back to `Animated.loop`. Both respect
 * `prefers-reduced-motion` and freeze in the identity pose if reduce
 * motion is set — the tetrahedron is a nice static logo too.
 */
export function PrismLoader({ size = 'md', spinMs = 1400, fill = false }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const rotate = useRef(new Animated.Value(0)).current;
  const reduce = prefersReducedMotion();

  const dim = fill ? undefined : size === 'sm' ? 32 : size === 'lg' ? 72 : 48;

  useEffect(() => {
    if (Platform.OS === 'web' || reduce) return;
    const anim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: spinMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [rotate, spinMs, reduce]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Facet colors — sampled from the brand palette so the loader is
  // literally the app's logo in motion.
  const facets = {
    top: palette.brand[300],   // soft lavender highlight
    left: palette.accent2[500], // dusty blue
    right: palette.brand[700], // primary navy
    front: palette.brand[500], // mid navy
  };

  // Web-only wrapper handles the CSS-based rotation. Reduce-motion users
  // just see the static tetrahedron.
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          width: fill ? '100%' : dim,
          height: fill ? '100%' : dim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            animation: reduce ? undefined : `prism-spin ${spinMs}ms linear infinite`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Tetrahedron facets={facets} />
        </div>
        <style>{`
          @keyframes prism-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <View style={[{ width: dim, height: dim }, styles.wrap]}>
      <Animated.View style={{ transform: [{ rotate: spin }], width: '100%', height: '100%' }}>
        <Tetrahedron facets={facets} />
      </Animated.View>
    </View>
  );
}

// -----------------------------------------------------------------------
// Tetrahedron — 2.5D flat-shaded prism drawn with three triangular views
// composed via absolute-positioned rotated squares. Pure CSS shapes so
// there's no SVG dependency and it renders identically on web + native.
// -----------------------------------------------------------------------
function Tetrahedron({ facets }: { facets: Record<string, string> }) {
  return (
    <View style={styles.tetrahedron}>
      {/* Left facet */}
      <View
        style={[
          styles.facet,
          {
            borderRightWidth: 26,
            borderTopWidth: 44,
            borderRightColor: 'transparent',
            borderTopColor: facets.left,
            left: 0,
            top: 8,
          },
        ]}
      />
      {/* Right facet */}
      <View
        style={[
          styles.facet,
          {
            borderLeftWidth: 26,
            borderTopWidth: 44,
            borderLeftColor: 'transparent',
            borderTopColor: facets.right,
            right: 0,
            top: 8,
          },
        ]}
      />
      {/* Front facet */}
      <View
        style={[
          styles.facet,
          {
            borderLeftWidth: 26,
            borderRightWidth: 26,
            borderBottomWidth: 44,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: facets.front,
            top: 4,
          },
        ]}
      />
      {/* Top highlight (small triangle at apex) */}
      <View
        style={[
          styles.facet,
          {
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderBottomWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: facets.top,
            top: 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tetrahedron: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  facet: {
    width: 0,
    height: 0,
    position: 'absolute',
    borderStyle: 'solid',
  },
});

import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { prefersReducedMotion } from '@/src/constants/spacing';

/**
 * Prism-refraction brand canvas. Deep green gradient + a subtle diagonal
 * light sweep (CSS keyframes on web, static on native). Respects
 * `prefers-reduced-motion`. Rotates a single line of platform facts every
 * 6s using an opacity crossfade — no layout jump.
 */
const FACTS = [
  'Every distribution passes a four-eyes approval.',
  'Immutable double-entry ledger — every kobo tracked.',
  'Unit-based subscriptions with 72-hour pledge windows.',
  'Distribution notices minted for every approved profit.',
];

type Props = {
  /** Header line on the canvas. Defaults to "Prism Capital". */
  wordmark?: string;
  /** Optional sub-line under wordmark. Defaults to "Institutional private placements." */
  tagline?: string;
  /** Extra content pinned to the bottom of the canvas (e.g. credits). */
  footer?: ReactNode;
  /** Compact mode (mobile banner): only wordmark + tagline, no rotating fact. */
  compact?: boolean;
};

export function BrandCanvas({
  wordmark = 'Prism Capital',
  tagline = 'Institutional private placements.',
  footer,
  compact = false,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [factIndex, setFactIndex] = useState(0);
  const [fade, setFade] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (compact || prefersReducedMotion()) return;
    const swap = () => {
      setFade('out');
      setTimeout(() => {
        setFactIndex((i) => (i + 1) % FACTS.length);
        setFade('in');
      }, 420);
    };
    const id = setInterval(swap, 6000);
    return () => clearInterval(id);
  }, [compact]);

  // Deep gradient — brand.900 → brand.700 → brand.500 diagonal.
  const gradientStyle =
    Platform.OS === 'web'
      ? ({
          // @ts-expect-error web-only
          backgroundImage: `linear-gradient(135deg, ${palette.brand[900]} 0%, ${palette.brand[700]} 55%, ${palette.brand[500]} 100%)`,
        } as const)
      : { backgroundColor: palette.brand[800] };

  return (
    <View style={[compact ? styles.canvasCompact : styles.canvas, gradientStyle]}>
      {Platform.OS === 'web' ? <PrismSweep /> : null}
      <View style={[styles.canvasInner, compact ? styles.canvasInnerCompact : null]}>
        <View style={styles.canvasTop}>
          <View style={styles.wordmarkRow}>
            {Platform.OS === 'web' ? (
              <img
                src="/images/prism-logo-512.png"
                alt="Prism Capital logo"
                width={32}
                height={28}
                style={{ objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <View style={styles.mark} />
            )}
            <Text style={styles.wordmark}>{wordmark}</Text>
          </View>
          <Text style={styles.tagline}>{tagline}</Text>
        </View>

        {!compact ? (
          <>
            <View style={styles.canvasCenter}>
              <Text
                style={[
                  styles.fact,
                  Platform.OS === 'web'
                    ? {
                        // @ts-expect-error web-only
                        transitionProperty: 'opacity',
                        // @ts-expect-error
                        transitionDuration: '400ms',
                        // @ts-expect-error
                        transitionTimingFunction: 'ease',
                        opacity: fade === 'in' ? 1 : 0,
                      }
                    : null,
                ]}
              >
                &ldquo;{FACTS[factIndex]}&rdquo;
              </Text>
            </View>

            <View style={styles.canvasBottom}>
              {footer ?? (
                <Text style={styles.credit}>
                  Shariah-compliant · Naira-native · Audited by design
                </Text>
              )}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** CSS-only diagonal light sweep behind the wordmark. Web only. */
function PrismSweep() {
  return (
    <View
      // @ts-expect-error web-only
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <View
        // @ts-expect-error web-only inline styles + keyframes
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-25%',
          width: '150%',
          height: '200%',
          backgroundImage: 'linear-gradient(115deg, transparent 40%, rgba(255, 255, 255, 0.08) 50%, transparent 60%)',
          animation: 'prismSweep 12s ease-in-out infinite',
        }}
      />
      {/* Inject keyframes once. */}
      <style
        // @ts-expect-error web-only
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes prismSweep {
              0%   { transform: translateX(-30%) rotate(0deg); }
              50%  { transform: translateX(30%) rotate(0deg); }
              100% { transform: translateX(-30%) rotate(0deg); }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes prismSweep { 0%,100% { transform: none; } }
            }
          `,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    minHeight: 480,
    overflow: 'hidden',
    position: 'relative',
  },
  canvasCompact: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  canvasInner: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  canvasInnerCompact: {
    padding: spacing.lg,
    justifyContent: 'center',
  },
  canvasTop: { gap: spacing.xs },
  canvasCenter: { justifyContent: 'center', paddingVertical: spacing.xl },
  canvasBottom: {},
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    // subtle inner ring — pure decor
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    transform: [{ rotate: '45deg' }],
  },
  markImage: {
    width: 32,
    height: 28,
  },
  wordmark: {
    fontFamily: typography.families.display,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: '#FFFFFF',
  },
  tagline: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.72)',
    marginLeft: 44,
  },
  fact: {
    fontFamily: typography.families.display,
    fontSize: 26,
    lineHeight: 34,
    letterSpacing: -0.3,
    color: 'rgba(255,255,255,0.95)',
    maxWidth: 480,
  },
  credit: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
  },
});

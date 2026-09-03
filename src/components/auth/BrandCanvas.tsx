import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { prefersReducedMotion } from '@/src/constants/spacing';
import { MAKER_CREDIT } from '@/src/constants/site';

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
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const swap = () => {
      setFade('out');
      fadeTimer = setTimeout(() => {
        setFactIndex((i) => (i + 1) % FACTS.length);
        setFade('in');
      }, 420);
    };
    const id = setInterval(swap, 6000);
    return () => {
      clearInterval(id);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
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
      {Platform.OS === 'web' ? <AuroraGlow /> : null}
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

              <LiveRaiseCard />
            </View>

            <View style={styles.canvasBottom}>
              {footer ?? (
                <Text style={styles.credit}>{MAKER_CREDIT}</Text>
              )}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Illustrative "live capital raise" glass card. Pure decoration — gives the
 * brand panel a product feel: pulsing LIVE dot, raise progress, glass blur.
 * Gently floats on web; static on native and under reduced motion.
 */
function LiveRaiseCard() {
  const floating =
    Platform.OS === 'web' && !prefersReducedMotion()
      ? ({ animation: 'canvasFloat 7s ease-in-out infinite' } as const)
      : null;
  return (
    <View
      style={[
        styles.glassCard,
        Platform.OS === 'web'
          ? ({
              // @ts-expect-error web-only
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              ...floating,
            } as never)
          : null,
      ]}
    >
      <View style={styles.glassHeader}>
        <View style={styles.liveDotWrap}>
          <View style={styles.liveDot} />
          {Platform.OS === 'web' ? (
            <View
              // @ts-expect-error web-only pulse halo
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#7BE1A0',
                animation: 'livePulse 2s ease-out infinite',
              }}
            />
          ) : null}
        </View>
        <Text style={styles.glassEyebrow}>LIVE · CAPITAL RAISING</Text>
      </View>

      <Text style={styles.glassTitle}>Prism Balanced Placement II</Text>

      <View style={styles.glassMetricsRow}>
        <Text style={styles.glassAmount}>₦128.4M</Text>
        <Text style={styles.glassTarget}>of ₦200M target</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: '64%' }]} />
      </View>

      <View style={styles.glassFooterRow}>
        <Text style={styles.glassFootnote}>64% subscribed</Text>
        <Text style={styles.glassFootnote}>20% est. ROI</Text>
      </View>

      {Platform.OS === 'web' ? (
        <style
          // @ts-expect-error web-only keyframes
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes canvasFloat {
                0%, 100% { transform: translateY(0px); }
                50%      { transform: translateY(-8px); }
              }
              @keyframes livePulse {
                0%   { transform: scale(1);   opacity: 0.7; }
                70%  { transform: scale(2.6); opacity: 0; }
                100% { transform: scale(2.6); opacity: 0; }
              }
              @media (prefers-reduced-motion: reduce) {
                @keyframes canvasFloat { 0%,100% { transform: none; } }
                @keyframes livePulse   { 0%,100% { transform: none; opacity: 0.7; } }
              }
            `,
          }}
        />
      ) : null}
    </View>
  );
}

/** Two soft radial glows that slowly drift behind the content. Web only. */
function AuroraGlow() {
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
        // @ts-expect-error web-only
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-15%',
          width: '70%',
          height: '70%',
          backgroundImage:
            'radial-gradient(circle, rgba(133, 176, 230, 0.35) 0%, transparent 65%)',
          animation: prefersReducedMotion() ? undefined : 'auroraDrift 18s ease-in-out infinite',
        }}
      />
      <View
        // @ts-expect-error web-only
        style={{
          position: 'absolute',
          bottom: '-25%',
          left: '-20%',
          width: '80%',
          height: '80%',
          backgroundImage:
            'radial-gradient(circle, rgba(185, 192, 219, 0.22) 0%, transparent 60%)',
          animation: prefersReducedMotion()
            ? undefined
            : 'auroraDrift 22s ease-in-out infinite reverse',
        }}
      />
      <style
        // @ts-expect-error web-only
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes auroraDrift {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50%      { transform: translate(-4%, 5%) scale(1.12); }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes auroraDrift { 0%,100% { transform: none; } }
            }
          `,
        }}
      />
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
  glassCard: {
    marginTop: spacing.xl,
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md + 4,
    gap: spacing.sm,
  },
  glassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveDotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7BE1A0',
  },
  glassEyebrow: {
    fontFamily: typography.families.ui,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.65)',
  },
  glassTitle: {
    fontFamily: typography.families.display,
    fontSize: typography.sizes.lg,
    letterSpacing: -0.2,
    color: 'rgba(255,255,255,0.95)',
  },
  glassMetricsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  glassAmount: {
    fontFamily: typography.families.display,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    ...typography.numeric.tabular,
  },
  glassTarget: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#7BE1A0',
  },
  glassFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glassFootnote: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    color: 'rgba(255,255,255,0.55)',
  },
});

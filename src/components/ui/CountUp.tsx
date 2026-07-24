import { useEffect, useState } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { prefersReducedMotion } from '@/src/constants/spacing';

type Props = Omit<TextProps, 'children'> & {
  to: number;
  /** Duration in ms. Defaults to 900. */
  durationMs?: number;
  /** Formatter for each frame — e.g. `(n) => '₦' + n.toLocaleString('en-NG')`. */
  format?: (n: number) => string;
  /** Only animate on first mount; subsequent `to` changes render instantly. Default true. */
  firstMountOnly?: boolean;
  style?: TextStyle;
};

/**
 * Count-up text. Ramps from 0 → `to` over `durationMs` using easing.
 * Respects `prefers-reduced-motion` — falls back to instant render.
 * Uses requestAnimationFrame so it doesn't stall the UI thread.
 */
export function CountUp({
  to,
  durationMs = 900,
  format = (n) => Math.round(n).toLocaleString('en-NG'),
  firstMountOnly = true,
  style,
  ...props
}: Props) {
  const [display, setDisplay] = useState<number>(
    prefersReducedMotion() || !firstMountOnly ? to : 0,
  );
  const [hasAnimated, setHasAnimated] = useState(prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(to);
      return;
    }
    if (firstMountOnly && hasAnimated) {
      setDisplay(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else setHasAnimated(true);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  return (
    <Text style={style} {...props}>
      {format(display)}
    </Text>
  );
}

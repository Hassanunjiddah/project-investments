import { View, Text, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { Card } from '@/src/components/ui/Card';

type Props = {
  /** Big label (e.g. "MONTHLY YIELD"). */
  label: string;
  /** Display value (already formatted, e.g. "₦2.4M" or "12.6%"). */
  value: string;
  /** Optional secondary value (e.g. "of ₦5M target"). */
  meta?: string;
  /** Data points — will be normalised & drawn as a smooth polyline. */
  points: number[];
  /** Optional delta chip. */
  delta?: { label: string; direction?: 'up' | 'down' | 'neutral' };
  /** Force a tone accent (defaults to brand navy). */
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * SparklineTile — small card with a title, big value, tiny delta chip,
 * and an inline sparkline. Used on Home / Portfolio / Earnings to give a
 * quick visual pulse of a metric over time.
 *
 * The chart is a lightweight SVG polyline (web) / RN View path (native).
 * We keep it deliberately small — this is a "glance" element, not a
 * data-inspection tool.
 */
export function SparklineTile({
  label,
  value,
  meta,
  points,
  delta,
  tone = 'brand',
  onPress,
  style,
  testID,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const toneColor =
    tone === 'success'
      ? palette.semantic.success.fg
      : tone === 'warning'
        ? palette.semantic.warning.fg
        : tone === 'danger'
          ? palette.semantic.danger.fg
          : palette.brand[700];

  const deltaTone =
    delta?.direction === 'up'
      ? palette.semantic.success
      : delta?.direction === 'down'
        ? palette.semantic.danger
        : palette.semantic.info;

  return (
    <Card
      interactive={!!onPress}
      onPress={onPress}
      testID={testID}
      style={style}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
        {delta ? (
          <View
            style={[
              styles.deltaChip,
              { backgroundColor: deltaTone.bg, borderColor: deltaTone.border },
            ]}
          >
            <Text style={[styles.deltaText, tabularNums, { color: deltaTone.fg }]}>
              {delta.direction === 'up' ? '↑ ' : delta.direction === 'down' ? '↓ ' : ''}
              {delta.label}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.value, tabularNums, { color: palette.text }]}>{value}</Text>
      {meta ? (
        <Text style={[styles.meta, { color: palette.textSecondary }]}>{meta}</Text>
      ) : null}

      <View style={styles.chartWrap}>
        <Sparkline points={points} color={toneColor} fillColor={palette.brand[50]} />
      </View>
    </Card>
  );
}

// -----------------------------------------------------------------------
// Sparkline — SVG polyline on web (crisp, cheap), fallback on native.
// -----------------------------------------------------------------------
function Sparkline({
  points,
  color,
  fillColor,
}: {
  points: number[];
  color: string;
  fillColor: string;
}) {
  const width = 240;
  const height = 56;
  const padding = 4;

  const safe = points.length ? points : [0, 0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const step = safe.length > 1 ? (width - padding * 2) / (safe.length - 1) : 0;
  const coords = safe.map((v, i) => {
    const x = padding + i * step;
    const y = padding + (height - padding * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  // Area path — line, then bottom-right, bottom-left, close
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.[0] ?? 0} ${height - padding} L ${coords[0]?.[0] ?? 0} ${height - padding} Z`;
  const lastX = coords[coords.length - 1]?.[0] ?? 0;
  const lastY = coords[coords.length - 1]?.[1] ?? 0;

  if (Platform.OS === 'web') {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`spark-fill-${color}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#spark-fill-${color})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Terminal dot */}
        <circle cx={lastX} cy={lastY} r={3} fill={color} />
      </svg>
    );
  }

  // Native fallback — 8 vertical bars for a "sparkbar" look. Native SVG
  // would require react-native-svg; keeping this dependency-free.
  const bars = safe.slice(-8);
  return (
    <View style={styles.nativeBars}>
      {bars.map((v, i) => {
        const h = 4 + ((v - min) / range) * (height - 8);
        return (
          <View
            key={i}
            style={{
              width: 4,
              height: h,
              backgroundColor: color,
              opacity: 0.35 + (i / bars.length) * 0.65,
              borderRadius: 2,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.4,
    fontFamily: typography.families.display,
  },
  meta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
    fontWeight: typography.weights.medium,
  },
  chartWrap: {
    marginTop: spacing.sm,
    height: 56,
    width: '100%',
    justifyContent: 'flex-end',
  },
  deltaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  nativeBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 56,
  },
});

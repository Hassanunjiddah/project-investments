import { View, StyleSheet, Platform } from 'react-native';

type Props = {
  points: number[];
  color: string;
  fillColor?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
};

/**
 * MiniSparkline — a lightweight SVG polyline (web) / bar chart (native)
 * intended for inline compact use inside cards and rows. No labels,
 * no card wrapper — just the chart. Extracted from `SparklineTile` so
 * multiple surfaces (PositionCard, PortfolioScreen row, NAV/Unit card)
 * can render a tiny inline chart without repeating the SVG math.
 */
export function MiniSparkline({
  points,
  color,
  fillColor,
  width = 120,
  height = 32,
  strokeWidth = 1.6,
}: Props) {
  const padding = 2;
  const safe = points.length > 0 ? points : [0, 0];
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
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.[0] ?? 0} ${height - padding} L ${coords[0]?.[0] ?? 0} ${height - padding} Z`;
  const lastX = coords[coords.length - 1]?.[0] ?? 0;
  const lastY = coords[coords.length - 1]?.[1] ?? 0;
  const gradId = `mini-spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  if (Platform.OS === 'web') {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={fillColor ?? color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r={2.2} fill={color} />
      </svg>
    );
  }

  // Native fallback — sparkbars (dependency-free).
  const bars = safe.slice(-8);
  return (
    <View style={[styles.bars, { width, height }]}>
      {bars.map((v, i) => {
        const h = 3 + ((v - min) / range) * (height - 6);
        return (
          <View
            key={i}
            style={{
              width: 3,
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
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
});

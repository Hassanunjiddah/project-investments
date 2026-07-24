import { View, Text, StyleSheet } from 'react-native';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Segment = {
  units: number;
  investorName?: string | null;
  status: string; // COMMITTED | PROOF_SUBMITTED | CONFIRMED
};

type Props = {
  segments: Segment[];
  totalUnits: number;
  palette: any;
};

// Deterministic colour palette — cycled by index. Prism-ish greens & teals.
const COLOURS = [
  '#166534', '#22C55E', '#0EA5E9', '#7C3AED',
  '#F59E0B', '#EF4444', '#EC4899', '#0891B2',
  '#84CC16', '#8B5CF6', '#F97316', '#14B8A6',
];

function statusOpacity(status: string): number {
  if (status === 'CONFIRMED') return 1;
  if (status === 'PROOF_SUBMITTED') return 0.75;
  return 0.4; // COMMITTED / other = light band = pledged, not yet paid
}

export function UnitSpectrumBar({ segments, totalUnits, palette }: Props) {
  const heldUnits = segments.reduce((s, x) => s + (x.units || 0), 0);
  const available = Math.max(0, totalUnits - heldUnits);

  if (totalUnits <= 0) return null;

  return (
    <View style={styles.wrap} data-testid="unit-spectrum-bar">
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.textSecondary }]}>
          UNIT REGISTER
        </Text>
        <Text style={[styles.tally, { color: palette.textSecondary }]}>
          {heldUnits} / {totalUnits} taken · {available} available
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        {segments.map((seg, i) => {
          const flex = seg.units;
          if (flex <= 0) return null;
          return (
            <View
              key={i}
              style={{
                flex,
                backgroundColor: COLOURS[i % COLOURS.length],
                opacity: statusOpacity(seg.status),
              }}
              data-testid={`spectrum-seg-${i}`}
            />
          );
        })}
        {available > 0 ? (
          <View
            style={{
              flex: available,
              backgroundColor: 'transparent',
              borderLeftWidth: heldUnits > 0 ? 1 : 0,
              borderLeftColor: palette.border,
            }}
          />
        ) : null}
      </View>
      {segments.length > 0 ? (
        <View style={styles.legend}>
          {segments.map((seg, i) => (
            <View key={i} style={styles.legendRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: COLOURS[i % COLOURS.length],
                    opacity: statusOpacity(seg.status),
                  },
                ]}
              />
              <Text style={[styles.legendText, { color: palette.text }]} numberOfLines={1}>
                {seg.investorName || 'Investor'} · {seg.units} u
                {seg.status !== 'CONFIRMED' ? ` · ${seg.status.toLowerCase()}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  tally: { fontSize: typography.sizes.xs, fontFamily: 'monospace' },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
  },
  legend: { marginTop: 6, gap: 4, flexDirection: 'row', flexWrap: 'wrap' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  legendText: { fontSize: typography.sizes.xs, fontWeight: '500' },
});

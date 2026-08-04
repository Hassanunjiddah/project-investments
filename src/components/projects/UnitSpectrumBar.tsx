import { View, Text, StyleSheet, Platform } from 'react-native';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatUnits } from '@/src/utils/units';

type Segment = {
  units: number;
  investorName?: string | null;
  status: string; // COMMITTED | PROOF_SUBMITTED | CONFIRMED | REMNANT_PENDING
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
  if (status === 'REMNANT_PENDING') return 0.25;
  return 0.4; // COMMITTED / other = light band = pledged, not yet paid
}

function statusSuffix(status: string): string {
  if (status === 'CONFIRMED') return '';
  if (status === 'REMNANT_PENDING') return ' · awaiting LM';
  return ` · ${status.toLowerCase().replace(/_/g, ' ')}`;
}

export function UnitSpectrumBar({ segments, totalUnits, palette }: Props) {
  const heldUnits = Math.round(segments.reduce((s, x) => s + (x.units || 0), 0) * 1e6) / 1e6;
  const available = Math.round(Math.max(0, totalUnits - heldUnits) * 1e6) / 1e6;

  if (totalUnits <= 0) return null;

  const srSummary = [
    `Unit register. ${formatUnits(heldUnits)} of ${formatUnits(totalUnits)} units taken, ${formatUnits(available)} available.`,
    ...segments
      .filter((s) => s.units > 0)
      .map(
        (s) =>
          `${s.investorName || 'Investor'}: ${formatUnits(s.units)} unit${s.units === 1 ? '' : 's'}, ${s.status.toLowerCase().replace(/_/g, ' ')}.`,
      ),
  ].join(' ');

  return (
    <View style={styles.wrap} data-testid="unit-spectrum-bar">
      {Platform.OS === 'web' ? (
        <span
          aria-label={srSummary}
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            left: -9999,
            whiteSpace: 'nowrap',
          }}
        >
          {srSummary}
        </span>
      ) : (
        <Text style={styles.srOnly} accessibilityLabel={srSummary}>
          {srSummary}
        </Text>
      )}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.textSecondary }]}>UNIT REGISTER</Text>
        <Text style={[styles.tally, { color: palette.textSecondary }]}>
          {formatUnits(heldUnits)} / {formatUnits(totalUnits)} taken · {formatUnits(available)}{' '}
          available
        </Text>
      </View>
      <View
        style={[styles.bar, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}
      >
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
                {seg.investorName || 'Investor'} · {formatUnits(seg.units)} u
                {statusSuffix(seg.status)}
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
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    left: -9999,
  },
});

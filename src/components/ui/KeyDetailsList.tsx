import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { bpsToPercent, formatDuration, type Project } from '@/src/types/project.types';
import { formatNaira } from '@/src/utils/currency';
import { formatUnits } from '@/src/utils/units';

type Props = {
  project: Project;
  /** When false, hide Risks/Timeline (investor teaser until CONFIRMED). Default true. */
  revealSensitive?: boolean;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sector: 'pricetag-outline',
  Location: 'location-outline',
  Duration: 'time-outline',
  Target: 'cash-outline',
  'Total units': 'grid-outline',
  'Min units': 'remove-circle-outline',
  'Unit price': 'pricetag-outline',
  'Projected profit': 'trending-up-outline',
  'Platform fee': 'business-outline',
  'Exit Notice': 'exit-outline',
  'Profit Split': 'people-outline',
  Risks: 'warning-outline',
  Timeline: 'calendar-outline',
};

export function KeyDetailsList({ project, revealSensitive = true }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const penaltyPct = (project.earlyExitPenaltyBps / 100).toFixed(0);
  const investorPct = (project.profitSplitInvestorBps / 100).toFixed(0);
  const managerPct = (100 - Number(investorPct)).toFixed(0);
  const roiPct = bpsToPercent(project.estimatedRoiBps);
  const platformFeePct =
    project.platformFeeBps != null ? bpsToPercent(project.platformFeeBps) : null;

  const items: Array<{ label: string; value: string }> = [
    { label: 'Sector', value: project.sector },
    { label: 'Location', value: project.location },
    {
      label: 'Duration',
      value: formatDuration(project.durationValue, project.durationUnit),
    },
    { label: 'Target', value: formatNaira(project.targetMinor) },
  ];

  if (project.totalUnits != null && project.totalUnits > 0) {
    items.push({ label: 'Total units', value: formatUnits(project.totalUnits) });
    items.push({
      label: 'Min units',
      value: formatUnits(project.minUnitsPerInvestor ?? 1),
    });
    if (project.unitPriceMinor != null && project.unitPriceMinor > 0) {
      items.push({ label: 'Unit price', value: formatNaira(project.unitPriceMinor) });
    }
  }

  items.push({
    label: 'Projected profit',
    value: `${roiPct}%`,
  });
  if (platformFeePct != null) {
    items.push({
      label: 'Platform fee',
      value: `${platformFeePct}% of net profit`,
    });
  }
  items.push({
    label: 'Exit Notice',
    value: `${project.exitNoticeDays} days with ${penaltyPct}% penalty`,
  });
  items.push({
    label: 'Profit Split',
    value: `${investorPct}% Investors / ${managerPct}% Manager`,
  });

  const longItems: Array<{ label: 'Risks' | 'Timeline'; value: string }> = revealSensitive
    ? (
        [
          { label: 'Risks' as const, value: project.risks },
          { label: 'Timeline' as const, value: project.timeline },
        ].filter((x) => x.value && x.value.trim().length > 0) as Array<{
          label: 'Risks' | 'Timeline';
          value: string;
        }>
      )
    : [];

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View
          key={item.label}
          style={[
            styles.row,
            index < items.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: palette.border,
            },
          ]}
        >
          <Ionicons
            name={ICONS[item.label] ?? 'information-circle-outline'}
            size={16}
            color={palette.primary}
            style={styles.icon}
          />
          <Text style={[styles.label, { color: palette.textSecondary }]}>{item.label}</Text>
          <Text style={[styles.value, { color: palette.text }]}>{item.value}</Text>
        </View>
      ))}

      {longItems.map((item) => (
        <View
          key={item.label}
          style={[
            styles.longRow,
            { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border },
          ]}
        >
          <View style={styles.longHead}>
            <Ionicons
              name={ICONS[item.label]}
              size={16}
              color={palette.primary}
              style={styles.icon}
            />
            <Text style={[styles.label, { color: palette.textSecondary }]}>{item.label}</Text>
          </View>
          <Text style={[styles.longBody, { color: palette.text }]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  icon: { marginRight: spacing.sm, width: 20 },
  label: { fontSize: typography.sizes.sm, flex: 1 },
  value: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    flex: 1.2,
    textAlign: 'right',
  },
  longRow: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  longHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  longBody: {
    fontSize: typography.sizes.sm,
    lineHeight: 22,
    paddingLeft: 20 + spacing.sm,
  },
});

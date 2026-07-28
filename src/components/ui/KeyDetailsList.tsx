import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sector: 'pricetag-outline',
  Location: 'location-outline',
  Duration: 'time-outline',
  'Exit Notice': 'exit-outline',
  'Profit Split': 'people-outline',
  Risks: 'warning-outline',
  Timeline: 'calendar-outline',
};

export function KeyDetailsList({ project }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const penaltyPct = (project.earlyExitPenaltyBps / 100).toFixed(0);
  const investorPct = (project.profitSplitInvestorBps / 100).toFixed(0);
  const managerPct = (100 - Number(investorPct)).toFixed(0);

  // Single-line items (short values on the right)
  const items = [
    { label: 'Sector', value: project.sector },
    { label: 'Location', value: project.location },
    { label: 'Duration', value: `${project.durationValue} ${project.durationUnit}` },
    {
      label: 'Exit Notice',
      value: `${project.exitNoticeDays} days with ${penaltyPct}% penalty`,
    },
    {
      label: 'Profit Split',
      value: `${investorPct}% Investors / ${managerPct}% Manager`,
    },
  ];

  // Long-form items (risks + timeline) — stacked block below.
  const longItems: Array<{ label: 'Risks' | 'Timeline'; value?: string }> = [
    { label: 'Risks', value: project.risks },
    { label: 'Timeline', value: project.timeline },
  ].filter((x) => x.value && x.value.trim().length > 0) as Array<{
    label: 'Risks' | 'Timeline';
    value: string;
  }>;

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
            <Text style={[styles.label, { color: palette.textSecondary }]}>
              {item.label}
            </Text>
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

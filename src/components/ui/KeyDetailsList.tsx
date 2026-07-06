import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { MockProjectWithCreator } from '@/db/types/project';

type Props = {
  project: MockProjectWithCreator;
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Sector: 'pricetag-outline',
  Location: 'location-outline',
  Duration: 'time-outline',
  'Exit Notice': 'exit-outline',
  'Profit Split': 'people-outline',
};

export function KeyDetailsList({ project }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const penaltyPct = (project.earlyExitPenaltyBps / 100).toFixed(0);
  const investorPct = (project.profitSplitInvestorBps / 100).toFixed(0);
  const managerPct = (100 - Number(investorPct)).toFixed(0);

  const items = [
    { label: 'Sector', value: project.sector },
    { label: 'Location', value: project.location },
    { label: 'Duration', value: `${project.durationMonths} months` },
    {
      label: 'Exit Notice',
      value: `${project.exitNoticeDays} days with ${penaltyPct}% penalty`,
    },
    {
      label: 'Profit Split',
      value: `${investorPct}% Investors / ${managerPct}% Manager`,
    },
  ];

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
});

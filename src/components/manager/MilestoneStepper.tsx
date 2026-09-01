import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { Milestone } from '@/src/types/project.types';

type Props = {
  milestones: Milestone[];
};

export function MilestoneStepper({ milestones }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const completed = milestones.filter((m) => m.status === 'completed').length;

  const statusLabel = (m: Milestone) => {
    if (m.status === 'completed') return 'Completed';
    if (m.status === 'in_progress') return 'In Progress';
    return 'Pending';
  };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: palette.text }]}>Milestone Progress</Text>
        <Text style={[styles.count, { color: palette.textSecondary }]}>
          {completed} of {milestones.length} completed
        </Text>
      </View>
      <View style={styles.stepperRow}>
        {milestones.map((m, i) => (
          <View key={m.id} style={styles.stepCol}>
            <View style={styles.dotRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      m.status === 'completed'
                        ? palette.primary
                        : m.status === 'in_progress'
                          ? palette.primary
                          : palette.border,
                    borderWidth: m.status === 'in_progress' ? 2 : 0,
                    borderColor: palette.primaryLight,
                  },
                ]}
              />
              {i < milestones.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: m.status === 'completed' ? palette.primary : palette.border,
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.stepLabel, { color: palette.text }]} numberOfLines={1}>
              {m.label}
            </Text>
            <Text style={[styles.stepStatus, { color: palette.muted }]}>{statusLabel(m)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heading: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  count: { fontSize: typography.sizes.xs },
  stepperRow: { flexDirection: 'row' },
  stepCol: { flex: 1, alignItems: 'center' },
  dotRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  connector: { flex: 1, height: 2, marginHorizontal: 2 },
  stepLabel: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  stepStatus: { fontSize: 9, marginTop: 2, textAlign: 'center' },
});

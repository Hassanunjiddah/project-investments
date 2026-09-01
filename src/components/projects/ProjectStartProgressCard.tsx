import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira } from '@/src/utils/currency';
import { startProjectProgress } from '@/src/services/projectOps.services';
import type { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
};

export function ProjectStartProgressCard({ project, busy, setBusy, onDone }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  return (
    <View
      style={[
        styles.block,
        {
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Text style={[styles.title, { color: palette.text }]}>Start Progress early</Text>
      <Text style={[styles.helper, { color: palette.textSecondary }]}>
        {project.raisedMinor < project.targetMinor
          ? `Fundraising is still short of target (${formatNaira(project.raisedMinor)} of ${formatNaira(project.targetMinor)}). You can move this project to Progress anyway so the owner can draw down and operate.`
          : 'Move this project from Acceptance into Progress so the owner can draw down and operate.'}
        {(project.raiseFeeBps ?? 0) > 0 && project.raisedMinor > 0
          ? ` Prism raise fee (${(project.raiseFeeBps! / 100).toFixed(1)}%) will be reserved on capital raised so far.`
          : ''}
      </Text>
      <Button
        title="Move to Progress"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await startProjectProgress(project.id);
            onDone();
            pushToast({
              type: 'success',
              message: 'Project is now in Progress.',
            });
          } catch (err) {
            pushToast({
              type: 'error',
              message: err instanceof Error ? err.message : 'Could not start Progress',
            });
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  title: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  helper: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
});

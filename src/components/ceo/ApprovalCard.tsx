import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { StageBadge } from '../ui/StageBadge';
import { Button } from '../ui/Button';
import type { MockProjectWithCreator } from '@/db/types/project';

type Props = {
  project: MockProjectWithCreator;
  compact?: boolean;
  onPress?: () => void;
  onReject?: () => void;
  onApprove?: () => void;
};

export function ApprovalCard({
  project,
  compact = false,
  onPress,
  onReject,
  onApprove,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  const content = (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.row}>
        <Image
          source={{ uri: project.coverImageUrl }}
          style={[styles.thumb, compact && styles.thumbCompact]}
          contentFit="cover"
        />
        <View style={styles.body}>
          {compact ? (
            <>
              <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {project.name}
              </Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                By {project.creatorName}
              </Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                Target: {formatNaira(project.targetKobo)}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]}>
                Requested: {project.createdAt}
              </Text>
              <View style={styles.badgeRow}>
                <StageBadge stage={project.stage} />
              </View>
            </>
          ) : (
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
                  {project.name}
                </Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>
                  {project.sector}
                </Text>
                <Text style={[styles.amount, { color: palette.text }]}>
                  {formatNaira(project.targetKobo)}
                </Text>
                <View style={styles.badgeRow}>
                  <StageBadge stage={project.stage} />
                </View>
              </View>
              <View style={styles.requestedBlock}>
                <Text style={[styles.requestedLabel, { color: palette.muted }]}>Requested by</Text>
                <Text style={[styles.requestedName, { color: palette.textSecondary }]}>
                  {project.creatorName}
                </Text>
                <Text style={[styles.requestedDate, { color: palette.muted }]}>
                  {project.createdAt}
                </Text>
              </View>
            </View>
          )}
        </View>
        {compact ? <Ionicons name="chevron-forward" size={18} color={palette.muted} /> : null}
      </View>
      {!compact && onReject && onApprove ? (
        <View style={styles.actions}>
          <Button
            title="Reject"
            variant="outlineDanger"
            size="sm"
            onPress={onReject}
            style={styles.actionBtn}
          />
          <Button
            title="Review & Approve"
            size="sm"
            onPress={onApprove}
            style={styles.actionBtn}
          />
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbCompact: { width: 56, height: 56 },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  titleBlock: { flex: 1 },
  requestedBlock: { alignItems: 'flex-end', maxWidth: 100 },
  title: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  meta: { fontSize: typography.sizes.xs, marginTop: 2 },
  amount: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, marginTop: 4 },
  requestedLabel: { fontSize: 10, textAlign: 'right' },
  requestedName: { fontSize: typography.sizes.xs, textAlign: 'right', marginTop: 2 },
  requestedDate: { fontSize: 10, textAlign: 'right', marginTop: 2 },
  badgeRow: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
});

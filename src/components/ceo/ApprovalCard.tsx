import moment from 'moment';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { StageBadge } from '../ui/StageBadge';
import { Button } from '../ui/Button';
import { Project } from '@/src/types/project.types';
import { useState } from 'react';

type Props = {
  project: Project;
  compact?: boolean;
  onPress?: () => void;
  onReject?: () => void;
  onApprove?: () => void;
  loading?: boolean;
};

export function ApprovalCard({
  project,
  compact = false,
  loading,
  onPress,
  onReject,
  onApprove,
}: Props) {
  const [loadingBtn, setLoadingBtn] = useState<'reject' | 'approve' | null>(null);
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const handleReject = () => {
    setLoadingBtn('reject');
    onReject?.();
  };
  const handleApprove = () => {
    setLoadingBtn('approve');
    onApprove?.();
  };

  const isRejectLoading = loadingBtn === 'reject' && loading;
  const isApproveLoading = loadingBtn === 'approve' && loading;

  const content = (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.row}>
        <Image
          source={{ uri: project.bannerUrl ?? '' }}
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
                By {project.createdBy.full_name}
              </Text>
              <Text style={[styles.meta, { color: palette.textSecondary }]}>
                Target: {formatNaira(project.targetMinor)}
              </Text>
              <Text style={[styles.meta, { color: palette.muted }]}>
                Requested: {moment(project.submittedAt).calendar()}
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
                  {formatNaira(project.targetMinor)}
                </Text>
                <View style={styles.badgeRow}>
                  <StageBadge stage={project.stage} />
                </View>
              </View>
              <View style={styles.requestedBlock}>
                <Text style={[styles.requestedLabel, { color: palette.muted }]}>Requested by</Text>
                <Text style={[styles.requestedName, { color: palette.textSecondary }]}>
                  {project.createdBy.full_name}
                </Text>
                <Text style={[styles.requestedDate, { color: palette.muted }]}>
                  {moment(project.submittedAt).calendar()}
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
            onPress={handleReject}
            style={styles.actionBtn}
            loading={isRejectLoading}
          />
          <Button
            title="Review & Approve"
            size="sm"
            onPress={handleApprove}
            style={styles.actionBtn}
            loading={isApproveLoading}
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
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: { flexGrow: 1, flexShrink: 1, flexBasis: 140 },
  requestedBlock: { alignItems: 'flex-end', maxWidth: 110, flexShrink: 1 },
  title: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  meta: { fontSize: typography.sizes.xs, marginTop: 2 },
  amount: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, marginTop: 4 },
  requestedLabel: { fontSize: 10, textAlign: 'right' },
  requestedName: { fontSize: typography.sizes.xs, textAlign: 'right', marginTop: 2 },
  requestedDate: { fontSize: 10, textAlign: 'right', marginTop: 2 },
  badgeRow: { marginTop: spacing.xs, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  actionBtn: { flexGrow: 1, flexBasis: '40%', minWidth: 130 },
});

import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Platform, Alert } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useProfitUpdates, usePostProfitUpdate, useEndProject } from '@/src/hooks/profits/useProfits';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import moment from 'moment';

type Props = {
  projectId: string;
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  canPost: boolean; // LM only, project in PROGRESS
  realisedProfitKobo: number;
  managerShareBps: number; // (1 - investor_bps) manager keeps
  investorShareBps: number;
  confirmedInvestorCount?: number;
  onPosted?: () => void;
  onEnded?: () => void;
};

export function ProjectProfitsTab({
  projectId,
  projectStage,
  canPost,
  realisedProfitKobo,
  managerShareBps,
  investorShareBps,
  confirmedInvestorCount = 0,
  onPosted,
  onEnded,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: updates = [], isLoading, refetch } = useProfitUpdates(projectId);
  const post = usePostProfitUpdate(projectId);
  const endProject = useEndProject(projectId);

  const handlePost = async () => {
    setError(null);
    const naira = parseFloat(amount);
    if (!Number.isFinite(naira) || naira <= 0) {
      setError('Enter a positive amount in Naira.');
      return;
    }
    try {
      await post.mutateAsync({ amountMinor: nairaToKobo(naira), note: note.trim() });
      setAmount('');
      setNote('');
      refetch();
      onPosted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post update.');
    }
  };

  const managerShareKobo = Math.round((realisedProfitKobo * managerShareBps) / 10000);
  const investorPoolKobo = Math.round((realisedProfitKobo * investorShareBps) / 10000);

  const runEndProject = async () => {
    try {
      await endProject.mutateAsync();
      pushToast({ type: 'success', message: 'Project ended. Payouts generated.' });
      onEnded?.();
    } catch (e) {
      pushToast({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to end project.',
      });
    }
  };

  const handleEndProject = () => {
    const poolNaira = formatNaira(investorPoolKobo);
    const msg =
      `End this project now?\n\n` +
      `${poolNaira} will be distributed to ${confirmedInvestorCount} investor` +
      `${confirmedInvestorCount === 1 ? '' : 's'} (pro-rata by capital). ` +
      `No further profit updates can be posted. This cannot be undone.`;

    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(msg)) {
        runEndProject();
      }
      return;
    }
    Alert.alert('End project', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End project', style: 'destructive', onPress: runEndProject },
    ]);
  };

  return (
    <View>
      <View
        style={[
          styles.summary,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        data-testid="profits-summary"
      >
        <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>
          Total realised profit
        </Text>
        <Text
          style={[styles.summaryValue, { color: palette.text }]}
          data-testid="profits-total-realised"
        >
          {formatNaira(realisedProfitKobo, false)}
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCell}>
            <Text style={[styles.smLabel, { color: palette.textSecondary }]}>Investor pool</Text>
            <Text style={[styles.smValue, { color: palette.text }]}>
              {formatNaira(investorPoolKobo)}
            </Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={[styles.smLabel, { color: palette.textSecondary }]}>Manager share</Text>
            <Text style={[styles.smValue, { color: palette.primary }]}>
              {formatNaira(managerShareKobo)}
            </Text>
          </View>
        </View>
      </View>

      {canPost && projectStage === 'PROGRESS' ? (
        <View style={styles.endBtnWrap}>
          <Button
            title="End Project"
            variant="danger"
            onPress={handleEndProject}
            loading={endProject.isPending}
            data-testid="end-project-btn"
          />
          <Text style={[styles.endHint, { color: palette.textSecondary }]}>
            Distributes current realised profit to investors and closes the project.
          </Text>
        </View>
      ) : null}

      {canPost ? (
        <View
          style={[styles.form, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.formTitle, { color: palette.text }]}>Post profit update</Text>
          {projectStage !== 'PROGRESS' ? (
            <Text style={[styles.hint, { color: palette.warning }]}>
              Profit can only be posted while the project is in Progress. Current stage:{' '}
              {projectStage}.
            </Text>
          ) : null}
          <TextInput
            label="Amount realised (₦)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            data-testid="profit-amount-input"
          />
          <TextInput
            label="Note (what was achieved?)"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            data-testid="profit-note-input"
          />
          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Post update"
            onPress={handlePost}
            loading={post.isPending}
            disabled={projectStage !== 'PROGRESS'}
            data-testid="profit-post-btn"
          />
        </View>
      ) : null}

      <Text style={[styles.feedTitle, { color: palette.text }]}>Updates</Text>
      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : updates.length === 0 ? (
        <EmptyState title="No profit updates yet" message="Posted profit updates will appear here." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {updates.map((u) => (
            <View
              key={u.id}
              style={[
                styles.row,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
              data-testid={`profit-update-${u.id}`}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.rowAmount, { color: palette.text }]}>
                  +{formatNaira(u.amountMinor)}
                </Text>
                <Text style={[styles.rowMeta, { color: palette.muted }]}>
                  {moment(u.createdAt).calendar()}
                </Text>
              </View>
              {u.note ? (
                <Text style={[styles.rowNote, { color: palette.textSecondary }]}>{u.note}</Text>
              ) : null}
              {u.postedByName ? (
                <Text style={[styles.rowMeta, { color: palette.muted, marginTop: 4 }]}>
                  by {u.postedByName}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  summaryLabel: { fontSize: typography.sizes.xs, marginBottom: 4 },
  summaryValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.lg },
  summaryCell: { minWidth: 100 },
  smLabel: { fontSize: typography.sizes.xs, marginBottom: 2 },
  smValue: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  form: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  formTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  hint: { fontSize: typography.sizes.xs, marginBottom: 2 },
  err: { fontSize: typography.sizes.xs },
  feedTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  rowMeta: { fontSize: typography.sizes.xs },
  rowNote: { fontSize: typography.sizes.sm, marginTop: 4 },
  endBtnWrap: { marginBottom: spacing.md, gap: 4 },
  endHint: { fontSize: typography.sizes.xs },
});

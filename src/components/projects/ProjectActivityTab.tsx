import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import {
  useProjectUpdates,
  usePostProjectUpdate,
} from '@/src/hooks/projectUpdates/useProjectUpdates';
import {
  PROJECT_UPDATE_KIND_LABELS,
  PROJECT_UPDATE_KIND_ORDER,
  type ProjectUpdateKind,
} from '@/src/types/projectUpdate.types';

type Props = {
  projectId: string;
  canPost: boolean;
};

const KIND_ICON: Record<ProjectUpdateKind, keyof typeof Ionicons.glyphMap> = {
  ANNOUNCEMENT: 'megaphone-outline',
  MILESTONE: 'flag-outline',
  FUND_USE: 'cash-outline',
  RISK: 'warning-outline',
  ENGAGEMENT: 'chatbubbles-outline',
};

const FILTER_TABS: { key: ProjectUpdateKind | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  ...PROJECT_UPDATE_KIND_ORDER.map((k) => ({ key: k, label: PROJECT_UPDATE_KIND_LABELS[k] })),
];

export function ProjectActivityTab({ projectId, canPost }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [filter, setFilter] = useState<ProjectUpdateKind | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<ProjectUpdateKind>('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeKind = filter === 'ALL' ? undefined : filter;
  const { data: updates = [], isLoading, refetch } = useProjectUpdates(projectId, activeKind);
  const post = usePostProjectUpdate(projectId);

  const iconFor = (k: ProjectUpdateKind) => KIND_ICON[k];

  const filteredUpdates = useMemo(() => updates, [updates]);

  const handlePost = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    let amountMinor: number | undefined;
    if (kind === 'FUND_USE') {
      const naira = parseFloat(amount);
      if (!Number.isFinite(naira) || naira <= 0) {
        setError('Fund-use updates need a positive amount.');
        return;
      }
      amountMinor = nairaToKobo(naira);
    }
    try {
      await post.mutateAsync({ kind, title: title.trim(), body: body.trim(), amountMinor });
      setTitle('');
      setBody('');
      setAmount('');
      setShowForm(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post update.');
    }
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Activity</Text>
        {canPost ? (
          <Button
            title={showForm ? 'Cancel' : 'Post update'}
            size="sm"
            variant={showForm ? 'outline' : 'primary'}
            onPress={() => setShowForm((v) => !v)}
            data-testid="toggle-post-update-btn"
          />
        ) : null}
      </View>

      {canPost && showForm ? (
        <View
          style={[styles.form, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>Update type</Text>
          <View style={styles.kindRow}>
            {PROJECT_UPDATE_KIND_ORDER.map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[
                    styles.kindChip,
                    {
                      backgroundColor: active ? palette.primary : palette.surface,
                      borderColor: active ? palette.primary : palette.border,
                    },
                  ]}
                  data-testid={`update-kind-${k}`}
                >
                  <Ionicons
                    name={iconFor(k)}
                    size={13}
                    color={active ? '#fff' : palette.textSecondary}
                  />
                  <Text
                    style={[styles.kindChipText, { color: active ? '#fff' : palette.textSecondary }]}
                  >
                    {PROJECT_UPDATE_KIND_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder={kind === 'FUND_USE' ? 'e.g. Purchased mining equipment' : 'Short summary'}
            data-testid="update-title-input"
          />

          {kind === 'FUND_USE' ? (
            <TextInput
              label="Amount used (₦)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              data-testid="update-amount-input"
            />
          ) : null}

          <TextInput
            label="Details"
            value={body}
            onChangeText={setBody}
            placeholder="Add context for investors..."
            multiline
            numberOfLines={3}
            data-testid="update-body-input"
          />

          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Post update"
            onPress={handlePost}
            loading={post.isPending}
            data-testid="submit-update-btn"
          />
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <View
          style={[
            styles.filterTrack,
            { backgroundColor: palette.surfaceMuted, borderColor: palette.border },
          ]}
        >
          {FILTER_TABS.map((t) => {
            const active = filter === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setFilter(t.key)}
                style={[
                  styles.filterChip,
                  active && { backgroundColor: palette.primary },
                ]}
                data-testid={`filter-${t.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: active ? '#FFFFFF' : palette.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : filteredUpdates.length === 0 ? (
        <EmptyState
          title="No updates yet"
          message={
            canPost
              ? 'Post the first update — risks, fund use, milestones or announcements.'
              : 'Prism has not posted any updates on this project yet.'
          }
        />
      ) : (
        filteredUpdates.map((u) => (
          <View
            key={u.id}
            style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}
            data-testid={`activity-update-${u.id}`}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
                <Ionicons name={iconFor(u.kind)} size={14} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kindLabel, { color: palette.primary }]}>
                  {PROJECT_UPDATE_KIND_LABELS[u.kind]}
                </Text>
                <Text style={[styles.cardTitle, { color: palette.text }]}>{u.title}</Text>
              </View>
              <Text style={[styles.meta, { color: palette.muted }]}>
                {moment(u.createdAt).fromNow()}
              </Text>
            </View>
            {u.amountMinor != null ? (
              <Text style={[styles.amount, { color: palette.warning }]}>
                {formatNaira(u.amountMinor)}
              </Text>
            ) : null}
            {u.body ? (
              <Text style={[styles.body, { color: palette.textSecondary }]}>{u.body}</Text>
            ) : null}
            {u.postedByName ? (
              <Text style={[styles.meta, { color: palette.muted, marginTop: 6 }]}>
                by {u.postedByName}
              </Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  form: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  kindChipText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  err: { fontSize: typography.sizes.xs },
  filterRow: {
    marginBottom: spacing.md,
    paddingVertical: 2,
  },
  filterTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 4,
  },
  filterChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    lineHeight: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconTile: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginTop: 6,
  },
  body: {
    fontSize: typography.sizes.sm,
    marginTop: 6,
    lineHeight: 20,
  },
  meta: {
    fontSize: typography.sizes.xs,
  },
});

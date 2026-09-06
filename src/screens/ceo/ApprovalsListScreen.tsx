import { useEffect, useState } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { ApprovalStatus } from '@/src/types/project.types';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { usePendingDeclarations } from '@/src/hooks/profits/useProfitDeclarations';
import { formatNaira } from '@/src/utils/currency';
import { usePendingFundingRounds, useDecideFundingRound } from '@/src/hooks/fundingRounds/useFundingRounds';
import { formatUnits } from '@/src/utils/units';
import { Button } from '@/src/components/ui/Button';
import { relativeTime } from '@/src/utils/date';
import { listFillStyle, listScrollEnabled } from '@/src/constants/layout';

const PROJECT_SEGMENTS: { key: ApprovalStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

type Kind = 'projects' | 'declarations' | 'rounds';

export default function ApprovalsListScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [kind, setKind] = useState<Kind>('declarations');
  const [status, setStatus] = useState<ApprovalStatus>('PENDING');
  const [pendingCount, setPendingCount] = useState(0);

  const { data: projects, refetch: refetchProjects, isRefetching } = useFetchProjects({ status });
  const { data: declarations = [], isLoading: loadingDecl, refetch: refetchDecl } =
    usePendingDeclarations();
  const { data: rounds = [], isLoading: loadingRounds, refetch: refetchRounds } =
    usePendingFundingRounds();
  const decideRound = useDecideFundingRound();

  useEffect(() => {
    if (status === 'PENDING') {
      const derived = projects?.count ?? projects?.data?.length ?? 0;
      setPendingCount(derived);
    }
  }, [projects?.count, projects?.data?.length, status]);

  const kindSegments = [
    { key: 'declarations', label: `Declarations${declarations.length ? ` (${declarations.length})` : ''}` },
    { key: 'projects', label: `Projects${status === 'PENDING' && pendingCount ? ` (${pendingCount})` : ''}` },
    { key: 'rounds', label: `Raises${rounds.length ? ` (${rounds.length})` : ''}` },
  ];

  const projectSegments = PROJECT_SEGMENTS.map((s) => ({
    key: s.key,
    label: s.key === 'PENDING' ? `Pending (${pendingCount})` : s.label,
  }));

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Approvals</Text>
        <Ionicons name="filter-outline" size={20} color={palette.text} />
      </View>

      <SegmentedControl
        segments={kindSegments}
        activeKey={kind}
        onChange={(k) => setKind(k as Kind)}
      />
      <View style={{ height: spacing.sm }} />

      {kind === 'projects' ? (
        <>
          <SegmentedControl
            segments={projectSegments}
            activeKey={status}
            onChange={(k) => setStatus(k as ApprovalStatus)}
          />
          <FlatList
            style={listFillStyle}
            scrollEnabled={listScrollEnabled}
            data={projects?.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onRefresh={refetchProjects}
            refreshing={isRefetching}
            renderItem={({ item }) => (
              <ApprovalCard
                project={item}
                compact
                onPress={() => router.push(`/projects/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: palette.muted }]}>
                No {status.toLowerCase()} projects
              </Text>
            }
          />
        </>
      ) : kind === 'rounds' ? (
        <FlatList
          style={listFillStyle}
          scrollEnabled={listScrollEnabled}
          data={rounds}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchRounds}
          refreshing={loadingRounds}
          renderItem={({ item: r }) => (
            <View
              style={[
                styles.declRow,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <Text style={[styles.declLabel, { color: palette.text }]}>
                {formatUnits(r.additionalUnits)} additional units
              </Text>
              <Text style={[styles.declMeta, { color: palette.textSecondary }]}>
                {formatNaira(r.additionalMinor, false)} at {formatNaira(r.unitPriceMinor)} / unit
              </Text>
              <Text style={[styles.declMeta, { color: palette.textSecondary }]}>{r.reason}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button
                  title="Approve"
                  size="sm"
                  loading={decideRound.isPending}
                  onPress={() =>
                    void decideRound.mutateAsync({
                      roundId: r.id,
                      status: 'APPROVED',
                      projectId: r.projectId,
                    })
                  }
                />
                <Button
                  title="Reject"
                  size="sm"
                  variant="outlineDanger"
                  loading={decideRound.isPending}
                  onPress={() =>
                    void decideRound.mutateAsync({
                      roundId: r.id,
                      status: 'REJECTED',
                      projectId: r.projectId,
                    })
                  }
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                title="No pending raises"
                message="Line managers request additional units here. Approval mints them at the existing unit price."
              />
            </View>
          }
        />
      ) : (
        <FlatList
          style={listFillStyle}
          scrollEnabled={listScrollEnabled}
          data={declarations}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchDecl}
          refreshing={loadingDecl}
          renderItem={({ item: d }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/projects/[id]',
                  params: { id: d.projectId, tab: 'profits' },
                } as any)
              }
              style={[
                styles.declRow,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
              data-testid={`approval-decl-${d.reference}`}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.mono, { color: palette.primary }]}>{d.reference}</Text>
                {d.isFinal ? (
                  <View style={[styles.finalChip, { backgroundColor: palette.primaryLight }]}>
                    <Text
                      style={{
                        color: palette.primary,
                        fontSize: typography.sizes.xs,
                        fontWeight: '700',
                      }}
                    >
                      FINAL
                    </Text>
                  </View>
                ) : null}
              </View>
              {d.label ? (
                <Text style={[styles.declLabel, { color: palette.text }]}>{d.label}</Text>
              ) : null}
              <Text style={[styles.declMeta, { color: palette.textSecondary }]}>
                Gross {formatNaira(d.grossMinor)} · Net {formatNaira(d.netMinor)} · Investor pool{' '}
                {formatNaira(d.investorPoolMinor)}
              </Text>
              <Text style={[styles.declMeta, { color: palette.textSecondary }]}>
                {formatNaira(d.perUnitMinor)}/unit · Prism{' '}
                {(d.platformFeeBps / 100).toFixed(1)}% · declared {relativeTime(d.declaredAt)}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ marginTop: spacing.lg }}>
              <EmptyState
                title="No pending declarations"
                message="Profit declarations from Line Managers show up here for your review."
              />
            </View>
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  list: { paddingBottom: scrollBottomInset },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
  declRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  rowHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  mono: { fontFamily: 'monospace', fontWeight: '700', fontSize: typography.sizes.sm },
  finalChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
  declLabel: { fontSize: typography.sizes.md, fontWeight: '600' },
  declMeta: { fontSize: typography.sizes.xs },
});

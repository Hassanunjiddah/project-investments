import { useEffect, useState } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import moment from 'moment';
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

const PROJECT_SEGMENTS: { key: ApprovalStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

type Kind = 'projects' | 'declarations';

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

  useEffect(() => {
    if (status === 'PENDING') {
      const derived = projects?.count ?? projects?.data?.length ?? 0;
      setPendingCount(derived);
    }
  }, [projects?.count, projects?.data?.length, status]);

  const kindSegments = [
    { key: 'declarations', label: `Declarations${declarations.length ? ` (${declarations.length})` : ''}` },
    { key: 'projects', label: `Projects${status === 'PENDING' && pendingCount ? ` (${pendingCount})` : ''}` },
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
            data={projects?.data ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onRefresh={refetchProjects}
            refreshing={isRefetching}
            renderItem={({ item }) => (
              <ApprovalCard
                project={item}
                compact
                onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: palette.muted }]}>
                No {status.toLowerCase()} projects
              </Text>
            }
          />
        </>
      ) : (
        <FlatList
          data={declarations}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          onRefresh={refetchDecl}
          refreshing={loadingDecl}
          renderItem={({ item: d }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/projects/[id]',
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
                {(d.platformFeeBps / 100).toFixed(1)}% · declared {moment(d.declaredAt).fromNow()}
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

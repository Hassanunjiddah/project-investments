import { useEffect, useRef, useState } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { ApprovalStatus } from '@/db';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';

const SEGMENTS: { key: ApprovalStatus; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function ApprovalsListScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [status, setStatus] = useState<ApprovalStatus>('PENDING');
  const pendingCount = useRef(0);

  const { data: projects, refetch: refetchProjects, isRefetching } = useFetchProjects({ status });

  useEffect(() => {
    if (status === 'PENDING') {
      pendingCount.current = projects?.count ?? 0;
    }
  }, [projects?.count, status]);

  const segments = SEGMENTS.map((s) => ({
    key: s.key,
    label: s.key === 'PENDING' ? `Pending (${pendingCount.current})` : s.label,
  }));

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Approvals</Text>
        <Ionicons name="filter-outline" size={20} color={palette.text} />
      </View>

      <SegmentedControl
        segments={segments}
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
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});

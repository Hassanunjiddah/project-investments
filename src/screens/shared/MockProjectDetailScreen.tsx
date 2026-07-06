import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectHero } from '@/src/components/ceo/ProjectHero';
import { StageBadge } from '@/src/components/ui/StageBadge';
import { FinancialOverview } from '@/src/components/ceo/FinancialOverview';
import { KeyDetailsList } from '@/src/components/ui/KeyDetailsList';
import { TabBar } from '@/src/components/ui/TabBar';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useUiStore } from '@/src/store/useUiStore';
import { canApproveProjects } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { DOC_KIND_LABELS } from '@/db/types/document';

type Tab = 'overview' | 'documents' | 'risks' | 'timeline';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'risks', label: 'Risks' },
  { key: 'timeline', label: 'Timeline' },
];

export default function MockProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const [tab, setTab] = useState<Tab>('overview');
  const version = useMockDataStore((s) => s.version);
  const getProjectById = useMockDataStore((s) => s.getProjectById);
  const getDocumentsForProject = useMockDataStore((s) => s.getDocumentsForProject);
  const approveProject = useMockDataStore((s) => s.approveProject);
  const rejectProject = useMockDataStore((s) => s.rejectProject);
  const pushToast = useUiStore((s) => s.pushToast);

  void version;
  const project = getProjectById(id ?? '');
  const documents = getDocumentsForProject(id ?? '');

  if (!project) {
    return <EmptyState title="Project not found" message="This project does not exist in mock data." />;
  }

  const isApprovalMode = canApproveProjects(role) && project.approvalStatus === 'PENDING';

  return (
    <ScreenLayout>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: palette.text }]}>
          {isApprovalMode ? 'Project for Approval' : project.name}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={isApprovalMode ? styles.scrollPad : styles.scrollPad}
      >
        <ProjectHero
          imageUrl={project.coverImageUrl}
          height={160}
          badge={<StageBadge stage={project.stage} />}
        />
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: palette.text }]}>{project.name}</Text>
        </View>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>
          {project.sector} · By {project.creatorName}
        </Text>
        <Text style={[styles.meta, { color: palette.muted, marginBottom: spacing.md }]}>
          Requested: {project.createdAt}
        </Text>

        <FinancialOverview project={project} />

        <TabBar tabs={TABS} activeKey={tab} onChange={(k) => setTab(k as Tab)} />

        {tab === 'overview' && (
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Project Summary</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{project.summary}</Text>
            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: spacing.md }]}>
              Key Details
            </Text>
            <KeyDetailsList project={project} />
          </View>
        )}

        {tab === 'documents' && (
          <View>
            {documents.length === 0 ? (
              <Text style={[styles.body, { color: palette.muted }]}>No documents uploaded.</Text>
            ) : (
              documents.map((doc) => (
                <View
                  key={doc.id}
                  style={[styles.docRow, { borderColor: palette.border, backgroundColor: palette.surface }]}
                >
                  <Ionicons name="document-outline" size={16} color={palette.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docTitle, { color: palette.text }]}>{doc.title}</Text>
                    <Text style={[styles.docMeta, { color: palette.muted }]}>
                      {DOC_KIND_LABELS[doc.kind]} · {doc.fileName}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'risks' && (
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.risks}</Text>
        )}

        {tab === 'timeline' && (
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.timeline}</Text>
        )}
      </ScrollView>

      {isApprovalMode ? (
        <View style={[styles.footer, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
          <Button
            title="Reject Project"
            variant="outlineDanger"
            onPress={() => {
              rejectProject(project.id);
              pushToast({ type: 'success', message: 'Project rejected' });
              router.back();
            }}
            style={styles.footerBtn}
          />
          <Button
            title="Approve Project"
            onPress={() => {
              approveProject(project.id);
              pushToast({ type: 'success', message: 'Project approved' });
              router.back();
            }}
            style={styles.footerBtn}
          />
        </View>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  backBtn: { width: 32, padding: 4 },
  topTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
    textAlign: 'center',
  },
  scrollPad: { paddingBottom: 90 },
  titleRow: { marginBottom: spacing.xs },
  name: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  meta: { fontSize: typography.sizes.xs, marginBottom: 2 },
  sectionTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, marginBottom: spacing.sm },
  body: { fontSize: typography.sizes.sm, lineHeight: 20 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  docTitle: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  docMeta: { fontSize: 10, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  footerBtn: { flex: 1 },
});

import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFetchProjectById } from '@/src/hooks/projects/useFetchProjectById';
import { useDecideProject } from '@/src/hooks/projects/useDecideProject';
import { useFetchDocumentsForProject } from '@/src/hooks/documents/useFetchDocumentsForProject';
import { useUploadDocument } from '@/src/hooks/documents/useUploadDocument';
import { useDeleteDocument } from '@/src/hooks/documents/useDeleteDocument';
import { useFetchInvitesForProject } from '@/src/hooks/invitations/useFetchInvitesForProject';
import { useCreateInvite } from '@/src/hooks/invitations/useCreateInvite';
import { useConfirmInvitePayment } from '@/src/hooks/invitations/useConfirmInvitePayment';
import { useDeclineInvite } from '@/src/hooks/invitations/useDeclineInvite';
import { useFetchInvestors } from '@/src/hooks/profile/useFetchInvestors';
import { useSession } from '@/src/hooks/auth/useSession';
import { useAuthStore } from '@/src/store/useAuthStore';
import { inviteInvestorSchema, type InviteInvestorFormValues } from '@/src/schemas/project.schema';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSelect } from '@/src/components/form/FormSelect';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { projectedProfitKobo } from '@/src/utils/profit';
import { getDocumentSignedUrl } from '@/src/services/documents.services';
import { getPaymentProofSignedUrl } from '@/src/services/edgeFunctions.services';
import { ALLOWED_MIME_TYPES, formatFileSize } from '@/src/utils/files';
import { PROJECT_STAGE_LABELS, APPROVAL_STATUS_LABELS } from '@/src/types/project.types';
import { DOC_KIND_LABELS } from '@/src/types/document.types';
import { INVITE_STATUS_LABELS } from '@/src/types/invitation.types';
import { canApproveProjects, canManageProjects, canCreateProject } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Tab = 'overview' | 'documentation' | 'investors';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const { user } = useSession();
  const pushToast = useUiStore((s) => s.pushToast);
  const [tab, setTab] = useState<Tab>('overview');

  const {
    data: project,
    isLoading,
    isError,
    error,
    refetch: refetchProject,
    isRefetching,
  } = useFetchProjectById(id ?? '');

  const decideProject = useDecideProject(id ?? '');
  const { data: documents, refetch: refetchDocs } = useFetchDocumentsForProject(id ?? '');
  const uploadDocument = useUploadDocument(id ?? '');
  const deleteDocument = useDeleteDocument(id ?? '');
  const { data: invites, refetch: refetchInvites } = useFetchInvitesForProject(id ?? '');
  const createInvite = useCreateInvite(id ?? '');
  const confirmPayment = useConfirmInvitePayment(id ?? '');
  const declineInvite = useDeclineInvite(id ?? '');
  const { data: investors } = useFetchInvestors(canManageProjects(role));

  const inviteMethods = useForm<InviteInvestorFormValues>({
    resolver: zodResolver(inviteInvestorSchema) as Resolver<InviteInvestorFormValues>,
    defaultValues: { investorId: '', amountNaira: 0 },
  });

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load project"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetchProject()}
      />
    );
  }

  if (!project) return <EmptyState title="Project not found" />;

  const isOwner = user?.id === project.createdBy;
  const canEdit = isOwner && project.approvalStatus !== 'APPROVED';
  const showApprove = canApproveProjects(role) && project.approvalStatus === 'PENDING';
  const showInvite = canManageProjects(role) && project.approvalStatus === 'APPROVED';

  const handleRefresh = () => {
    refetchProject();
    refetchDocs();
    refetchInvites();
  };

  const handleApprove = async (status: 'APPROVED' | 'REJECTED') => {
    try {
      await decideProject.mutateAsync(status);
      pushToast({
        type: 'success',
        message: status === 'APPROVED' ? 'Project approved.' : 'Project rejected.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      });
    }
  };

  const handleViewProof = async (storagePath: string) => {
    try {
      const url = await getPaymentProofSignedUrl(storagePath);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open proof',
      });
    }
  };

  const handleOpenDocument = async (storagePath: string) => {
    try {
      const url = await getDocumentSignedUrl(storagePath);
      await WebBrowser.openBrowserAsync(url);
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open document',
      });
    }
  };

  const handleAddDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0] || !user?.id) return;

    const asset = result.assets[0];
    try {
      await uploadDocument.mutateAsync({
        userId: user.id,
        uri: asset.uri,
        fileName: asset.name ?? 'document',
        mimeType: asset.mimeType ?? 'application/octet-stream',
        sizeBytes: asset.size ?? 0,
        kind: 'OVERVIEW',
        title: asset.name?.replace(/\.[^.]+$/, '') ?? 'Document',
      });
      pushToast({ type: 'success', message: 'Document uploaded.' });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  };

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    try {
      await deleteDocument.mutateAsync({ docId, storagePath });
      pushToast({ type: 'success', message: 'Document removed.' });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  };

  const handleInvite = inviteMethods.handleSubmit(async (values) => {
    const amountKobo = nairaToKobo(values.amountNaira);
    const profit = projectedProfitKobo(project, amountKobo);
    try {
      await createInvite.mutateAsync({
        investorId: values.investorId,
        amountKobo,
        projectedProfitKobo: profit,
      });
      inviteMethods.reset();
      pushToast({ type: 'success', message: 'Investor invited.' });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invite failed',
      });
    }
  });

  const investorOptions =
    investors?.map((inv) => ({
      label: `${inv.fullName} (${inv.email})`,
      value: inv.id,
    })) ?? [];

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={{ padding: 10 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Text style={[styles.heading, { color: palette.text }]}>{project.name}</Text>

        <View style={styles.tabBar}>
          {(['overview', 'documentation', 'investors'] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.tab,
                {
                  backgroundColor: tab === t ? palette.primaryLight : palette.surface,
                  borderColor: tab === t ? palette.primary : palette.border,
                },
              ]}
              onPress={() => setTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t ? palette.primary : palette.textSecondary },
                ]}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' ? (
          <Card>
            <View style={styles.badges}>
              <Badge label={PROJECT_STAGE_LABELS[project.stage]} />
              <Badge
                label={APPROVAL_STATUS_LABELS[project.approvalStatus]}
                variant={project.approvalStatus === 'APPROVED' ? 'success' : 'warning'}
              />
            </View>
            <DetailRow label="Sector" value={project.sector} />
            <DetailRow label="Location" value={project.location} />
            <DetailRow label="Target" value={formatNaira(project.targetKobo)} />
            <DetailRow label="Raised" value={formatNaira(project.raisedKobo)} />
            <DetailRow label="Investor share" value={`${project.profitSplitInvestorBps / 100}%`} />
            <DetailRow label="Exit notice" value={`${project.exitNoticeDays} days`} />
            <DetailRow label="Early exit penalty" value={`${project.earlyExitPenaltyBps / 100}%`} />
            {project.summary ? <TextBlock label="Summary" value={project.summary} /> : null}
            {project.risks ? <TextBlock label="Risks" value={project.risks} /> : null}
            {project.timeline ? <TextBlock label="Timeline" value={project.timeline} /> : null}
            {project.fullDetails ? (
              <TextBlock label="Full details" value={project.fullDetails} />
            ) : null}
          </Card>
        ) : null}

        {tab === 'documentation' ? (
          <View style={styles.section}>
            {(isOwner || role === 'ADMIN') && canCreateProject(role) ? (
              <Button
                title="Add document"
                variant="secondary"
                onPress={handleAddDocument}
                loading={uploadDocument.isPending}
                style={styles.sectionButton}
              />
            ) : null}
            {(documents ?? []).length === 0 ? (
              <EmptyState
                title="No documents"
                message="Upload supporting files for this project."
              />
            ) : (
              (documents ?? []).map((doc) => (
                <Card key={doc.id} onPress={() => handleOpenDocument(doc.storagePath)}>
                  <View style={styles.docHeader}>
                    <Text style={[styles.docTitle, { color: palette.text }]}>{doc.title}</Text>
                    <Badge label={DOC_KIND_LABELS[doc.kind]} variant="accent" />
                  </View>
                  <Text style={[styles.docMeta, { color: palette.textSecondary }]}>
                    {doc.fileName}
                    {doc.fileSizeBytes ? ` · ${formatFileSize(doc.fileSizeBytes)}` : ''}
                  </Text>
                  {doc.amountKobo ? (
                    <Text style={[styles.docMeta, { color: palette.primary }]}>
                      {formatNaira(doc.amountKobo)}
                    </Text>
                  ) : null}
                  {isOwner && project.approvalStatus !== 'APPROVED' ? (
                    <Button
                      title="Delete"
                      variant="danger"
                      onPress={() => handleDeleteDocument(doc.id, doc.storagePath)}
                      loading={deleteDocument.isPending}
                      style={styles.deleteButton}
                    />
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}

        {tab === 'investors' ? (
          <View style={styles.section}>
            {showInvite ? (
              <Card>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Invite investor</Text>
                <FormProvider {...inviteMethods}>
                  <View style={styles.form}>
                    <FormSelect name="investorId" label="Investor" options={investorOptions} />
                    <FormInput
                      name="amountNaira"
                      label="Investment amount (₦)"
                      keyboardType="decimal-pad"
                    />
                    <FormSubmitButton title="Send invite" onPress={handleInvite} />
                  </View>
                </FormProvider>
              </Card>
            ) : null}

            {(invites ?? []).length === 0 ? (
              <EmptyState title="No invites" message="Invited investors will appear here." />
            ) : (
              (invites ?? []).map((invite) => (
                <Card key={invite.id}>
                  <View style={styles.inviteHeader}>
                    <Text style={[styles.inviteName, { color: palette.text }]}>
                      {invite.investorName ?? invite.investorId}
                    </Text>
                    <Badge label={INVITE_STATUS_LABELS[invite.status]} variant="accent" />
                  </View>
                  <Text style={[styles.inviteMeta, { color: palette.textSecondary }]}>
                    Amount: {formatNaira(invite.amountKobo)}
                  </Text>
                  <Text style={[styles.inviteMeta, { color: palette.primary }]}>
                    Projected profit: {formatNaira(invite.projectedProfitKobo)}
                  </Text>
                  {invite.proofFileName ? (
                    <Text style={[styles.inviteMeta, { color: palette.textSecondary }]}>
                      Proof: {invite.proofFileName}
                    </Text>
                  ) : null}
                  {invite.proofStoragePath ? (
                    <Button
                      title="View proof"
                      variant="secondary"
                      onPress={() => handleViewProof(invite.proofStoragePath!)}
                      style={styles.proofButton}
                    />
                  ) : null}
                  {showInvite && invite.status === 'PROOF_SUBMITTED' ? (
                    <View style={styles.inviteActions}>
                      <Button
                        title="Confirm payment"
                        onPress={() => confirmPayment.mutateAsync(invite.id)}
                        loading={confirmPayment.isPending}
                      />
                      <Button
                        title="Decline"
                        variant="danger"
                        onPress={() => declineInvite.mutateAsync(invite.id)}
                        loading={declineInvite.isPending}
                      />
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.actions}>
          {showApprove ? (
            <>
              <Button
                title="Approve"
                onPress={() => handleApprove('APPROVED')}
                loading={decideProject.isPending}
              />
              <Button
                title="Reject"
                variant="danger"
                onPress={() => handleApprove('REJECTED')}
                loading={decideProject.isPending}
              />
            </>
          ) : null}
          {canEdit ? (
            <Button
              title="Edit project"
              variant="secondary"
              onPress={() => router.push(`/(tabs)/projects/${project.id}/edit`)}
            />
          ) : null}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <View style={styles.textBlock}>
      <Text style={[styles.blockLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.blockValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontSize: typography.sizes.sm,
  },
  rowValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  textBlock: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  blockLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  blockValue: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionButton: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  form: {
    gap: spacing.md,
  },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  docTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  docMeta: {
    fontSize: typography.sizes.sm,
  },
  deleteButton: {
    marginTop: spacing.sm,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  inviteName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  inviteMeta: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.xs,
  },
  inviteActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  proofButton: {
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
});

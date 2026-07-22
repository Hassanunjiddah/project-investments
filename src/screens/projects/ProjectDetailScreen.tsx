import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as DocumentPicker from 'expo-document-picker';

import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectHero } from '@/src/components/ceo/ProjectHero';
import { StageBadge } from '@/src/components/ui/StageBadge';
import { FinancialOverview } from '@/src/components/ceo/FinancialOverview';
import { KeyDetailsList } from '@/src/components/ui/KeyDetailsList';
import { TabBar } from '@/src/components/ui/TabBar';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { TextInput } from '@/src/components/ui/TextInput';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import { ProjectProfitsTab } from '@/src/components/projects/ProjectProfitsTab';
import { InvestorFinancialsCard } from '@/src/components/projects/InvestorFinancialsCard';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useUiStore } from '@/src/store/useUiStore';
import { canApproveProjects, canManageProjects, isInvestor } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { DOC_KIND_LABELS } from '@/db/types/document';
import { useFetchProjectById } from '@/src/hooks/projects/useFetchProjectById';
import { useFetchDocumentsForProject } from '@/src/hooks/documents/useFetchDocumentsForProject';
import { useDecideProject } from '@/src/hooks/projects/useDecideProject';
import { useFetchInvitesForProject } from '@/src/hooks/invitations/useFetchInvitesForProject';
import { useFetchInvitation } from '@/src/hooks/invitations/useFetchInvitation';
import { useGetInvitationDetail } from '@/src/hooks/invitations/useGetInvitationDetail';
import { useCreateInvite } from '@/src/hooks/invitations/useCreateInvite';
import { useAcceptInvite } from '@/src/hooks/invitations/useAcceptInvite';
import { useDeclineInvite } from '@/src/hooks/invitations/useDeclineInvite';
import { useCommitInvestment } from '@/src/hooks/invitations/useCommitInvestment';
import { useSubmitPaymentProof } from '@/src/hooks/invitations/useSubmitPaymentProof';
import { useConfirmInvitePayment } from '@/src/hooks/invitations/useConfirmInvitePayment';
import { finalizeProjectIfDue } from '@/src/services/profits.services';
import { useProjectProfitMeta } from '@/src/hooks/profits/useProfits';
import { ProjectActivityTab } from '@/src/components/projects/ProjectActivityTab';
import { ProjectDocumentsTab } from '@/src/components/projects/ProjectDocumentsTab';
import { inviteInvestorSchema, type InviteInvestorFormValues } from '@/src/schemas/project.schema';
import {
  INVITE_STATUS_LABELS,
  INVESTED_INVITE_STATUSES,
  type InviteStatus,
} from '@/src/types/invitation.types';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import moment from 'moment';

type Tab = 'overview' | 'documents' | 'risks' | 'timeline' | 'investors' | 'payment' | 'profits' | 'financials' | 'activity';

const PROOF_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const PAYMENT_TAB_STATUSES: InviteStatus[] = ['ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED'];
const LOCKED_TABS_BEFORE_CONFIRMED = ['documents', 'risks', 'timeline'];

export default function ProjectDetailScreen() {
  const { id, invite: inviteParam } = useLocalSearchParams<{ id: string; invite?: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isInvestorRole = isInvestor(role);
  const [tab, setTab] = useState<Tab>('overview');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [commitAmount, setCommitAmount] = useState('');
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    return () => {
      useUiStore.setState({ tabBarVisible: true });
    };
  }, []);

  const projectId = id ?? '';

  // Lazily finalize the project if its timeline has elapsed (idempotent, safe on every load).
  useEffect(() => {
    if (projectId) {
      finalizeProjectIfDue(projectId).catch(() => {});
    }
  }, [projectId]);

  const inviteLookup = useMemo(() => {
    if (inviteParam) return { inviteId: inviteParam };
    if (isInvestorRole && user?.id && projectId) {
      return { userId: user.id, projectId };
    }
    return null;
  }, [inviteParam, isInvestorRole, user?.id, projectId]);

  const {
    data: invite,
    isLoading: inviteLoading,
    refetch: refetchInvite,
  } = useFetchInvitation(inviteLookup);

  const resolvedInviteId = invite?.id ?? inviteParam ?? '';
  const inviteStatus = invite?.status;

  const needsPayDetail =
    isInvestorRole &&
    !!resolvedInviteId &&
    !!inviteStatus &&
    (PAYMENT_TAB_STATUSES.includes(inviteStatus) || inviteStatus === 'CONFIRMED');

  const { data: invitationDetail, refetch: refetchDetail } = useGetInvitationDetail(
    needsPayDetail ? resolvedInviteId : '',
  );

  const {
    data: project,
    isLoading,
    refetch: refetchProject,
    isRefetching,
  } = useFetchProjectById(projectId);

  const { data: documents = [], refetch: refetchDocs } = useFetchDocumentsForProject(projectId);
  const { data: profitMeta } = useProjectProfitMeta(projectId);
  const { mutate: decideProject } = useDecideProject(projectId);
  const {
    data: invites = [],
    refetch: refetchInvites,
    isLoading: invitesLoading,
  } = useFetchInvitesForProject(isInvestorRole ? '' : projectId);
  const createInvite = useCreateInvite(projectId);
  const acceptInvite = useAcceptInvite();
  const declineInvite = useDeclineInvite(projectId);
  const commitInvestment = useCommitInvestment();
  const submitProof = useSubmitPaymentProof();
  const confirmPayment = useConfirmInvitePayment(projectId);

  const inviteMethods = useForm<InviteInvestorFormValues>({
    resolver: zodResolver(inviteInvestorSchema) as Resolver<InviteInvestorFormValues>,
    defaultValues: { email: '', maxAmountNaira: '' as unknown as number },
  });

  const canInvite = canManageProjects(role) && project?.approvalStatus === 'APPROVED';
  const unlocked = !isInvestorRole || inviteStatus === 'CONFIRMED';
  const showPaymentTab =
    isInvestorRole && !!inviteStatus && PAYMENT_TAB_STATUSES.includes(inviteStatus);

  useEffect(() => {
    if (tab === 'payment' && !showPaymentTab) {
      setTab('overview');
    }
  }, [tab, showPaymentTab]);

  const investableMax = useMemo(() => {
    if (!project || !invite) return undefined;
    const remaining = Math.max(0, project.targetMinor - project.raisedMinor);
    if (invite.maxInvestmentAmountMinor != null) {
      return Math.min(invite.maxInvestmentAmountMinor, remaining);
    }
    return remaining;
  }, [project, invite]);

  const TABS = useMemo(() => {
    const base = [
      { key: 'overview', label: 'Overview' },
      { key: 'documents', label: 'Documents' },
      { key: 'risks', label: 'Risks' },
      { key: 'timeline', label: 'Timeline' },
    ];
    if (showPaymentTab) {
      base.splice(1, 0, { key: 'payment', label: 'Payment' });
    }
    // Investor: after CONFIRMED, show Activity + Financials tabs
    if (isInvestorRole && inviteStatus === 'CONFIRMED') {
      base.push({ key: 'activity', label: 'Activity' });
      base.push({ key: 'financials', label: 'Financials' });
    }
    if (!isInvestorRole) {
      base.push({ key: 'investors', label: 'Investors' });
      // LM/CEO: Activity + Profits tabs visible once the project has been approved
      if (project?.approvalStatus === 'APPROVED') {
        base.push({ key: 'activity', label: 'Activity' });
        base.push({ key: 'profits', label: 'Profits' });
      }
    }
    return base;
  }, [isInvestorRole, showPaymentTab, inviteStatus, project?.approvalStatus]);

  const disabledTabs =
    isInvestorRole && !unlocked ? LOCKED_TABS_BEFORE_CONFIRMED : ([] as string[]);

  const handleApprove = () => {
    decideProject({ status: 'APPROVED' });
    pushToast({ type: 'success', message: 'Project approved' });
    router.back();
  };
  const handleReject = () => {
    decideProject({ status: 'REJECTED' });
    pushToast({ type: 'success', message: 'Project rejected' });
    router.back();
  };

  const handleInvite = inviteMethods.handleSubmit(async (values) => {
    try {
      const maxMinor =
        values.maxAmountNaira != null && values.maxAmountNaira > 0
          ? nairaToKobo(values.maxAmountNaira)
          : undefined;
      const result = await createInvite.mutateAsync({
        email: values.email.trim().toLowerCase(),
        maxInvestmentAmountMinor: maxMinor,
      });
      inviteMethods.reset({ email: '', maxAmountNaira: '' as unknown as number });
      setShowInviteForm(false);

      if (result.emailSent) {
        pushToast({
          type: 'success',
          message: `Invitation email sent to ${values.email.trim().toLowerCase()}.`,
        });
      } else if (result.signinCode) {
        // Email delivery failed — LM must share the code manually.
        Alert.alert(
          'Invitation created — email not delivered',
          `We couldn't send the email (${result.emailError ?? 'unknown reason'}).\n\nShare this 8-character code with the investor:\n\n${result.signinCode}\n\nThey enter it on the First-time sign-in screen along with their email.`,
        );
      } else {
        pushToast({ type: 'success', message: 'Investor invited.' });
      }
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Invite failed',
      });
    }
  });

  const refreshInvestor = async () => {
    await Promise.all([refetchInvite(), refetchDetail(), refetchProject()]);
  };

  const handleRefresh = () => {
    refetchProject();
    refetchDocs();
    if (!isInvestorRole) refetchInvites();
    if (isInvestorRole) {
      refetchInvite();
      refetchDetail();
    }
  };

  const onTabPress = (key: string) => {
    if (disabledTabs.includes(key)) {
      pushToast({
        type: 'error',
        message: 'Full project details unlock after your payment is confirmed.',
      });
      return;
    }
    setTab(key as Tab);
  };

  const handleAccept = async () => {
    if (!invite) return;
    try {
      await acceptInvite.mutateAsync(invite.id);
      pushToast({ type: 'success', message: 'Terms accepted.' });
      await refreshInvestor();
      setTab('payment');
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Accept failed',
      });
    }
  };

  const handleDecline = async () => {
    if (!invite) return;
    try {
      await declineInvite.mutateAsync(invite.id);
      pushToast({ type: 'success', message: 'Invitation declined.' });
      router.back();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Decline failed',
      });
    }
  };

  const handleCommit = async () => {
    if (!invite || investableMax == null) return;
    const naira =
      parseFloat(commitAmount) ||
      (invite.maxInvestmentAmountMinor != null
        ? invite.maxInvestmentAmountMinor / 100
        : investableMax / 100);
    const amountMinor = nairaToKobo(naira);
    if (amountMinor <= 0 || amountMinor > investableMax) {
      pushToast({
        type: 'error',
        message: `Enter an amount up to ${formatNaira(investableMax)}.`,
      });
      return;
    }
    try {
      await commitInvestment.mutateAsync({ inviteId: invite.id, amountMinor });
      pushToast({ type: 'success', message: 'Investment committed.' });
      setCommitAmount('');
      await refreshInvestor();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Commit failed',
      });
    }
  };

  const handleUploadProof = async () => {
    if (!invite) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: PROOF_MIME,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    try {
      await submitProof.mutateAsync({
        inviteId: invite.id,
        uri: asset.uri,
        fileName: asset.name ?? 'proof',
        mimeType: asset.mimeType ?? 'application/pdf',
        // On web, expo-document-picker exposes the real File; pass it through so
        // FormData produces a valid multipart body.
        file: (asset as unknown as { file?: File }).file,
      });
      pushToast({ type: 'success', message: 'Payment proof submitted.' });
      await refreshInvestor();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  };

  const handleConfirmPayment = async (inviteId: string) => {
    try {
      await confirmPayment.mutateAsync(inviteId);
      pushToast({ type: 'success', message: 'Payment confirmed.' });
      refetchInvites();
      refetchProject();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Confirm failed',
      });
    }
  };

  const handleManagerDecline = async (inviteId: string) => {
    try {
      await declineInvite.mutateAsync(inviteId);
      pushToast({ type: 'success', message: 'Invitation declined.' });
      refetchInvites();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Decline failed',
      });
    }
  };

  if (isInvestorRole && inviteLookup && inviteLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (isInvestorRole && (!invite || invite.status === 'DECLINED')) {
    return (
      <EmptyState title="Invite not found" message="You are not authorized to view this project." />
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: palette.text }}>Loading project...</Text>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!project) {
    return <EmptyState title="Project not found" message="This project does not exist." />;
  }

  const isApprovalMode = canApproveProjects(role) && project.approvalStatus === 'PENDING';
  const payAccount = invitationDetail?.payAccount;
  const showInvestorFooter = isInvestorRole && inviteStatus === 'INVITED';

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
        contentContainerStyle={[
          styles.scrollPad,
          (isApprovalMode || showInvestorFooter) && { paddingBottom: 110 },
        ]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <ProjectHero
          imageUrl={project.bannerUrl ?? ''}
          height={160}
          badge={<StageBadge stage={project.stage} />}
        />
        <View style={styles.titleRow}>
          <Text style={[styles.name, { color: palette.text }]}>{project.name}</Text>
          {project.code ? (
            <Text style={[styles.codeChip, { color: palette.muted, borderColor: palette.border }]}>
              {project.code}
            </Text>
          ) : null}
          {isInvestorRole && inviteStatus ? (
            <Badge label={INVITE_STATUS_LABELS[inviteStatus]} variant="accent" />
          ) : null}
        </View>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>
          {project.sector}
          {!isInvestorRole ? ` · By ${project.createdBy?.full_name}` : ''}
        </Text>
        {!isInvestorRole && (
          <Text style={[styles.meta, { color: palette.muted, marginBottom: spacing.md }]}>
            Requested: {moment(project.submittedAt).calendar()}
          </Text>
        )}

        <FinancialOverview
          project={project}
          mode={isInvestorRole && inviteStatus !== 'CONFIRMED' ? 'investor' : 'manager'}
          investableMaxMinor={
            isInvestorRole && invite?.maxInvestmentAmountMinor != null ? investableMax : undefined
          }
        />

        <TabBar tabs={TABS} activeKey={tab} onChange={onTabPress} disabledKeys={disabledTabs} />

        {tab === 'overview' && (
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Project Summary</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{project.summary}</Text>
            <Text style={[styles.sectionTitle, { color: palette.text, marginTop: spacing.md }]}>
              Key Details
            </Text>
            <KeyDetailsList project={project} />
            {inviteStatus === 'CONFIRMED' && invite?.amountMinor != null ? (
              <Text style={[styles.body, { color: palette.primary, marginTop: spacing.md }]}>
                Your confirmed investment: {formatNaira(invite.amountMinor)}
              </Text>
            ) : null}
          </View>
        )}

        {tab === 'payment' && invite && (
          <View>
            {inviteStatus === 'ACCEPTED' ? (
              <View style={styles.paymentBlock}>
                <TextInput
                  label="Commit amount (₦)"
                  value={commitAmount || (investableMax != null ? String(investableMax / 100) : '')}
                  onChangeText={setCommitAmount}
                  keyboardType="decimal-pad"
                />
                {investableMax != null ? (
                  <Text style={[styles.helper, { color: palette.textSecondary }]}>
                    Maximum allowed: {formatNaira(investableMax)}
                  </Text>
                ) : null}
                <Button
                  title="Commit investment"
                  onPress={handleCommit}
                  loading={commitInvestment.isPending}
                />
              </View>
            ) : null}

            {payAccount && (inviteStatus === 'COMMITTED' || inviteStatus === 'PROOF_SUBMITTED') ? (
              <View style={styles.paymentBlock}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Escrow bank details
                </Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  Bank: {payAccount.bankName}
                </Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  Account name: {payAccount.accountName}
                </Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  Account number: {payAccount.accountNumber}
                </Text>
              </View>
            ) : null}

            {inviteStatus === 'COMMITTED' ? (
              <View style={styles.paymentBlock}>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  Transfer funds to the account above, then attach your proof of payment.
                </Text>
                <Button
                  title="Attach proof (PDF or image)"
                  onPress={handleUploadProof}
                  loading={submitProof.isPending}
                />
              </View>
            ) : null}

            {inviteStatus === 'PROOF_SUBMITTED' ? (
              <View style={styles.paymentBlock}>
                <Text style={[styles.body, { color: palette.primary }]}>
                  {invite.proofFileName
                    ? `Proof submitted: ${invite.proofFileName}`
                    : 'Payment proof submitted.'}
                </Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  Awaiting manager confirmation.
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {tab === 'documents' && unlocked && (
          <ProjectDocumentsTab
            projectId={project.id}
            canUpload={canManageProjects(role) && project.createdBy?.id === user?.id}
            userId={user?.id}
          />
        )}

        {tab === 'activity' &&
          ((!isInvestorRole && project.approvalStatus === 'APPROVED') ||
            (isInvestorRole && inviteStatus === 'CONFIRMED')) && (
            <ProjectActivityTab
              projectId={project.id}
              canPost={
                !isInvestorRole &&
                canManageProjects(role) &&
                project.createdBy?.id === user?.id
              }
            />
          )}

        {tab === 'risks' && unlocked && (
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.risks}</Text>
        )}

        {tab === 'timeline' && unlocked && (
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.timeline}</Text>
        )}

        {tab === 'investors' && !isInvestorRole && (
          <View>
            <View style={styles.investorsHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0 }]}>
                Investors
              </Text>
              {canInvite ? (
                <Button
                  title={showInviteForm ? 'Cancel' : 'Invite Investor'}
                  size="sm"
                  variant={showInviteForm ? 'outline' : 'primary'}
                  onPress={() => setShowInviteForm((v) => !v)}
                />
              ) : null}
            </View>

            {showInviteForm && canInvite ? (
              <View
                style={[
                  styles.inviteForm,
                  { borderColor: palette.border, backgroundColor: palette.surface },
                ]}
              >
                <FormProvider {...inviteMethods}>
                  <FormInput
                    name="email"
                    label="Investor email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="investor@example.com"
                  />
                  <FormInput
                    name="maxAmountNaira"
                    label="Max investment (₦) — optional"
                    keyboardType="decimal-pad"
                    placeholder="Leave blank for no limit"
                  />
                  <FormSubmitButton title="Send invite" onPress={handleInvite} />
                </FormProvider>
              </View>
            ) : null}

            {invitesLoading ? (
              <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.md }} />
            ) : invites.length === 0 ? (
              <Text style={[styles.body, { color: palette.muted, marginTop: spacing.sm }]}>
                No investors invited yet.
              </Text>
            ) : (
              invites.map((row) => {
                const invested = INVESTED_INVITE_STATUSES.includes(row.status);
                return (
                  <View
                    key={row.id}
                    style={[
                      styles.inviteRow,
                      { borderColor: palette.border, backgroundColor: palette.surface },
                    ]}
                  >
                    <View style={styles.inviteRowTop}>
                      <Text style={[styles.inviteName, { color: palette.text }]}>
                        {row.investorName || row.email || row.investorId}
                      </Text>
                      <Badge label={INVITE_STATUS_LABELS[row.status]} variant="accent" />
                    </View>
                    {row.email && row.investorName ? (
                      <Text style={[styles.inviteMeta, { color: palette.muted }]}>{row.email}</Text>
                    ) : null}
                    {invested && row.amountMinor != null ? (
                      <Text style={[styles.inviteAmount, { color: palette.text }]}>
                        Invested: {formatNaira(row.amountMinor)}
                      </Text>
                    ) : row.maxInvestmentAmountMinor != null ? (
                      <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                        Max: {formatNaira(row.maxInvestmentAmountMinor)}
                      </Text>
                    ) : null}
                    {row.status === 'PROOF_SUBMITTED' && canManageProjects(role) ? (
                      <View style={styles.inviteActions}>
                        <Button
                          title="Decline"
                          size="sm"
                          variant="outlineDanger"
                          onPress={() => handleManagerDecline(row.id)}
                          style={{ flex: 1 }}
                        />
                        <Button
                          title="Confirm payment"
                          size="sm"
                          onPress={() => handleConfirmPayment(row.id)}
                          loading={confirmPayment.isPending}
                          style={{ flex: 1 }}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        )}
        {tab === 'profits' && !isInvestorRole && project.approvalStatus === 'APPROVED' && (
          <ProjectProfitsTab
            projectId={project.id}
            projectStage={project.stage}
            canPost={canManageProjects(role) && project.createdBy?.id === user?.id}
            realisedProfitKobo={profitMeta?.realisedProfitMinor ?? 0}
            managerShareBps={10000 - project.profitSplitInvestorBps}
            investorShareBps={project.profitSplitInvestorBps}
            onPosted={() => refetchProject()}
          />
        )}

        {tab === 'financials' && isInvestorRole && inviteStatus === 'CONFIRMED' && invite && (
          <InvestorFinancialsCard
            projectId={project.id}
            projectName={project.name}
            projectStage={project.stage}
            inviteId={invite.id}
            capitalMinor={invite.amountMinor ?? 0}
            projectedProfitMinor={invite.projectedProfitMinor ?? 0}
            projectRealisedProfitMinor={profitMeta?.realisedProfitMinor ?? 0}
            profitSplitInvestorBps={project.profitSplitInvestorBps}
            projectRaisedMinor={project.raisedMinor}
            projectTargetMinor={project.targetMinor}
          />
        )}
      </ScrollView>

      {isApprovalMode ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: palette.surface, borderTopColor: palette.border },
          ]}
        >
          <Button
            title="Reject Project"
            variant="outlineDanger"
            onPress={handleReject}
            style={styles.footerBtn}
          />
          <Button title="Approve Project" onPress={handleApprove} style={styles.footerBtn} />
        </View>
      ) : null}

      {showInvestorFooter ? (
        <View
          style={[
            styles.footer,
            { backgroundColor: palette.surface, borderTopColor: palette.border },
          ]}
        >
          <Button
            title="Decline"
            variant="outlineDanger"
            onPress={handleDecline}
            loading={declineInvite.isPending}
            style={styles.footerBtn}
          />
          <Button
            title="Accept terms"
            onPress={handleAccept}
            loading={acceptInvite.isPending}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, flex: 1 },
  codeChip: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    letterSpacing: 0.5,
  },
  meta: { fontSize: typography.sizes.xs, marginBottom: 2 },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  body: { fontSize: typography.sizes.sm, lineHeight: 20 },
  helper: { fontSize: typography.sizes.xs, marginBottom: spacing.sm },
  paymentBlock: { marginBottom: spacing.lg, gap: spacing.sm },
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
  investorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  inviteForm: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inviteRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  inviteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inviteName: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  inviteMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  inviteAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: 6,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

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
  Platform,
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
import { UnitSpectrumBar } from '@/src/components/projects/UnitSpectrumBar';
import { KeyDetailsList } from '@/src/components/ui/KeyDetailsList';
import { TabBar } from '@/src/components/ui/TabBar';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { TextInput } from '@/src/components/ui/TextInput';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import { ProjectProfitsTab } from '@/src/components/projects/ProjectProfitsTab';
import { ProjectAuditTab } from '@/src/components/projects/ProjectAuditTab';
import { ProjectReconciliationTab } from '@/src/components/projects/ProjectReconciliationTab';
import { ProjectLedgerTab } from '@/src/components/projects/ProjectLedgerTab';
import { ProjectContextPanel, useProjectSplitLayout } from '@/src/components/projects/ProjectContextPanel';
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
import { usePledgeUnits } from '@/src/hooks/invitations/usePledgeUnits';
import { useSubmitPaymentProof } from '@/src/hooks/invitations/useSubmitPaymentProof';
import { useConfirmInvitePayment } from '@/src/hooks/invitations/useConfirmInvitePayment';
import { finalizeProjectIfDue } from '@/src/services/profits.services';
import { supabase } from '@/src/services/supabase';
import { useProjectProfitMeta } from '@/src/hooks/profits/useProfits';
import { ProjectActivityTab } from '@/src/components/projects/ProjectActivityTab';
import { ProjectDocumentsTab } from '@/src/components/projects/ProjectDocumentsTab';
import { useEnsureMessageThread } from '@/src/hooks/messages/useMessages';
import { inviteInvestorSchema, type InviteInvestorFormValues } from '@/src/schemas/project.schema';
import {
  INVITE_STATUS_LABELS,
  INVESTED_INVITE_STATUSES,
  type InviteStatus,
} from '@/src/types/invitation.types';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import moment from 'moment';

type Tab = 'overview' | 'documents' | 'investors' | 'payment' | 'profits' | 'financials' | 'activity' | 'audit' | 'reconciliation' | 'ledger';

const PROOF_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const PAYMENT_TAB_STATUSES: InviteStatus[] = ['ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED'];
const LOCKED_TABS_BEFORE_CONFIRMED = ['documents'];

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
  const [commitUnits, setCommitUnits] = useState('');
  const pushToast = useUiStore((s) => s.pushToast);
  // Called unconditionally to satisfy the Rules of Hooks — the split
  // layout only kicks in on desktop viewports; hook returns false on
  // mobile/native.
  const splitLayout = useProjectSplitLayout();

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

  // Lazy pledge-expiry sweep for LM/CEO — releases 72h-stale pledges so
  // the units register never shows phantom subscriptions.
  useEffect(() => {
    if (!projectId || isInvestorRole) return;
    // Cast: RPC not in generated Database types until schema regen. The
    // migration adds this function; if the DB hasn't been migrated the call
    // fails silently.
    (supabase.rpc as any)('expire_stale_pledges', { p_project_id: projectId }).then(
      (res: { data: number | null; error: unknown }) => {
        if (!res.error && (res.data ?? 0) > 0) {
          refetchInvites();
        }
      },
    );
  }, [projectId, isInvestorRole]);

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
  const pledgeUnitsMutation = usePledgeUnits();
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
      // LM/CEO: Activity + Profits + Audit + Reconciliation tabs visible
      // once the project has been approved.
      if (project?.approvalStatus === 'APPROVED') {
        base.push({ key: 'activity', label: 'Activity' });
        base.push({ key: 'profits', label: 'Profits' });
        base.push({ key: 'reconciliation', label: 'Reconciliation' });
        base.push({ key: 'audit', label: 'Audit' });
        base.push({ key: 'ledger', label: 'Ledger' });
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

  const handleCopyInviteLink = async (row: {
    email?: string;
    firstSigninCode?: string;
    id: string;
  }) => {
    if (!row.firstSigninCode || !row.email) {
      pushToast({ type: 'error', message: 'Missing code or email on this invite.' });
      return;
    }
    // Build a deep link the investor can just click. In the local preview
    // this becomes the emergentagent URL; in production it's ribhshare.com.
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://ribhshare.com';
    const url = `${origin}/first-signin?email=${encodeURIComponent(row.email)}&code=${row.firstSigninCode}`;
    const clipText =
      `You've been invited to invest via Prism Capital (RibhShare).\n\n` +
      `Email: ${row.email}\n` +
      `One-time sign-in code: ${row.firstSigninCode}\n\n` +
      `Sign in here: ${url}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(clipText);
      } else {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(clipText);
      }
      pushToast({ type: 'success', message: 'Invite link copied — paste anywhere.' });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not copy invite link.',
      });
    }
  };

  const ensureThreadMutation = useEnsureMessageThread();
  const handleMessageInvestor = async (investorId: string) => {
    if (!projectId || !investorId) return;
    try {
      const threadId = await ensureThreadMutation.mutateAsync({
        projectId,
        investorId,
      });
      router.push(`/(tabs)/messages/${threadId}` as any);
    } catch (err) {
      pushToast({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Could not open the conversation.',
      });
    }
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
    if (!invite || !project) return;

    // Prism unit-model path: project has total_units configured.
    if (project.totalUnits && project.totalUnits > 0) {
      const units = parseInt(commitUnits, 10);
      if (!Number.isInteger(units) || units <= 0) {
        pushToast({ type: 'error', message: 'Enter a whole number of units.' });
        return;
      }
      try {
        await pledgeUnitsMutation.mutateAsync({ inviteId: invite.id, units });
        pushToast({
          type: 'success',
          message: `Pledged ${units} unit${units === 1 ? '' : 's'}. Reference generated.`,
        });
        setCommitUnits('');
        await refreshInvestor();
      } catch (err) {
        pushToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Pledge failed',
        });
      }
      return;
    }

    // Legacy ₦-amount path (pre-unitization projects).
    if (investableMax == null) return;
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
        {Platform.OS === 'web' ? (
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            style={{
              minWidth: 44,
              minHeight: 44,
              padding: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </button>
        ) : (
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={palette.text} />
          </Pressable>
        )}
        <Text style={[styles.topTitle, { color: palette.text }]}>
          {isApprovalMode ? 'Project for Approval' : project.name}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[{ flex: 1 }, splitLayout ? styles.splitRow : undefined]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={splitLayout ? styles.splitMain : undefined}
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
          unitsSubscribed={
            !isInvestorRole
              ? invites
                  .filter((i) =>
                    ['COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED'].includes(i.status),
                  )
                  .reduce((sum, i) => sum + (i.unitsPledged ?? 0), 0)
              : undefined
          }
        />
        {!isInvestorRole && project.totalUnits && project.totalUnits > 0 ? (
          <UnitSpectrumBar
            palette={palette}
            totalUnits={project.totalUnits}
            segments={invites
              .filter((i) =>
                ['COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED'].includes(i.status),
              )
              .map((i) => ({
                units: i.unitsAllotted ?? i.unitsPledged ?? 0,
                investorName: i.investorName ?? i.email,
                status: i.status,
              }))}
          />
        ) : null}

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
            {isInvestorRole && inviteStatus === 'CONFIRMED' && user?.id ? (
              <Pressable
                onPress={() => handleMessageInvestor(user.id!)}
                style={[
                  styles.copyLinkBtn,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceMuted,
                    alignSelf: 'flex-start',
                    marginTop: spacing.md,
                  },
                ]}
                data-testid="message-my-manager-btn"
                testID="message-my-manager-btn"
                accessibilityRole="button"
                accessibilityLabel="Message my line manager"
              >
                <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
                <Text
                  style={{
                    color: palette.primary,
                    fontSize: typography.sizes.xs,
                    fontWeight: '600',
                  }}
                >
                  Message my line manager
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {tab === 'payment' && invite && (
          <View>
            {inviteStatus === 'ACCEPTED' ? (
              <View style={styles.paymentBlock}>
                {project.totalUnits && project.totalUnits > 0 ? (
                  <>
                    <Text style={[styles.helper, { color: palette.textSecondary }]}>
                      1 unit = {formatNaira(project.unitPriceMinor ?? 0)} · Minimum{' '}
                      {project.minUnitsPerInvestor ?? 1} unit
                      {(project.minUnitsPerInvestor ?? 1) === 1 ? '' : 's'}
                    </Text>
                    <TextInput
                      label="How many units?"
                      value={commitUnits}
                      onChangeText={setCommitUnits}
                      keyboardType="number-pad"
                      data-testid="commit-units-input"
                    />
                    {commitUnits && parseInt(commitUnits, 10) > 0 && project.unitPriceMinor ? (
                      <Text style={[styles.helper, { color: palette.primary }]}>
                        Total pledge:{' '}
                        {formatNaira(
                          parseInt(commitUnits, 10) * project.unitPriceMinor,
                        )}
                      </Text>
                    ) : null}
                    <Button
                      title="Pledge units"
                      onPress={handleCommit}
                      loading={pledgeUnitsMutation.isPending}
                      data-testid="pledge-units-btn"
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </View>
            ) : null}

            {invite.paymentReference &&
            (inviteStatus === 'COMMITTED' || inviteStatus === 'PROOF_SUBMITTED') ? (
              <View
                style={[
                  styles.paymentBlock,
                  {
                    backgroundColor: palette.primaryLight,
                    padding: spacing.md,
                    borderRadius: 12,
                    gap: 4,
                  },
                ]}
              >
                <Text style={[styles.helper, { color: palette.primary }]}>
                  Include this reference in your transfer narration
                </Text>
                <Text
                  style={{
                    color: palette.primary,
                    fontFamily: 'monospace',
                    fontSize: typography.sizes.lg,
                    fontWeight: '700',
                    letterSpacing: 1,
                  }}
                  data-testid="payment-reference"
                  selectable
                >
                  {invite.paymentReference}
                </Text>
                {invite.unitsPledged ? (
                  <Text style={[styles.helper, { color: palette.primary }]}>
                    Pledged {invite.unitsPledged} unit
                    {invite.unitsPledged === 1 ? '' : 's'} ·{' '}
                    {invite.amountMinor ? formatNaira(invite.amountMinor) : ''}
                  </Text>
                ) : null}
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
                        {row.unitsPledged
                          ? `${row.unitsPledged} unit${row.unitsPledged === 1 ? '' : 's'} · ${formatNaira(row.amountMinor)}`
                          : `Invested: ${formatNaira(row.amountMinor)}`}
                      </Text>
                    ) : row.maxInvestmentAmountMinor != null ? (
                      <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                        Max: {formatNaira(row.maxInvestmentAmountMinor)}
                      </Text>
                    ) : null}
                    {row.paymentReference && invested ? (
                      <Text
                        style={[
                          styles.inviteMeta,
                          {
                            color: palette.primary,
                            fontFamily: 'monospace',
                            marginTop: 2,
                          },
                        ]}
                        selectable
                      >
                        ref · {row.paymentReference}
                      </Text>
                    ) : null}
                    {row.firstSigninCode &&
                    !row.firstSigninCodeRedeemedAt &&
                    canManageProjects(role) ? (
                      <Pressable
                        onPress={() => handleCopyInviteLink(row)}
                        style={[
                          styles.copyLinkBtn,
                          { borderColor: palette.border, backgroundColor: palette.surfaceMuted },
                        ]}
                        data-testid={`copy-invite-link-${row.id}`}
                      >
                        <Ionicons name="link-outline" size={14} color={palette.primary} />
                        <Text
                          style={{
                            color: palette.primary,
                            fontSize: typography.sizes.xs,
                            fontWeight: '600',
                          }}
                        >
                          Copy invite link
                        </Text>
                      </Pressable>
                    ) : null}
                    {invested && row.investorId ? (
                      <Pressable
                        onPress={() => handleMessageInvestor(row.investorId!)}
                        style={[
                          styles.copyLinkBtn,
                          { borderColor: palette.border, backgroundColor: palette.surfaceMuted, marginTop: 6 },
                        ]}
                        data-testid={`message-investor-${row.id}`}
                        testID={`message-investor-${row.id}`}
                        accessibilityRole="button"
                        accessibilityLabel="Message this investor"
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={14}
                          color={palette.primary}
                        />
                        <Text
                          style={{
                            color: palette.primary,
                            fontSize: typography.sizes.xs,
                            fontWeight: '600',
                          }}
                        >
                          Message
                        </Text>
                      </Pressable>
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
            canDeclare={canManageProjects(role) && project.createdBy?.id === user?.id}
            canApprove={role === 'CEO' || role === 'ADMIN'}
            platformFeeBps={project.platformFeeBps ?? 750}
            profitSplitInvestorBps={project.profitSplitInvestorBps}
            totalUnits={project.totalUnits ?? 0}
            confirmedInvestorCount={invites.filter((i) => i.status === 'CONFIRMED').length}
            onChanged={() => {
              refetchProject();
              refetchInvites();
            }}
          />
        )}
        {tab === 'audit' && !isInvestorRole && project.approvalStatus === 'APPROVED' && (
          <ProjectAuditTab projectId={project.id} />
        )}
        {tab === 'reconciliation' && !isInvestorRole && project.approvalStatus === 'APPROVED' && (
          <ProjectReconciliationTab projectId={project.id} />
        )}
        {tab === 'ledger' && !isInvestorRole && project.approvalStatus === 'APPROVED' && (
          <ProjectLedgerTab projectId={project.id} />
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
      {splitLayout ? (
        <ProjectContextPanel
          projectId={project.id}
          raisedMinor={project.raisedMinor}
          targetMinor={project.targetMinor}
          totalUnits={project.totalUnits ?? 0}
          unitsCommitted={(project as any).unitsCommitted ?? 0}
          unitsAvailable={(project as any).unitsAvailable ?? project.totalUnits ?? 0}
          investorCount={0}
          stage={project.stage}
          approvalStatus={project.approvalStatus}
          managerName={(project as any).manager?.fullName ?? null}
          createdAt={project.createdAt}
          investorRealisedMinor={profitMeta?.investorRealisedMinor ?? 0}
        />
      ) : null}
      </View>

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
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center', padding: 4 },
  topTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
    textAlign: 'center',
  },
  scrollPad: { paddingBottom: 90 },
  splitRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  splitMain: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    // Prism serif hero — Georgia stack is safe on iOS/Android/web, no font-load flash
    fontFamily: Platform.select({ web: 'Georgia, "Times New Roman", serif', default: 'Georgia' }),
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
  },
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
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});

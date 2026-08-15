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
import {
  ProjectContextPanel,
  useProjectSplitLayout,
} from '@/src/components/projects/ProjectContextPanel';
import { InvestorFinancialsCard } from '@/src/components/projects/InvestorFinancialsCard';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useUiStore } from '@/src/store/useUiStore';
import {
  canApproveProjects,
  canAssignProjectOwner,
  canManageProjects,
  isInvestor,
  isProjectOwner,
  isPrismOperator,
} from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { CONTEXT_PANEL_WIDTH } from '@/src/constants/layout';
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
import {
  useApproveRemnantPledge,
  useRejectRemnantPledge,
  useRequestRemnantPledge,
} from '@/src/hooks/invitations/useRemnantPledge';
import { useSubmitPaymentProof } from '@/src/hooks/invitations/useSubmitPaymentProof';
import { useConfirmInvitePayment } from '@/src/hooks/invitations/useConfirmInvitePayment';
import { finalizeProjectIfDue } from '@/src/services/profits.services';
import { supabase } from '@/src/services/supabase';
import { getDocumentSignedUrl } from '@/src/services/documents.services';
import { useProjectProfitMeta } from '@/src/hooks/profits/useProfits';
import { ProjectActivityTab } from '@/src/components/projects/ProjectActivityTab';
import { ProjectDocumentsTab } from '@/src/components/projects/ProjectDocumentsTab';
import { ProjectDrawdownsTab } from '@/src/components/projects/ProjectDrawdownsTab';
import { ProjectWithdrawalsTab } from '@/src/components/projects/ProjectWithdrawalsTab';
import {
  useEnsureMessageThread,
  useEnsureOwnerLmThread,
} from '@/src/hooks/messages/useMessages';
import { inviteInvestorSchema, type InviteInvestorFormValues } from '@/src/schemas/project.schema';
import { formatUnits, formatUnitsLabel as formatUnitsLabelUtil } from '@/src/utils/units';
import {
  INVITE_STATUS_LABELS,
  INVESTED_INVITE_STATUSES,
  type Invite,
  type InviteStatus,
} from '@/src/types/invitation.types';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import {
  createProjectOwner,
  downloadProjectPackCsv,
  fetchProjectPack,
  investorWithdrawableMinor,
  requestProfitWithdrawal,
} from '@/src/services/projectOps.services';
import moment from 'moment';
import {
  formatResendCountdown,
  markOwnerInviteSent,
  ownerInviteResendRemainingMs,
} from '@/src/utils/ownerInviteCooldown';

function inviteReservesUnits(i: Invite): boolean {
  if (i.minWaiverStatus === 'PENDING' && (i.unitsPledged ?? 0) > 0) return true;
  return ['COMMITTED', 'PROOF_SUBMITTED', 'CONFIRMED'].includes(i.status);
}

type Tab =
  | 'overview'
  | 'documents'
  | 'investors'
  | 'payment'
  | 'profits'
  | 'financials'
  | 'activity'
  | 'audit'
  | 'reconciliation'
  | 'ledger'
  | 'drawdowns'
  | 'withdrawals';

const PROOF_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const PAYMENT_TAB_STATUSES: InviteStatus[] = ['ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED'];
const LOCKED_TABS_BEFORE_CONFIRMED = ['documents'];

export default function ProjectDetailScreen() {
  const {
    id,
    invite: inviteParam,
    tab: tabParam,
  } = useLocalSearchParams<{ id: string; invite?: string; tab?: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);
  const isInvestorRole = isInvestor(role);
  const [tab, setTab] = useState<Tab>('overview');

  // Deep links from LM tasks / proof / drawdown / withdrawal notifications.
  useEffect(() => {
    if (isInvestorRole) return;
    const ownerAllowed = ['overview', 'payment', 'drawdowns', 'profits', 'documents', 'activity'];
    const staffAllowed = [
      'investors',
      'payment',
      'overview',
      'drawdowns',
      'withdrawals',
      'profits',
    ];
    const allowed = isProjectOwner(role) ? ownerAllowed : staffAllowed;
    if (tabParam && allowed.includes(String(tabParam))) {
      setTab(tabParam as Tab);
      return;
    }
    // Proof / remnant links often carry invite= without tab= — open Investors.
    if (inviteParam && !isProjectOwner(role) && allowed.includes('investors')) {
      setTab('investors');
    }
  }, [tabParam, inviteParam, isInvestorRole, role]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerResendRemainingMs, setOwnerResendRemainingMs] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawable, setWithdrawable] = useState<number | null>(null);
  const [commitAmount, setCommitAmount] = useState('');
  const [commitUnits, setCommitUnits] = useState('');
  const [pledgeInputMode, setPledgeInputMode] = useState<'units' | 'naira'>('units');
  const [openingBriefId, setOpeningBriefId] = useState<string | null>(null);
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

  // Project-owner invite resend cooldown (5 minutes).
  useEffect(() => {
    if (!projectId) return;
    const tick = () => setOwnerResendRemainingMs(ownerInviteResendRemainingMs(projectId));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [projectId]);

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
  const requestRemnant = useRequestRemnantPledge();
  const approveRemnant = useApproveRemnantPledge(projectId);
  const rejectRemnant = useRejectRemnantPledge(projectId);

  const displayInvites = useMemo(() => {
    if (!inviteParam) return invites;
    const target = String(inviteParam);
    return [...invites].sort((a, b) => {
      if (a.id === target) return -1;
      if (b.id === target) return 1;
      return 0;
    });
  }, [invites, inviteParam]);

  const unitRegister = useMemo(() => {
    const total = project?.totalUnits ?? 0;
    const reservedInvites = invites.filter(inviteReservesUnits);
    const committed = Math.round(
      reservedInvites.reduce((sum, i) => sum + (i.unitsPledged ?? i.unitsAllotted ?? 0), 0) * 1e6,
    ) / 1e6;
    const available = Math.round(Math.max(0, total - committed) * 1e6) / 1e6;
    const investorCount = new Set(
      reservedInvites
        .filter((i) => i.status === 'CONFIRMED' || i.minWaiverStatus === 'PENDING' || INVESTED_INVITE_STATUSES.includes(i.status))
        .map((i) => i.investorId || i.email || i.id),
    ).size;
    return { total, committed, available, investorCount };
  }, [invites, project?.totalUnits]);

  /** Investor-side available when invites list isn't loaded for LM-only query. */
  const [investorAvailable, setInvestorAvailable] = useState<number | null>(null);
  useEffect(() => {
    if (!isInvestorRole || !projectId || !project?.totalUnits) {
      setInvestorAvailable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase.rpc as any)('project_units_reserved', {
          p_project_id: projectId,
          p_exclude_invite_id: invite?.id ?? null,
        });
        if (cancelled || error) return;
        const reserved = Number(data ?? 0);
        const avail = Math.round(Math.max(0, (project.totalUnits ?? 0) - reserved) * 1e6) / 1e6;
        setInvestorAvailable(avail);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isInvestorRole, projectId, project?.totalUnits, invite?.id, invite?.status, invite?.minWaiverStatus, invite?.unitsPledged]);

  const unitsAvailableForPledge = isInvestorRole
    ? (investorAvailable ?? unitRegister.available)
    : unitRegister.available;

  const inviteMethods = useForm<InviteInvestorFormValues>({
    resolver: zodResolver(inviteInvestorSchema) as Resolver<InviteInvestorFormValues>,
    defaultValues: { email: '', minUnits: '' as unknown as number },
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
      if (!isProjectOwner(role)) {
        base.push({ key: 'investors', label: 'Investors' });
      }
      // LM/CEO/Owner: ops tabs once approved
      if (project?.approvalStatus === 'APPROVED') {
        base.push({ key: 'activity', label: 'Activity' });
        base.push({ key: 'profits', label: 'Profits' });
        base.push({ key: 'drawdowns', label: 'Drawdowns' });
        if (!isProjectOwner(role)) {
          base.push({ key: 'withdrawals', label: 'Withdrawals' });
          base.push({ key: 'reconciliation', label: 'Reconciliation' });
          base.push({ key: 'audit', label: 'Audit' });
          base.push({ key: 'ledger', label: 'Ledger' });
        }
      }
    }
    return base;
  }, [isInvestorRole, showPaymentTab, inviteStatus, project?.approvalStatus, role]);

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
      const minUnits =
        values.minUnits != null && values.minUnits > 0 ? values.minUnits : undefined;
      const result = await createInvite.mutateAsync({
        email: values.email.trim().toLowerCase(),
        minUnits,
      });
      inviteMethods.reset({ email: '', minUnits: '' as unknown as number });
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
  const ensureOwnerLmThreadMutation = useEnsureOwnerLmThread();

  const briefDocs = useMemo(() => documents.filter((d) => d.kind === 'OVERVIEW'), [documents]);

  const handleOpenBrief = async (docId: string, storagePath: string) => {
    try {
      setOpeningBriefId(docId);
      const url = await getDocumentSignedUrl(storagePath);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const Linking = await import('expo-linking');
        await Linking.openURL(url);
      }
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open brief.',
      });
    } finally {
      setOpeningBriefId(null);
    }
  };

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
        message: err instanceof Error ? err.message : 'Could not open the conversation.',
      });
    }
  };

  const handleMessageOwnerLm = async () => {
    if (!projectId) return;
    try {
      const threadId = await ensureOwnerLmThreadMutation.mutateAsync({ projectId });
      router.push(`/(tabs)/messages/${threadId}` as any);
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open the conversation.',
      });
    }
  };

  const handleExportPack = async () => {
    if (!project) return;
    if (Platform.OS !== 'web') {
      pushToast({
        type: 'info',
        message: 'CSV export is available on web.',
      });
      return;
    }
    setExportBusy(true);
    try {
      const pack = await fetchProjectPack(project.id);
      downloadProjectPackCsv(pack);
      pushToast({
        type: 'success',
        message: `Exported PRSM-${project.code}-export.csv`,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Export failed',
      });
    } finally {
      setExportBusy(false);
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

  const formatUnitsLabel = (units: number) => formatUnitsLabelUtil(units);

  const effectiveMinUnits = useMemo(() => {
    if (!invite || !project) return 1;
    return Math.max(invite.minUnits ?? 0, project.minUnitsPerInvestor ?? 1);
  }, [invite, project]);

  const remnantMode =
    !!project?.totalUnits &&
    project.totalUnits > 0 &&
    unitsAvailableForPledge > 0 &&
    unitsAvailableForPledge < effectiveMinUnits;

  const handleCommit = async () => {
    if (!invite || !project) return;

    // Prism unit-model path: project has total_units configured.
    if (project.totalUnits && project.totalUnits > 0) {
      const minUnits = effectiveMinUnits;
      const unitPrice = project.unitPriceMinor ?? 0;
      const available = unitsAvailableForPledge;

      try {
        // Parse desired units from either input mode
        let desiredUnits = 0;
        let amountMinor: number | undefined;
        if (pledgeInputMode === 'naira') {
          const naira = parseFloat(commitAmount);
          if (!Number.isFinite(naira) || naira <= 0) {
            pushToast({ type: 'error', message: 'Enter a valid amount in naira.' });
            return;
          }
          amountMinor = nairaToKobo(naira);
          if (unitPrice <= 0) {
            pushToast({ type: 'error', message: 'Invalid unit price.' });
            return;
          }
          desiredUnits = Math.round((amountMinor / unitPrice) * 1e6) / 1e6;
        } else {
          desiredUnits = parseFloat(commitUnits);
          if (!Number.isFinite(desiredUnits) || desiredUnits <= 0) {
            pushToast({ type: 'error', message: 'Enter a valid number of units.' });
            return;
          }
          desiredUnits = Math.round(desiredUnits * 1e6) / 1e6;
        }

        // Remnant / below-min: only available units can be reserved; LM must approve.
        if (remnantMode) {
          const remnantUnits = Math.min(desiredUnits, available);
          if (remnantUnits <= 0) {
            pushToast({ type: 'error', message: 'No units remaining on this project.' });
            return;
          }
          if (remnantUnits >= minUnits) {
            // Shouldn't happen in remnantMode; fall through to normal pledge.
          } else {
            await requestRemnant.mutateAsync({
              inviteId: invite.id,
              units: remnantUnits,
            });
            const shortfall = Math.round((minUnits - remnantUnits) * 1e6) / 1e6;
            pushToast({
              type: 'success',
              message: `Requested ${formatUnitsLabel(remnantUnits)} (min was ${formatUnitsLabel(minUnits)}; shortfall ${formatUnits(shortfall)}). Awaiting Line Manager approval.`,
            });
            setCommitAmount('');
            setCommitUnits('');
            await refreshInvestor();
            return;
          }
        }

        if (desiredUnits < minUnits) {
          pushToast({
            type: 'error',
            message: `Minimum ${formatUnitsLabel(minUnits)}${
              unitPrice > 0 ? ` (${formatNaira(minUnits * unitPrice)})` : ''
            }.`,
          });
          return;
        }
        if (desiredUnits > available) {
          pushToast({
            type: 'error',
            message: `Only ${formatUnitsLabel(available)} remaining on this project.`,
          });
          return;
        }

        if (pledgeInputMode === 'naira' && amountMinor != null) {
          const pledged = await pledgeUnitsMutation.mutateAsync({
            inviteId: invite.id,
            amountMinor,
          });
          pushToast({
            type: 'success',
            message: `Pledged ${formatNaira(amountMinor)} · ${formatUnitsLabel(pledged.unitsPledged ?? 0)}.`,
          });
          setCommitAmount('');
        } else {
          await pledgeUnitsMutation.mutateAsync({ inviteId: invite.id, units: desiredUnits });
          pushToast({
            type: 'success',
            message: `Pledged ${formatUnitsLabel(desiredUnits)}. Reference generated.`,
          });
          setCommitUnits('');
        }
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

      <View style={[styles.body, splitLayout ? styles.splitRow : undefined]}>
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
              <Text
                style={[styles.codeChip, { color: palette.muted, borderColor: palette.border }]}
              >
                {project.code}
              </Text>
            ) : null}
            {isInvestorRole && inviteStatus ? (
              <Badge label={INVITE_STATUS_LABELS[inviteStatus]} variant="accent" />
            ) : null}
          </View>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>
            {project.sector}
            {isProjectOwner(role)
              ? project.createdBy?.full_name
                ? ` · Managed by Prism · ${project.createdBy.full_name}`
                : ' · Managed by Prism'
              : !isInvestorRole
                ? ` · By ${project.createdBy?.full_name}`
                : ''}
          </Text>
          {!isInvestorRole && !isProjectOwner(role) && project.submittedAt ? (
            <Text style={[styles.meta, { color: palette.muted, marginBottom: spacing.md }]}>
              Requested: {moment(project.submittedAt).calendar()}
            </Text>
          ) : (
            <View style={{ marginBottom: spacing.md }} />
          )}

          <FinancialOverview
            project={project}
            mode={
              isInvestorRole && inviteStatus !== 'CONFIRMED'
                ? 'investor'
                : isProjectOwner(role)
                  ? 'owner'
                  : 'manager'
            }
            investableMaxMinor={
              isInvestorRole && invite?.maxInvestmentAmountMinor != null ? investableMax : undefined
            }
            unitsSubscribed={
              !isInvestorRole && !isProjectOwner(role) ? unitRegister.committed : undefined
            }
          />
          {!isInvestorRole &&
          !isProjectOwner(role) &&
          project.totalUnits &&
          project.totalUnits > 0 ? (
            <UnitSpectrumBar
              palette={palette}
              totalUnits={project.totalUnits}
              segments={invites
                .filter(inviteReservesUnits)
                .map((i) => ({
                  units: i.unitsAllotted ?? i.unitsPledged ?? 0,
                  investorName: i.investorName ?? i.email,
                  status:
                    i.minWaiverStatus === 'PENDING'
                      ? 'REMNANT_PENDING'
                      : i.status,
                }))}
            />
          ) : null}

          <TabBar tabs={TABS} activeKey={tab} onChange={onTabPress} disabledKeys={disabledTabs} />

          {tab === 'overview' && (
            <View>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Project Summary</Text>
              <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
                {project.summary}
              </Text>
              <Text style={[styles.sectionTitle, { color: palette.text, marginTop: spacing.md }]}>
                Key Details
              </Text>
              <KeyDetailsList project={project} revealSensitive={unlocked} />

              {!isInvestorRole && (isPrismOperator(role) || canAssignProjectOwner(role)) ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Project owner (originator)
                  </Text>
                  {project.projectOwnerId && project.projectOwner ? (
                    <View style={{ gap: spacing.sm }}>
                      <View
                        style={[
                          styles.copyLinkBtn,
                          {
                            borderColor: palette.border,
                            backgroundColor: palette.surfaceMuted,
                            alignSelf: 'stretch',
                            justifyContent: 'flex-start',
                          },
                        ]}
                      >
                        <Ionicons name="person-outline" size={14} color={palette.primary} />
                        <Text style={[styles.bodyText, { color: palette.text, flex: 1 }]}>
                          {project.projectOwner.full_name}
                          {project.projectOwner.email ? ` · ${project.projectOwner.email}` : ''}
                        </Text>
                      </View>
                      {canAssignProjectOwner(role) &&
                      project.projectOwner.email &&
                      (project.createdBy?.id === user?.id ||
                        role === 'CEO' ||
                        role === 'ADMIN') ? (
                        <Button
                          title={
                            ownerResendRemainingMs > 0
                              ? `Resend available in ${formatResendCountdown(ownerResendRemainingMs)}`
                              : 'Resend invite email'
                          }
                          variant="outline"
                          loading={ownerBusy}
                          disabled={ownerBusy || ownerResendRemainingMs > 0}
                          onPress={async () => {
                            setOwnerBusy(true);
                            try {
                              const res = await createProjectOwner({
                                projectId: project.id,
                                email: project.projectOwner!.email!.trim(),
                                fullName: project.projectOwner!.full_name.trim(),
                                resend: true,
                              });
                              markOwnerInviteSent(project.id);
                              setOwnerResendRemainingMs(ownerInviteResendRemainingMs(project.id));
                              if (res.emailSent) {
                                pushToast({
                                  type: 'success',
                                  message: `Invite re-sent to ${res.email}. You can resend again in 5 minutes if needed.`,
                                });
                              } else {
                                const codeHint = res.signinCode
                                  ? ` Sign-in code: ${res.signinCode}`
                                  : '';
                                const errHint = res.emailError ? ` (${res.emailError})` : '';
                                pushToast({
                                  type: 'error',
                                  message: `Email failed.${codeHint}${errHint}`,
                                });
                              }
                            } catch (err) {
                              pushToast({
                                type: 'error',
                                message:
                                  err instanceof Error ? err.message : 'Could not resend invite',
                              });
                            } finally {
                              setOwnerBusy(false);
                            }
                          }}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.helper, { color: palette.muted }]}>
                      No project owner linked yet. Prism creates their login for this project.
                    </Text>
                  )}
                  {canAssignProjectOwner(role) &&
                  !project.projectOwnerId &&
                  (project.createdBy?.id === user?.id ||
                    role === 'CEO' ||
                    role === 'ADMIN') ? (
                    <View style={{ gap: spacing.sm }}>
                      <TextInput
                        label="Owner full name"
                        value={ownerName}
                        onChangeText={setOwnerName}
                        autoCapitalize="words"
                      />
                      <TextInput
                        label="Owner email"
                        value={ownerEmail}
                        onChangeText={setOwnerEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <Button
                        title="Create / assign owner"
                        loading={ownerBusy}
                        disabled={
                          ownerName.trim().length < 2 || !ownerEmail.trim().includes('@')
                        }
                        onPress={async () => {
                          setOwnerBusy(true);
                          try {
                            const res = await createProjectOwner({
                              projectId: project.id,
                              email: ownerEmail.trim(),
                              fullName: ownerName.trim(),
                            });
                            markOwnerInviteSent(project.id);
                            setOwnerResendRemainingMs(ownerInviteResendRemainingMs(project.id));
                            if (res.emailSent) {
                              pushToast({
                                type: 'success',
                                message: `Invite emailed to ${res.email}`,
                              });
                            } else {
                              const codeHint = res.signinCode
                                ? ` Sign-in code: ${res.signinCode}`
                                : '';
                              const errHint = res.emailError ? ` (${res.emailError})` : '';
                              pushToast({
                                type: 'error',
                                message: `Owner linked but email failed.${codeHint}${errHint}`,
                              });
                            }
                            setOwnerEmail('');
                            setOwnerName('');
                            refetchProject();
                          } catch (err) {
                            pushToast({
                              type: 'error',
                              message:
                                err instanceof Error ? err.message : 'Could not assign owner',
                            });
                          } finally {
                            setOwnerBusy(false);
                          }
                        }}
                      />
                    </View>
                  ) : null}

                  {project.projectOwnerId &&
                  (project.createdBy?.id === user?.id ||
                    role === 'CEO' ||
                    role === 'ADMIN') ? (
                    <Pressable
                      onPress={handleMessageOwnerLm}
                      style={[
                        styles.copyLinkBtn,
                        {
                          borderColor: palette.border,
                          backgroundColor: palette.surfaceMuted,
                          alignSelf: 'flex-start',
                        },
                      ]}
                      data-testid="message-project-owner-btn"
                      accessibilityRole="button"
                      accessibilityLabel="Message project owner"
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
                      <Text
                        style={{
                          color: palette.primary,
                          fontSize: typography.sizes.xs,
                          fontWeight: '600',
                        }}
                      >
                        Message project owner
                      </Text>
                    </Pressable>
                  ) : null}

                  {isPrismOperator(role) || role === 'CEO' || role === 'ADMIN' ? (
                    <Button
                      title={exportBusy ? 'Exporting…' : 'Export project pack (CSV)'}
                      variant="outline"
                      loading={exportBusy}
                      onPress={handleExportPack}
                      data-testid="export-project-pack-btn"
                    />
                  ) : null}
                </View>
              ) : null}

              {/* Originator actions — must not sit inside Prism-staff gate */}
              {project.projectOwnerId === user?.id ? (
                <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Work with Prism
                  </Text>
                  <Pressable
                    onPress={handleMessageOwnerLm}
                    style={[
                      styles.copyLinkBtn,
                      {
                        borderColor: palette.border,
                        backgroundColor: palette.surfaceMuted,
                        alignSelf: 'flex-start',
                      },
                    ]}
                    data-testid="message-prism-lm-btn"
                    accessibilityRole="button"
                    accessibilityLabel="Message Prism Line Manager"
                  >
                    <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
                    <Text
                      style={{
                        color: palette.primary,
                        fontSize: typography.sizes.xs,
                        fontWeight: '600',
                      }}
                    >
                      Message Prism Line Manager
                    </Text>
                  </Pressable>
                  <Button
                    title={exportBusy ? 'Exporting…' : 'Export project pack (CSV)'}
                    variant="outline"
                    loading={exportBusy}
                    onPress={handleExportPack}
                    data-testid="export-project-pack-owner-btn"
                  />
                </View>
              ) : null}

              {unlocked && briefDocs.length > 0 ? (
                <View style={styles.briefBlock}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: palette.text, marginTop: spacing.md, marginBottom: spacing.xs },
                    ]}
                  >
                    {briefDocs.length === 1 ? 'Project brief' : 'Project briefs'}
                  </Text>
                  {briefDocs.length === 1 ? (
                    <Pressable
                      onPress={() => handleOpenBrief(briefDocs[0].id, briefDocs[0].storagePath)}
                      style={[
                        styles.briefBtn,
                        {
                          borderColor: palette.primary,
                          backgroundColor: palette.primaryLight,
                        },
                      ]}
                      data-testid="read-full-brief-btn"
                      testID="read-full-brief-btn"
                      accessibilityRole="button"
                      accessibilityLabel="Read the full brief"
                    >
                      {openingBriefId === briefDocs[0].id ? (
                        <ActivityIndicator size="small" color={palette.primary} />
                      ) : (
                        <Ionicons name="document-text-outline" size={16} color={palette.primary} />
                      )}
                      <Text
                        style={{
                          color: palette.primary,
                          fontSize: typography.sizes.sm,
                          fontWeight: '600',
                        }}
                      >
                        Read the full brief
                      </Text>
                      <Ionicons name="open-outline" size={14} color={palette.primary} />
                    </Pressable>
                  ) : (
                    <View style={{ gap: spacing.xs }}>
                      <Text
                        style={[styles.bodyText, { color: palette.textSecondary, marginBottom: 4 }]}
                      >
                        Select a brief to read:
                      </Text>
                      {briefDocs.map((doc) => (
                        <Pressable
                          key={doc.id}
                          onPress={() => handleOpenBrief(doc.id, doc.storagePath)}
                          style={[
                            styles.briefListRow,
                            { borderColor: palette.border, backgroundColor: palette.surface },
                          ]}
                          data-testid={`read-brief-${doc.id}`}
                          testID={`read-brief-${doc.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Read ${doc.title}`}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={16}
                            color={palette.primary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: palette.text,
                                fontSize: typography.sizes.sm,
                                fontWeight: '600',
                              }}
                              numberOfLines={1}
                            >
                              {doc.title}
                            </Text>
                            <Text
                              style={{
                                color: palette.muted,
                                fontSize: typography.sizes.xs,
                                marginTop: 2,
                              }}
                              numberOfLines={1}
                            >
                              {doc.fileName}
                            </Text>
                          </View>
                          {openingBriefId === doc.id ? (
                            <ActivityIndicator size="small" color={palette.primary} />
                          ) : (
                            <Ionicons name="open-outline" size={16} color={palette.muted} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
              {inviteStatus === 'CONFIRMED' && invite?.amountMinor != null ? (
                <Text style={[styles.bodyText, { color: palette.primary, marginTop: spacing.md }]}>
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
              {inviteStatus === 'ACCEPTED' && invite.minWaiverStatus === 'PENDING' ? (
                <View style={styles.paymentBlock}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Awaiting Line Manager approval
                  </Text>
                  <Text style={[styles.helper, { color: palette.textSecondary }]}>
                    You requested {formatUnitsLabel(invite.unitsPledged ?? 0)}
                    {invite.amountMinor != null ? ` (${formatNaira(invite.amountMinor)})` : ''} —
                    below the usual minimum of {formatUnitsLabel(effectiveMinUnits)}. Units are
                    reserved until your Line Manager approves.
                  </Text>
                </View>
              ) : null}
              {inviteStatus === 'ACCEPTED' && invite.minWaiverStatus !== 'PENDING' ? (
                <View style={styles.paymentBlock}>
                  {project.totalUnits && project.totalUnits > 0 ? (
                    <>
                      {remnantMode ? (
                        <View
                          style={[
                            styles.remnantBanner,
                            {
                              borderColor: palette.semantic.warning?.fg ?? palette.primary,
                              backgroundColor:
                                palette.semantic.warning?.bg ?? palette.primaryLight,
                            },
                          ]}
                          data-testid="remnant-pledge-banner"
                        >
                          <Text
                            style={[
                              styles.helper,
                              { color: palette.semantic.warning?.fg ?? palette.primary },
                            ]}
                          >
                            Only {formatUnitsLabel(unitsAvailableForPledge)} left — below your
                            minimum of {formatUnitsLabel(effectiveMinUnits)} (shortfall{' '}
                            {formatUnits(
                              Math.round(
                                (effectiveMinUnits - unitsAvailableForPledge) * 1e6,
                              ) / 1e6,
                            )}
                            ). Enter what you want; we reserve up to the remnant and your Line
                            Manager must approve.
                          </Text>
                        </View>
                      ) : (
                        <Text style={[styles.helper, { color: palette.textSecondary }]}>
                          1 unit = {formatNaira(project.unitPriceMinor ?? 0)} · Minimum{' '}
                          {formatUnitsLabel(effectiveMinUnits)}
                          {unitsAvailableForPledge > 0
                            ? ` · ${formatUnitsLabel(unitsAvailableForPledge)} available`
                            : ''}
                        </Text>
                      )}
                      <View style={styles.pledgeModeRow}>
                        {(
                          [
                            { key: 'units' as const, label: 'Units' },
                            { key: 'naira' as const, label: '₦ Naira' },
                          ] as const
                        ).map((mode) => {
                          const active = pledgeInputMode === mode.key;
                          return (
                            <Pressable
                              key={mode.key}
                              onPress={() => setPledgeInputMode(mode.key)}
                              style={[
                                styles.pledgeModeChip,
                                {
                                  borderColor: active ? palette.primary : palette.border,
                                  backgroundColor: active
                                    ? palette.primaryLight
                                    : palette.surface,
                                },
                              ]}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                            >
                              <Text
                                style={{
                                  color: active ? palette.primary : palette.text,
                                  fontSize: typography.sizes.xs,
                                  fontWeight: active ? '600' : '400',
                                }}
                              >
                                {mode.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {pledgeInputMode === 'units' ? (
                        <>
                          <TextInput
                            label={remnantMode ? 'Units you want' : 'How many units?'}
                            value={commitUnits}
                            onChangeText={setCommitUnits}
                            keyboardType="decimal-pad"
                            data-testid="commit-units-input"
                            placeholder={
                              remnantMode
                                ? `e.g. ${formatUnits(unitsAvailableForPledge)}`
                                : 'e.g. 1.5'
                            }
                          />
                          {(() => {
                            const units = parseFloat(commitUnits);
                            if (
                              !Number.isFinite(units) ||
                              units <= 0 ||
                              !project.unitPriceMinor
                            ) {
                              return null;
                            }
                            const reserved = remnantMode
                              ? Math.min(units, unitsAvailableForPledge)
                              : units;
                            return (
                              <Text style={[styles.helper, { color: palette.primary }]}>
                                Equals {formatNaira(Math.round(reserved * project.unitPriceMinor))}
                                {remnantMode && units !== reserved
                                  ? ` · reserves ${formatUnitsLabel(reserved)} of ${formatUnitsLabel(units)} requested`
                                  : remnantMode
                                    ? ` · shortfall vs min: ${formatUnits(Math.round((effectiveMinUnits - reserved) * 1e6) / 1e6)}`
                                    : ''}
                              </Text>
                            );
                          })()}
                        </>
                      ) : (
                        <>
                          <TextInput
                            label={remnantMode ? 'Amount you want (₦)' : 'Pledge amount (₦)'}
                            value={commitAmount}
                            onChangeText={setCommitAmount}
                            keyboardType="decimal-pad"
                            data-testid="commit-naira-input"
                            placeholder="e.g. 1800000"
                          />
                          {(() => {
                            const naira = parseFloat(commitAmount);
                            const unitPrice = project.unitPriceMinor ?? 0;
                            if (!Number.isFinite(naira) || naira <= 0 || unitPrice <= 0) {
                              return null;
                            }
                            const units =
                              Math.round((nairaToKobo(naira) / unitPrice) * 1e6) / 1e6;
                            const reserved = remnantMode
                              ? Math.min(units, unitsAvailableForPledge)
                              : units;
                            return (
                              <Text style={[styles.helper, { color: palette.primary }]}>
                                Equals {formatUnitsLabel(reserved)}
                                {remnantMode && units !== reserved
                                  ? ` · of ${formatUnitsLabel(units)} requested`
                                  : remnantMode
                                    ? ` · shortfall vs min: ${formatUnits(Math.round((effectiveMinUnits - reserved) * 1e6) / 1e6)}`
                                    : ''}
                              </Text>
                            );
                          })()}
                        </>
                      )}
                      <Button
                        title={
                          remnantMode
                            ? 'Request remnant pledge'
                            : pledgeInputMode === 'naira'
                              ? 'Pledge amount'
                              : 'Pledge units'
                        }
                        onPress={handleCommit}
                        loading={requestRemnant.isPending || pledgeUnitsMutation.isPending}
                        data-testid="pledge-units-btn"
                      />
                    </>
                  ) : (
                    <>
                      <TextInput
                        label="Commit amount (₦)"
                        value={
                          commitAmount || (investableMax != null ? String(investableMax / 100) : '')
                        }
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
                      Pledged {formatUnitsLabel(invite.unitsPledged)} ·{' '}
                      {invite.amountMinor ? formatNaira(invite.amountMinor) : ''}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {payAccount &&
              (inviteStatus === 'COMMITTED' || inviteStatus === 'PROOF_SUBMITTED') ? (
                <View style={styles.paymentBlock}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>
                    Escrow bank details
                  </Text>
                  <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
                    Bank: {payAccount.bankName}
                  </Text>
                  <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
                    Account name: {payAccount.accountName}
                  </Text>
                  <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
                    Account number: {payAccount.accountNumber}
                  </Text>
                </View>
              ) : null}

              {inviteStatus === 'COMMITTED' ? (
                <View style={styles.paymentBlock}>
                  <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
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
                  <Text style={[styles.bodyText, { color: palette.primary }]}>
                    {invite.proofFileName
                      ? `Proof submitted: ${invite.proofFileName}`
                      : 'Payment proof submitted.'}
                  </Text>
                  <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
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
                  !isInvestorRole && canManageProjects(role) && project.createdBy?.id === user?.id
                }
              />
            )}

          {tab === 'investors' && !isInvestorRole && !isProjectOwner(role) && (
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
                      name="minUnits"
                      label="Min units — optional"
                      keyboardType="number-pad"
                      placeholder="Leave blank to use project minimum"
                    />
                    <FormSubmitButton title="Send invite" onPress={handleInvite} />
                  </FormProvider>
                </View>
              ) : null}

              {invitesLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.md }} />
              ) : invites.length === 0 ? (
                <Text style={[styles.bodyText, { color: palette.muted, marginTop: spacing.sm }]}>
                  No investors invited yet.
                </Text>
              ) : (
                displayInvites.map((row) => {
                  const invested = INVESTED_INVITE_STATUSES.includes(row.status);
                  const isDeepLinked = !!inviteParam && row.id === String(inviteParam);
                  return (
                    <View
                      key={row.id}
                      style={[
                        styles.inviteRow,
                        {
                          borderColor: isDeepLinked ? palette.primary : palette.border,
                          backgroundColor: isDeepLinked ? palette.brand[50] : palette.surface,
                          borderWidth: isDeepLinked ? 2 : 1,
                        },
                      ]}
                    >
                      <View style={styles.inviteRowTop}>
                        <Text style={[styles.inviteName, { color: palette.text }]}>
                          {row.investorName || row.email || row.investorId}
                        </Text>
                        <Badge label={INVITE_STATUS_LABELS[row.status]} variant="accent" />
                      </View>
                      {row.email && row.investorName ? (
                        <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                          {row.email}
                        </Text>
                      ) : null}
                      {invested && row.amountMinor != null ? (
                        <Text style={[styles.inviteAmount, { color: palette.text }]}>
                          {row.unitsPledged
                            ? `${formatUnitsLabel(row.unitsPledged)} · ${formatNaira(row.amountMinor)}`
                            : `Invested: ${formatNaira(row.amountMinor)}`}
                        </Text>
                      ) : row.minWaiverStatus === 'PENDING' && row.unitsPledged != null ? (
                        <Text style={[styles.inviteAmount, { color: palette.primary }]}>
                          Remnant request: {formatUnitsLabel(row.unitsPledged)}
                          {row.amountMinor != null ? ` · ${formatNaira(row.amountMinor)}` : ''}
                          {row.minUnits != null
                            ? ` (min was ${formatUnitsLabel(row.minUnits)})`
                            : ''}
                        </Text>
                      ) : row.minUnits != null ? (
                        <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                          Min: {row.minUnits} unit{row.minUnits === 1 ? '' : 's'}
                        </Text>
                      ) : row.maxInvestmentAmountMinor != null ? (
                        <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                          Max: {formatNaira(row.maxInvestmentAmountMinor)}
                        </Text>
                      ) : null}
                      {row.minWaiverStatus === 'PENDING' ? (
                        <Badge label="Remnant pending" variant="accent" />
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
                            {
                              borderColor: palette.border,
                              backgroundColor: palette.surfaceMuted,
                              marginTop: 6,
                            },
                          ]}
                          data-testid={`message-investor-${row.id}`}
                          testID={`message-investor-${row.id}`}
                          accessibilityRole="button"
                          accessibilityLabel="Message this investor"
                        >
                          <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
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
                      {row.minWaiverStatus === 'PENDING' && canManageProjects(role) ? (
                        <View style={styles.inviteActions}>
                          <Button
                            title="Decline remnant"
                            size="sm"
                            variant="outlineDanger"
                            onPress={async () => {
                              try {
                                await rejectRemnant.mutateAsync(row.id);
                                pushToast({ type: 'info', message: 'Remnant pledge declined.' });
                                refetchInvites();
                              } catch (err) {
                                pushToast({
                                  type: 'error',
                                  message:
                                    err instanceof Error ? err.message : 'Decline failed',
                                });
                              }
                            }}
                            loading={rejectRemnant.isPending}
                            style={{ flex: 1 }}
                          />
                          <Button
                            title="Approve remnant"
                            size="sm"
                            onPress={async () => {
                              try {
                                await approveRemnant.mutateAsync(row.id);
                                pushToast({
                                  type: 'success',
                                  message: 'Remnant pledge approved — investor can pay.',
                                });
                                refetchInvites();
                              } catch (err) {
                                pushToast({
                                  type: 'error',
                                  message:
                                    err instanceof Error ? err.message : 'Approve failed',
                                });
                              }
                            }}
                            loading={approveRemnant.isPending}
                            style={{ flex: 1 }}
                          />
                        </View>
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
              canDeclare={
                !!canManageProjects(role) && project.createdBy?.id === user?.id
              }
              canProposeToLm={project.projectOwnerId === user?.id}
              canForwardProposal={
                (!!canManageProjects(role) && project.createdBy?.id === user?.id) ||
                role === 'CEO' ||
                role === 'ADMIN'
              }
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
          {tab === 'drawdowns' && !isInvestorRole && project.approvalStatus === 'APPROVED' && (
            <ProjectDrawdownsTab
              projectId={project.id}
              canRequest={project.projectOwnerId === user?.id}
              canDecide={
                project.createdBy?.id === user?.id || role === 'CEO' || role === 'ADMIN'
              }
            />
          )}
          {tab === 'withdrawals' &&
            !isInvestorRole &&
            !isProjectOwner(role) &&
            project.approvalStatus === 'APPROVED' && (
              <ProjectWithdrawalsTab
                projectId={project.id}
                canDecide={
                  project.createdBy?.id === user?.id || role === 'CEO' || role === 'ADMIN'
                }
              />
            )}
          {tab === 'audit' &&
            !isInvestorRole &&
            !isProjectOwner(role) &&
            project.approvalStatus === 'APPROVED' && (
            <ProjectAuditTab projectId={project.id} />
          )}
          {tab === 'reconciliation' &&
            !isInvestorRole &&
            !isProjectOwner(role) &&
            project.approvalStatus === 'APPROVED' && (
            <ProjectReconciliationTab projectId={project.id} />
          )}
          {tab === 'ledger' &&
            !isInvestorRole &&
            !isProjectOwner(role) &&
            project.approvalStatus === 'APPROVED' && (
            <ProjectLedgerTab projectId={project.id} />
          )}

          {tab === 'financials' && isInvestorRole && inviteStatus === 'CONFIRMED' && invite && (
            <View style={{ gap: spacing.md }}>
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
                unitsHeld={invite.unitsAllotted ?? invite.unitsPledged ?? 0}
                totalUnits={project.totalUnits ?? 0}
                unitPriceMinor={project.unitPriceMinor ?? 0}
              />
              <View
                style={[
                  styles.paymentBlock,
                  { borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: spacing.md },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: palette.text }]}>
                  Withdraw realised profit
                </Text>
                <Text style={[styles.helper, { color: palette.textSecondary }]}>
                  Available:{' '}
                  {withdrawable == null ? '…' : formatNaira(withdrawable)}. Prism approves and pays
                  out on request.
                </Text>
                <Button
                  title="Refresh available"
                  size="sm"
                  variant="outline"
                  onPress={async () => {
                    try {
                      const amt = await investorWithdrawableMinor(invite.id);
                      setWithdrawable(amt);
                    } catch (err) {
                      pushToast({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Could not load balance',
                      });
                    }
                  }}
                />
                <TextInput
                  label="Amount (₦)"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  keyboardType="decimal-pad"
                />
                <Button
                  title="Request withdrawal"
                  onPress={async () => {
                    try {
                      const minor = nairaToKobo(parseFloat(withdrawAmount) || 0);
                      await requestProfitWithdrawal(invite.id, minor);
                      setWithdrawAmount('');
                      const amt = await investorWithdrawableMinor(invite.id);
                      setWithdrawable(amt);
                      pushToast({
                        type: 'success',
                        message: 'Withdrawal requested — awaiting Prism.',
                      });
                    } catch (err) {
                      pushToast({
                        type: 'error',
                        message: err instanceof Error ? err.message : 'Withdrawal failed',
                      });
                    }
                  }}
                />
              </View>
            </View>
          )}
        </ScrollView>
        {splitLayout ? (
          <ProjectContextPanel
            projectId={project.id}
            raisedMinor={project.raisedMinor}
            targetMinor={project.targetMinor}
            totalUnits={unitRegister.total}
            unitsCommitted={unitRegister.committed}
            unitsAvailable={unitRegister.available}
            investorCount={unitRegister.investorCount}
            stage={project.stage}
            approvalStatus={project.approvalStatus}
            managerName={(project as any).manager?.fullName ?? project.createdBy?.full_name ?? null}
            createdAt={project.createdAt}
            investorRealisedMinor={profitMeta?.investorRealisedMinor ?? 0}
          />
        ) : null}
      </View>

      {isApprovalMode ? (
        <View
          style={[
            styles.footer,
            splitLayout ? styles.footerDesktop : null,
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
            splitLayout ? styles.footerDesktop : null,
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
  backBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 4,
  },
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
    // NOTE: no `alignItems: 'flex-start'` here — the ScrollView must stretch
    // to the row height to get a bounded viewport, otherwise it grows to its
    // content height and wheel/trackpad scrolling breaks on web.
  },
  splitMain: {
    flex: 1,
    // Without this the flex child can overflow past the context panel on web.
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 200,
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
  body: {
    flex: 1,
  },
  bodyText: { fontSize: typography.sizes.sm, lineHeight: 20 },
  helper: { fontSize: typography.sizes.xs, marginBottom: spacing.sm },
  paymentBlock: { marginBottom: spacing.lg, gap: spacing.sm },
  remnantBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  pledgeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pledgeModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
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
  // On the desktop split layout the footer only spans the main column,
  // leaving the context panel visible.
  footerDesktop: {
    right: CONTEXT_PANEL_WIDTH + spacing.md,
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
  briefBlock: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  briefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  briefListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
  },
});

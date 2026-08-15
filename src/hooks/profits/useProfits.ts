import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import {
  fetchProfitUpdates,
  postProfitUpdate,
  fetchInvestorProfitSummary,
  fetchManagerProfitSummary,
  fetchOwnerProfitSummary,
  fetchEarningBreakdown,
  fetchInvestorPayoutForInvite,
  fetchProjectProfitMeta,
  fetchAllProfitUpdates,
  endProjectNow,
} from '@/src/services/profits.services';

// Poll every 15 seconds so all interfaces see profit updates near-realtime
// without needing Supabase Realtime channels. React Query dedupes across
// mounts so this is cheap.
const PROFIT_POLL_MS = 15_000;

export function useProfitUpdates(projectId: string) {
  return useQuery({
    queryKey: queryKeys.profits.updates(projectId),
    queryFn: () => fetchProfitUpdates(projectId),
    enabled: !!projectId,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useProjectProfitMeta(projectId: string) {
  return useQuery({
    queryKey: ['profits', 'meta', projectId],
    queryFn: () => fetchProjectProfitMeta(projectId),
    enabled: !!projectId,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function usePostProfitUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; note: string }) =>
      postProfitUpdate(projectId, input.amountMinor, input.note),
    onSuccess: () => {
      // Invalidate every profit-adjacent query so all mounted screens
      // (LM home, investor home, portfolio, project detail) refetch
      // immediately instead of waiting for the next poll tick.
      qc.invalidateQueries({ queryKey: queryKeys.profits.updates(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
      qc.invalidateQueries({ queryKey: ['profits'] });
      qc.invalidateQueries({ queryKey: ['profits', 'meta', projectId] });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
    },
  });
}

export function useInvestorProfitSummary() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profits.investorSummary(user?.id ?? ''),
    queryFn: () => fetchInvestorProfitSummary(),
    enabled: !!user?.id,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useManagerProfitSummary() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profits.managerSummary(user?.id ?? ''),
    queryFn: () => fetchManagerProfitSummary(),
    enabled: !!user?.id,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useOwnerProfitSummary() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['profits', 'owner-summary', user?.id],
    queryFn: () => fetchOwnerProfitSummary(),
    enabled: !!user?.id,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useEarningBreakdown(kind: 'platform' | 'manager_share') {
  const { user } = useSession();
  return useQuery({
    queryKey: ['profits', 'earning-breakdown', kind, user?.id],
    queryFn: () => fetchEarningBreakdown(kind),
    enabled: !!user?.id,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useInvestorPayoutForInvite(inviteId: string) {
  return useQuery({
    queryKey: queryKeys.profits.payout(inviteId),
    queryFn: () => fetchInvestorPayoutForInvite(inviteId),
    enabled: !!inviteId,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useAllProfitUpdates(limit = 50) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['profits', 'all-updates', user?.id, limit],
    queryFn: () => fetchAllProfitUpdates(limit),
    enabled: !!user?.id,
    refetchInterval: PROFIT_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useEndProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endProjectNow(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
      qc.invalidateQueries({ queryKey: ['profits'] });
      qc.invalidateQueries({ queryKey: ['profits', 'meta', projectId] });
    },
  });
}

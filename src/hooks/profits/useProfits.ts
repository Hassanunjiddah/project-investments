import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import {
  fetchProfitUpdates,
  postProfitUpdate,
  fetchInvestorProfitSummary,
  fetchManagerProfitSummary,
  fetchInvestorPayoutForInvite,
  fetchProjectProfitMeta,
} from '@/src/services/profits.services';

export function useProfitUpdates(projectId: string) {
  return useQuery({
    queryKey: queryKeys.profits.updates(projectId),
    queryFn: () => fetchProfitUpdates(projectId),
    enabled: !!projectId,
  });
}

export function useProjectProfitMeta(projectId: string) {
  return useQuery({
    queryKey: ['profits', 'meta', projectId],
    queryFn: () => fetchProjectProfitMeta(projectId),
    enabled: !!projectId,
  });
}

export function usePostProfitUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { amountMinor: number; note: string }) =>
      postProfitUpdate(projectId, input.amountMinor, input.note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profits.updates(projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
      qc.invalidateQueries({ queryKey: ['profits'] });
      qc.invalidateQueries({ queryKey: ['profits', 'meta', projectId] });
    },
  });
}

export function useInvestorProfitSummary() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profits.investorSummary(user?.id ?? ''),
    queryFn: () => fetchInvestorProfitSummary(),
    enabled: !!user?.id,
  });
}

export function useManagerProfitSummary() {
  const { user } = useSession();
  return useQuery({
    queryKey: queryKeys.profits.managerSummary(user?.id ?? ''),
    queryFn: () => fetchManagerProfitSummary(),
    enabled: !!user?.id,
  });
}

export function useInvestorPayoutForInvite(inviteId: string) {
  return useQuery({
    queryKey: queryKeys.profits.payout(inviteId),
    queryFn: () => fetchInvestorPayoutForInvite(inviteId),
    enabled: !!inviteId,
  });
}

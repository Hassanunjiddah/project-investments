import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import {
  decideFundingRound,
  fetchFundingRounds,
  fetchPendingFundingRounds,
  requestFundingRound,
  type FundingRoundDoc,
} from '@/src/services/fundingRounds.services';

export function useFundingRounds(projectId: string) {
  return useQuery({
    queryKey: queryKeys.fundingRounds.byProject(projectId),
    queryFn: () => fetchFundingRounds(projectId),
    enabled: !!projectId,
  });
}

export function usePendingFundingRounds(enabled = true) {
  return useQuery({
    queryKey: queryKeys.fundingRounds.pending(),
    queryFn: fetchPendingFundingRounds,
    enabled,
    refetchInterval: 45_000,
    retry: false,
  });
}

export function useRequestFundingRound(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      additionalUnits: number;
      reason: string;
      costLineIds?: string[];
      doc?: FundingRoundDoc | null;
    }) => {
      try {
        return await requestFundingRound({ projectId, ...input });
      } catch (e) {
        throw normalizeError(e);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.fundingRounds.byProject(projectId) });
      void qc.invalidateQueries({ queryKey: queryKeys.fundingRounds.pending() });
      void qc.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
    },
  });
}

export function useDecideFundingRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      roundId: string;
      status: 'APPROVED' | 'REJECTED';
      note?: string;
      projectId?: string;
    }) => {
      try {
        return await decideFundingRound(input);
      } catch (e) {
        throw normalizeError(e);
      }
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.fundingRounds.pending() });
      if (vars.projectId) {
        void qc.invalidateQueries({ queryKey: queryKeys.fundingRounds.byProject(vars.projectId) });
        void qc.invalidateQueries({ queryKey: queryKeys.projects.byId(vars.projectId) });
        void qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
      }
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveDeclaration,
  declareProfit,
  fetchPendingDeclarations,
  fetchProjectDeclarations,
  rejectDeclaration,
} from '@/src/services/profitDeclarations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';

const POLL_MS = 15000;

export function useProjectDeclarations(projectId: string) {
  return useQuery({
    queryKey: ['declarations', 'project', projectId],
    queryFn: () => fetchProjectDeclarations(projectId),
    enabled: !!projectId,
    refetchInterval: POLL_MS,
  });
}

export function usePendingDeclarations() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['declarations', 'pending', user?.id],
    queryFn: fetchPendingDeclarations,
    enabled: !!user?.id,
    refetchInterval: POLL_MS,
  });
}

export function useDeclareProfit(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: declareProfit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['declarations', 'project', projectId] });
      qc.invalidateQueries({ queryKey: ['declarations', 'pending'] });
    },
  });
}

export function useApproveDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: approveDeclaration,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['declarations'] });
      qc.invalidateQueries({ queryKey: queryKeys.projects.byId(data.projectId) });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all() });
      qc.invalidateQueries({ queryKey: ['profits'] });
    },
  });
}

export function useRejectDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => rejectDeclaration(id, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['declarations'] });
    },
  });
}

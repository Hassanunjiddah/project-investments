import { useQuery } from '@tanstack/react-query';
import {
  fetchInvestorNotices,
  fetchProjectAudit,
  fetchReconciliation,
} from '@/src/services/transparency.services';
import { useSession } from '@/src/hooks/auth/useSession';

const POLL_MS = 45_000;

export function useInvestorNotices() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['transparency', 'notices', user?.id],
    queryFn: fetchInvestorNotices,
    enabled: !!user?.id,
    refetchInterval: POLL_MS,
  });
}

export function useProjectAudit(projectId: string) {
  return useQuery({
    queryKey: ['transparency', 'audit', projectId],
    queryFn: () => fetchProjectAudit(projectId),
    enabled: !!projectId,
    refetchInterval: POLL_MS,
  });
}

export function useReconciliation(projectId: string) {
  return useQuery({
    queryKey: ['transparency', 'reconciliation', projectId],
    queryFn: () => fetchReconciliation(projectId),
    enabled: !!projectId,
    refetchInterval: POLL_MS,
  });
}

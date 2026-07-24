import { useQuery } from '@tanstack/react-query';
import { fetchProjectLedger } from '@/src/services/ledger.services';

export function useProjectLedger(projectId: string) {
  return useQuery({
    queryKey: ['ledger', projectId],
    queryFn: () => fetchProjectLedger(projectId),
    enabled: !!projectId,
    refetchInterval: 30000,
  });
}

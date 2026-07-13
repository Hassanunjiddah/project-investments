import { useQuery } from '@tanstack/react-query';
import { fetchPendingProjects } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import { useStatsStore } from '@/src/store/useStatsStore';

export function useFetchPendingProjects(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.list({ status: 'PENDING' }),
    queryFn: async () => {
      try {
        const projects = await fetchPendingProjects();
        useStatsStore.setState((s) => ({
          stats: {
            ...s.stats,
            pendingApprovals: projects.count,
          },
        }));
        return projects;
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled,
  });
}

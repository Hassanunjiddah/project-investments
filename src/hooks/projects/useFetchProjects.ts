import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProjects } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import { ApprovalStatus } from '@/src/types/project.types';
import { ListRequest } from '@/src/types/list.types';
import { useStatsStore } from '@/src/store/useStatsStore';

export function useFetchProjects(props?: ListRequest<{ status?: ApprovalStatus }>) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: queryKeys.projects.list(props),
    queryFn: async () => {
      try {
        const projects = await fetchProjects(props);
        if (props?.status === 'PENDING') {
          useStatsStore.setState((s) => ({
            stats: {
              ...s.stats,
              pendingApprovals: projects.count,
            },
          }));
        }
        qc.setQueryData(queryKeys.projects.all(), projects);
        return projects;
      } catch (error) {
        throw normalizeError(error);
      }
    },
    // Polling: keeps project cards + stat totals + profit breakdown in sync
    // with peer dashboards near-realtime without Supabase Realtime channels.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import { ApprovalStatus } from '@/src/types/project.types';
import { ListRequest } from '@/src/types/list.types';
import { useStatsStore } from '@/src/store/useStatsStore';

export function useFetchProjects(
  props?: ListRequest<{ status?: ApprovalStatus; ownerId?: string }>,
) {
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
        return projects;
      } catch (error) {
        throw normalizeError(error);
      }
    },
    // Don't run owner-scoped list until we have an owner id (avoids unscoped flash).
    enabled: props?.ownerId !== undefined ? !!props.ownerId : true,
    // 45s is enough for list freshness without burning quota on every open tab.
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
  });
}

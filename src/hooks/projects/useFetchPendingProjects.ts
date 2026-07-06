import { useQuery } from '@tanstack/react-query';
import { fetchPendingProjects } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchPendingProjects(enabled = true) {
  return useQuery({
    queryKey: queryKeys.projects.pending(),
    queryFn: async () => {
      try {
        return await fetchPendingProjects();
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled,
  });
}

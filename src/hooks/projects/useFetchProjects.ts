import { useQuery } from '@tanstack/react-query';
import { fetchProjects } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchProjects() {
  return useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: async () => {
      try {
        return await fetchProjects();
      } catch (error) {
        throw normalizeError(error);
      }
    },
  });
}

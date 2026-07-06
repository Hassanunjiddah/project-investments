import { useQuery } from '@tanstack/react-query';
import { fetchProjectById } from '@/src/services/projects.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchProjectById(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.byId(id),
    queryFn: async () => {
      try {
        return await fetchProjectById(id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!id,
  });
}

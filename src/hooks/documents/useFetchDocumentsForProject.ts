import { useQuery } from '@tanstack/react-query';
import { fetchDocumentsForProject } from '@/src/services/documents.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchDocumentsForProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.documents.forProject(projectId),
    queryFn: async () => {
      try {
        return await fetchDocumentsForProject(projectId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!projectId,
  });
}

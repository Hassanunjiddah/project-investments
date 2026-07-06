import { useQuery } from '@tanstack/react-query';
import { fetchInvitesForProject } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchInvitesForProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.invitations.forProject(projectId),
    queryFn: async () => {
      try {
        return await fetchInvitesForProject(projectId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!projectId,
  });
}

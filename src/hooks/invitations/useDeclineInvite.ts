import { useMutation, useQueryClient } from '@tanstack/react-query';
import { declineInvite } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useDeclineInvite(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await declineInvite(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { declineInvite } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useDeclineInvite(projectId?: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await declineInvite(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, inviteId) => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
      }
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forUser(user.id) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.detail(inviteId) });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
    },
  });
}

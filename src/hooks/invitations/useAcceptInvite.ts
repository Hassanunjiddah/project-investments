import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acceptInvite } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useAcceptInvite() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await acceptInvite(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, inviteId) => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.invitations.forUser(user.id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.detail(inviteId),
      });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
    },
  });
}

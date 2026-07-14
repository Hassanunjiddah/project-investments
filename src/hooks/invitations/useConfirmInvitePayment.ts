import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmInvitePayment } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useConfirmInvitePayment(projectId: string) {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await confirmInvitePayment(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.forUser(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.forUser(user.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.list(user.id) });
      }
    },
  });
}

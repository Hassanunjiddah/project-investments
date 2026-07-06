import { useMutation, useQueryClient } from '@tanstack/react-query';
import { confirmInvitePayment } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useConfirmInvitePayment(projectId: string) {
  const queryClient = useQueryClient();

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
    },
  });
}

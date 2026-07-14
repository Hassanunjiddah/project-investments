import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commitInvestment } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useCommitInvestment() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteId, amountMinor }: { inviteId: string; amountMinor: number }) => {
      try {
        return await commitInvestment(inviteId, amountMinor);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, variables) => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.invitations.forUser(user.id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.detail(variables.inviteId),
      });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
    },
  });
}

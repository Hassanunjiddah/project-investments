import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pledgeUnits } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

/**
 * Prism unit-model pledge — investor picks whole units. Server computes
 * amount, generates payment reference, sets 72h expiry.
 */
export function usePledgeUnits() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inviteId, units }: { inviteId: string; units: number }) => {
      try {
        return await pledgeUnits(inviteId, units);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, variables) => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forUser(user.id) });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.detail(variables.inviteId),
      });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
    },
  });
}

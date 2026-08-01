import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pledgeByAmount, pledgeUnits } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

type PledgeInput =
  | { inviteId: string; units: number; amountMinor?: never }
  | { inviteId: string; amountMinor: number; units?: never };

function invalidatePledgeQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  inviteId: string,
) {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forUser(userId) });
  }
  queryClient.invalidateQueries({
    queryKey: queryKeys.invitations.detail(inviteId),
  });
  queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
}

/**
 * Prism unit-model pledge — by units (whole or fractional) or by ₦ amount.
 * Server generates payment reference and sets 72h expiry.
 */
export function usePledgeUnits() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PledgeInput) => {
      try {
        if ('amountMinor' in input && input.amountMinor != null) {
          return await pledgeByAmount(input.inviteId, input.amountMinor);
        }
        return await pledgeUnits(input.inviteId, input.units!);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, variables) => {
      invalidatePledgeQueries(queryClient, user?.id, variables.inviteId);
    },
  });
}

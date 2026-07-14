import { useQuery } from '@tanstack/react-query';
import { invokeGetInvitationDetail } from '@/src/services/edgeFunctions.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useGetInvitationDetail(inviteId: string) {
  return useQuery({
    queryKey: queryKeys.invitations.detail(inviteId),
    queryFn: async () => {
      try {
        return await invokeGetInvitationDetail({ inviteId });
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!inviteId,
  });
}

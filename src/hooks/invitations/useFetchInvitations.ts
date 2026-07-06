import { useQuery } from '@tanstack/react-query';
import { fetchInvitations } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchInvitations() {
  const { user } = useSession();

  return useQuery({
    queryKey: queryKeys.invitations.forUser(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await fetchInvitations(user.id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!user?.id,
  });
}

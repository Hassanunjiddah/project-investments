import { useQuery } from '@tanstack/react-query';
import { fetchProfile } from '@/src/services/profile.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchProfile() {
  const { user } = useSession();

  return useQuery({
    queryKey: queryKeys.profile.byId(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await fetchProfile(user.id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!user?.id,
  });
}

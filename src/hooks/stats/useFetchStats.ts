import { useQuery } from '@tanstack/react-query';
import { fetchManagerStats } from '@/src/services/stats.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchStats() {
  const { user } = useSession();

  return useQuery({
    queryKey: queryKeys.stats.forUser(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await fetchManagerStats(user.id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!user?.id,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

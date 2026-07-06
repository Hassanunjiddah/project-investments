import { useQuery } from '@tanstack/react-query';
import { fetchPortfolio } from '@/src/services/portfolio.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchPortfolio() {
  const { user } = useSession();

  return useQuery({
    queryKey: queryKeys.portfolio.forUser(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await fetchPortfolio(user.id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!user?.id,
  });
}

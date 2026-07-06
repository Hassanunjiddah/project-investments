import { useQuery } from '@tanstack/react-query';
import { fetchInvestors } from '@/src/services/profile.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchInvestors(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile.investors(),
    queryFn: async () => {
      try {
        return await fetchInvestors();
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled,
  });
}

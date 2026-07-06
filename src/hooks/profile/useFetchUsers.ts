import { useQuery } from '@tanstack/react-query';
import { fetchManagedUsers } from '@/src/services/profile.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profile.users(),
    queryFn: async () => {
      try {
        return await fetchManagedUsers();
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled,
  });
}

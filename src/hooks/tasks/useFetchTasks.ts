import { useQuery } from '@tanstack/react-query';
import { fetchTasks } from '@/src/services/tasks.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useFetchTasks() {
  const { user } = useSession();

  return useQuery({
    queryKey: queryKeys.tasks.list(user?.id ?? ''),
    queryFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await fetchTasks(user.id);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled: !!user?.id,
  });
}

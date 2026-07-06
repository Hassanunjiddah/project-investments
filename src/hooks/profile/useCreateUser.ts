import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeCreateUser, type CreateUserEdgeInput } from '@/src/services/edgeFunctions.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserEdgeInput) => {
      try {
        return await invokeCreateUser(input);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.investors() });
    },
  });
}

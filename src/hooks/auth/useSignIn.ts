import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signInWithPassword } from '@/src/services/auth.services';
import { queryKeys } from '@/src/constants/query-keys';
import type { SignInInput } from '@/src/types/auth.types';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SignInInput) => {
      try {
        return await signInWithPassword(input);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (session) => {
      if (session.user) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.profile.byId(session.user.id),
        });
      }
    },
  });
}

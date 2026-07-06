import { useMutation, useQueryClient } from '@tanstack/react-query';
import { signOut } from '@/src/services/auth.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useSignOut() {
  const queryClient = useQueryClient();
  const reset = useAuthStore((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      try {
        await signOut();
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      reset();
      queryClient.clear();
    },
  });
}

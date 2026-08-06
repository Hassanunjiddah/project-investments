import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { signOut } from '@/src/services/auth.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { normalizeError } from '@/src/helpers/supabaseError';

/**
 * Sign out: navigate to sign-in immediately, then clear the session so the
 * UI never sits on a half-torn-down tabs shell.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  const reset = useAuthStore((s) => s.reset);
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      router.replace('/sign-in' as never);
      try {
        await signOut();
      } catch (error) {
        // Still clear local state even if the network call fails.
        throw normalizeError(error);
      }
    },
    onSettled: () => {
      reset();
      queryClient.clear();
      router.replace('/sign-in' as never);
    },
  });
}

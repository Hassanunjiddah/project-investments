import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/src/services/profile.services';
import { queryKeys } from '@/src/constants/query-keys';
import type { ProfileUpdate } from '@/src/types/profile.types';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useUpdateProfile() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: ProfileUpdate) => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await updateProfile(user.id, patch);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.byId(user.id) });
      }
    },
  });
}

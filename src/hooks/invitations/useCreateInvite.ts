import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInvite } from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useCreateInvite(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; minUnits?: number }) => {
      try {
        return await createInvite({ projectId, ...input });
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
    },
  });
}

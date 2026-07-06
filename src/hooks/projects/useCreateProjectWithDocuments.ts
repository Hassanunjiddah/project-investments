import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProjectWithDocuments } from '@/src/services/createProject.services';
import type { CreateProjectDraftInput } from '@/src/services/createProject.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useCreateProjectWithDocuments() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draft,
      onProgress,
    }: {
      draft: CreateProjectDraftInput;
      onProgress?: (message: string) => void;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      try {
        return await createProjectWithDocuments(draft, user.id, onProgress);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
    },
  });
}

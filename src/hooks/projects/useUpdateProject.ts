import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProject } from '@/src/services/projects.services';
import type { UpdateProjectInput } from '@/src/types/project.types';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: UpdateProjectInput) => {
      try {
        return await updateProject(projectId, patch);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decideProject } from '@/src/services/projects.services';
import type { ApprovalStatus } from '@/src/types/project.types';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useDecideProject(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (props: { status: ApprovalStatus; projectId?: string }) => {
      const id = props.projectId || projectId;
      if (!id) {
        throw new Error('Project ID is required');
      }
      try {
        return await decideProject(id, props.status);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
      }
    },
  });
}

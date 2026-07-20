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
    onSuccess: (_, variables) => {
      const id = variables.projectId || projectId;
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(id) });
      }
      // Refresh stats + tasks (CEO approvals badge / pending count)
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

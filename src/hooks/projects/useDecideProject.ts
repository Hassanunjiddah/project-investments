import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decideProject } from '@/src/services/projects.services';
import type { ApprovalStatus } from '@/src/types/project.types';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useDecideProject(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (approvalStatus: ApprovalStatus) => {
      try {
        return await decideProject(projectId, approvalStatus);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.pending() });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.byId(projectId) });
    },
  });
}

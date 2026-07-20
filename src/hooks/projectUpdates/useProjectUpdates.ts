import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProjectUpdates,
  postProjectUpdate,
  type PostUpdateInput,
} from '@/src/services/projectUpdates.services';
import type { ProjectUpdateKind } from '@/src/types/projectUpdate.types';

const key = (projectId: string, kind?: ProjectUpdateKind) =>
  ['projectUpdates', projectId, kind ?? 'all'] as const;

export function useProjectUpdates(projectId: string, kind?: ProjectUpdateKind) {
  return useQuery({
    queryKey: key(projectId, kind),
    queryFn: () => fetchProjectUpdates(projectId, kind),
    enabled: !!projectId,
  });
}

export function usePostProjectUpdate(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<PostUpdateInput, 'projectId'>) =>
      postProjectUpdate({ ...input, projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projectUpdates', projectId] });
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadProjectDocument, type UploadDocumentInput } from '@/src/services/documents.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useUploadDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<UploadDocumentInput, 'projectId'>) => {
      try {
        return await uploadProjectDocument({ ...input, projectId });
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.forProject(projectId) });
      queryClient.invalidateQueries({ queryKey: ['transparency', 'audit', projectId] });
    },
  });
}

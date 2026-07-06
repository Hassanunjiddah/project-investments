import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteProjectDocument } from '@/src/services/documents.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, storagePath }: { docId: string; storagePath: string }) => {
      try {
        await deleteProjectDocument(docId, storagePath);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.forProject(projectId) });
    },
  });
}

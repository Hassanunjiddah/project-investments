import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invokeSubmitPaymentProof } from '@/src/services/edgeFunctions.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

export function useSubmitPaymentProof() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inviteId,
      uri,
      fileName,
      mimeType,
      file,
    }: {
      inviteId: string;
      uri: string;
      fileName: string;
      mimeType: string;
      file?: File | Blob;
    }) => {
      try {
        return await invokeSubmitPaymentProof(inviteId, uri, fileName, mimeType, file);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, variables) => {
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.invitations.forUser(user.id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.detail(variables.inviteId),
      });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'lookup'] });
    },
  });
}

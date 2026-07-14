import { useQuery } from '@tanstack/react-query';
import {
  fetchInvite,
  inviteLookupKey,
  type FetchInviteParams,
} from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';

function isEnabled(params: FetchInviteParams | null | undefined): boolean {
  if (!params) return false;
  if ('inviteId' in params) return !!params.inviteId;
  return !!params.userId && !!params.projectId;
}

/** Fetch an invite by invitation id, or by (userId + projectId). */
export function useFetchInvitation(params: FetchInviteParams | null) {
  const enabled = isEnabled(params);
  const key = params && enabled ? inviteLookupKey(params) : '';

  return useQuery({
    queryKey: queryKeys.invitations.lookup(key),
    queryFn: async () => {
      try {
        return await fetchInvite(params as FetchInviteParams);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    enabled,
  });
}

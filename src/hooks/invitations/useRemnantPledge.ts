import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  approveRemnantPledge,
  rejectRemnantPledge,
  requestRemnantPledge,
} from '@/src/services/invitations.services';
import { queryKeys } from '@/src/constants/query-keys';
import { useSession } from '@/src/hooks/auth/useSession';
import { normalizeError } from '@/src/helpers/supabaseError';

function invalidate(queryClient: ReturnType<typeof useQueryClient>, userId: string | undefined, inviteId: string) {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forUser(userId) });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.invitations.detail(inviteId) });
  queryClient.invalidateQueries({ queryKey: ['invitations'] });
  queryClient.invalidateQueries({ queryKey: ['tasks'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() });
}

export function useRequestRemnantPledge() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { inviteId: string; units: number }) => {
      try {
        return await requestRemnantPledge(input.inviteId, input.units);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, variables) => {
      invalidate(queryClient, user?.id, variables.inviteId);
    },
  });
}

export function useApproveRemnantPledge(projectId: string) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await approveRemnantPledge(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, inviteId) => {
      invalidate(queryClient, user?.id, inviteId);
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
    },
  });
}

export function useRejectRemnantPledge(projectId: string) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      try {
        return await rejectRemnantPledge(inviteId);
      } catch (error) {
        throw normalizeError(error);
      }
    },
    onSuccess: (_data, inviteId) => {
      invalidate(queryClient, user?.id, inviteId);
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.forProject(projectId) });
    },
  });
}

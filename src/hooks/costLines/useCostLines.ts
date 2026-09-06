import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import {
  createCostLine,
  deleteCostLine,
  fetchCostLines,
  updateCostLine,
} from '@/src/services/costLines.services';
import type { CostLineFormValues } from '@/src/schemas/costLine.schema';

export function useCostLines(projectId: string) {
  return useQuery({
    queryKey: queryKeys.costLines.byProject(projectId),
    queryFn: () => fetchCostLines(projectId),
    enabled: !!projectId,
  });
}

export function useCreateCostLine(projectId: string, userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: CostLineFormValues) => {
      try {
        return await createCostLine(projectId, userId, values);
      } catch (e) {
        throw normalizeError(e);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.costLines.byProject(projectId) });
    },
  });
}

export function useUpdateCostLine(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<CostLineFormValues> }) => {
      try {
        return await updateCostLine(id, values);
      } catch (e) {
        throw normalizeError(e);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.costLines.byProject(projectId) });
    },
  });
}

export function useDeleteCostLine(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await deleteCostLine(id);
      } catch (e) {
        throw normalizeError(e);
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.costLines.byProject(projectId) });
    },
  });
}

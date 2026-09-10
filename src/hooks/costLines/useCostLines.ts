import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import {
  createCostLine,
  deleteCostLine,
  fetchCostLines,
  updateCostLine,
  type CostLineDoc,
} from '@/src/services/costLines.services';
import type { CostLineFormValues } from '@/src/schemas/costLine.schema';
import type { ProjectCostLine } from '@/src/services/costLines.services';

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
    mutationFn: async ({ values, doc }: { values: CostLineFormValues; doc?: CostLineDoc | null }) => {
      try {
        return await createCostLine(projectId, userId, values, doc);
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
    mutationFn: async ({
      id,
      values,
      doc,
    }: {
      id: string;
      values: Partial<CostLineFormValues>;
      doc?: CostLineDoc | null;
    }) => {
      try {
        return await updateCostLine(id, values, doc);
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
  const key = queryKeys.costLines.byProject(projectId);
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        await deleteCostLine(id);
      } catch (e) {
        throw normalizeError(e);
      }
    },
    // Optimistic: drop the row immediately, restore the snapshot on failure.
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ProjectCostLine[]>(key);
      qc.setQueryData<ProjectCostLine[]>(key, (lines) =>
        (lines ?? []).filter((line) => line.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { fetchProjectNavSeries, type NavSeriesPoint } from '@/src/services/nav.services';

/**
 * NAV/unit series for a single project — auto-caches for 30s and
 * invalidated by the existing profit-declaration realtime channel
 * (see `useProfitDeclarationsRealtime`).
 */
export function useProjectNavSeries(projectId: string | undefined) {
  return useQuery<NavSeriesPoint[]>({
    queryKey: ['project-nav-series', projectId],
    queryFn: () => fetchProjectNavSeries(projectId ?? ''),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

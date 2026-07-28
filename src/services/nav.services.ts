import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type NavSeriesPoint = {
  at: string;
  navPerUnitMinor: number;
  label: string;
};

/**
 * Fetches the NAV/unit series for a project — one point at inception
 * (entry price) and one point per APPROVED profit declaration.
 *
 * Used by the investor Home sparkline on PositionCard. Auto-updates
 * because TanStack Query invalidates the `project-nav-series` key on
 * declaration realtime events (see `useProjectNavSeries`).
 */
export async function fetchProjectNavSeries(
  projectId: string,
  limit = 32,
): Promise<NavSeriesPoint[]> {
  if (!projectId) return [];
  const { data, error } = await (supabase.rpc as any)('get_project_nav_series', {
    p_project_id: projectId,
    p_limit: limit,
  });
  if (error) {
    // Missing function on old DBs → soft-fail with empty series so the
    // sparkline gracefully collapses.
    if ((error as any).code === 'PGRST202' || (error as any).code === '42883') {
      return [];
    }
    throw normalizeError(error);
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    at: String(r.at ?? ''),
    navPerUnitMinor: Number(r.nav_per_unit_minor ?? 0),
    label: String(r.label ?? ''),
  }));
}

import type { ManagerHomeStats } from '@/src/types/stats.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export async function fetchManagerStats(userId: string): Promise<ManagerHomeStats> {
  const [projectsRes, invitesRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, raised_minor, estimated_roi_bps')
      .eq('created_by', userId),
    supabase
      .from('invites')
      .select('investor_id, status, projects!inner(created_by)')
      .eq('projects.created_by', userId)
      .neq('status', 'DECLINED'),
  ]);

  if (projectsRes.error) throw normalizeError(projectsRes.error);
  if (invitesRes.error) throw normalizeError(invitesRes.error);

  const projects = projectsRes.data ?? [];
  const invites = invitesRes.data ?? [];

  const totalRaisedKobo = projects.reduce((sum, p) => sum + (p.raised_minor ?? 0), 0);
  const projectedProfitKobo = projects.reduce((sum, p) => {
    const raised = p.raised_minor ?? 0;
    const roiBps = p.estimated_roi_bps ?? 0;
    return sum + Math.round((raised * roiBps) / 10000);
  }, 0);

  const investorIds = new Set(invites.map((row) => row.investor_id).filter(Boolean));

  return {
    totalProjects: projects.length,
    totalRaisedKobo,
    activeInvestors: investorIds.size,
    projectedProfitKobo,
  };
}

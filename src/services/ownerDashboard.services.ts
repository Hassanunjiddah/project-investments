import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import { fetchProjects } from '@/src/services/projects.services';
import type { Project } from '@/src/types/project.types';

export type OwnerDashboardStats = {
  projectCount: number;
  inProgressCount: number;
  totalRaisedMinor: number;
  totalTargetMinor: number;
  pendingDrawdowns: number;
  proposedProfits: number;
};

/** Projects the current user owns as originator (`project_owner_id`). */
export async function fetchOwnerProjects(ownerId: string): Promise<Project[]> {
  if (!ownerId) return [];
  const result = await fetchProjects({ ownerId, limit: 100 });
  return result.data;
}

export async function fetchOwnerDashboardStats(ownerId: string): Promise<OwnerDashboardStats> {
  if (!ownerId) {
    return {
      projectCount: 0,
      inProgressCount: 0,
      totalRaisedMinor: 0,
      totalTargetMinor: 0,
      pendingDrawdowns: 0,
      proposedProfits: 0,
    };
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, stage, target_minor, raised_minor, approval_status')
    .eq('project_owner_id', ownerId)
    .neq('approval_status', 'REJECTED');
  if (error) throw normalizeError(error);

  const rows = projects ?? [];
  const projectIds = rows.map((p) => p.id);

  let pendingDrawdowns = 0;
  let proposedProfits = 0;

  if (projectIds.length > 0) {
    const [dd, pd] = await Promise.all([
      supabase
        .from('fund_drawdowns')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'PENDING'),
      supabase
        .from('profit_declarations')
        .select('id', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'PROPOSED'),
    ]);
    pendingDrawdowns = dd.count ?? 0;
    proposedProfits = pd.count ?? 0;
  }

  return {
    projectCount: rows.length,
    inProgressCount: rows.filter((p) => p.stage === 'PROGRESS').length,
    totalRaisedMinor: rows.reduce((s, p) => s + (p.raised_minor ?? 0), 0),
    totalTargetMinor: rows.reduce((s, p) => s + (p.target_minor ?? 0), 0),
    pendingDrawdowns,
    proposedProfits,
  };
}

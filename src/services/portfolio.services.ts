import type { PortfolioEntry, PortfolioStats } from '@/src/types/portfolio.types';
import type { ProjectStage } from '@/src/types/project.types';
import { supabase } from '@/src/services/supabase';
import { getProjectBannerUrl } from '@/src/services/banner.services';
import { normalizeError } from '@/src/helpers/supabaseError';
import { fetchInvestorProfitSummary } from '@/src/services/profits.services';

type PortfolioRow = {
  id: string;
  amount_minor: number | null;
  projected_profit_minor: number | null;
  project_id: string;
  projects: {
    name: string;
    sector: string;
    stage: string;
    banner_storage_path: string | null;
    estimated_roi_bps: number;
    target_minor: number;
    raised_minor: number;
  } | null;
};

function projectedFromRoi(amountMinor: number, estimatedRoiBps: number): number {
  return Math.round((amountMinor * estimatedRoiBps) / 10000);
}

function mapRow(row: PortfolioRow, realisedByProject: Map<string, number>): PortfolioEntry {
  const project = row.projects;
  const amount = row.amount_minor ?? 0;
  const roiBps = project?.estimated_roi_bps ?? 0;
  const target = project?.target_minor ?? 0;
  const raised = project?.raised_minor ?? 0;
  const stage = (project?.stage ?? 'PROGRESS') as ProjectStage;
  const progressPct =
    target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  const realised = realisedByProject.get(row.project_id) ?? 0;

  return {
    id: row.id,
    projectId: row.project_id,
    projectName: project?.name ?? 'Unknown Project',
    projectSector: project?.sector,
    projectBannerUrl: getProjectBannerUrl(project?.banner_storage_path),
    projectStage: stage,
    capitalKobo: amount,
    projectedReturnKobo: projectedFromRoi(amount, roiBps),
    realisedReturnKobo: realised,
    estimatedRoiBps: roiBps,
    progressPct,
    status: stage === 'END' ? 'completed' : 'active',
  };
}

export async function fetchPortfolio(userId: string): Promise<PortfolioEntry[]> {
  const [holdingsRes, profitSummary] = await Promise.all([
    supabase
      .from('invites')
      .select(
        'id, amount_minor, projected_profit_minor, project_id, projects(name, sector, stage, banner_storage_path, estimated_roi_bps, target_minor, raised_minor)',
      )
      .eq('investor_id', userId)
      .eq('status', 'CONFIRMED')
      .order('updated_at', { ascending: false }),
    fetchInvestorProfitSummary().catch(() => []),
  ]);

  if (holdingsRes.error) throw normalizeError(holdingsRes.error);

  const realisedByProject = new Map<string, number>();
  for (const row of profitSummary) {
    realisedByProject.set(row.projectId, row.investorShareMinor);
  }

  return (holdingsRes.data ?? []).map((row) => mapRow(row as PortfolioRow, realisedByProject));
}

export function computePortfolioStats(entries: PortfolioEntry[]): PortfolioStats {
  const investedKobo = entries.reduce((sum, e) => sum + e.capitalKobo, 0);
  const projectedProfitKobo = entries.reduce((sum, e) => sum + e.projectedReturnKobo, 0);
  const realisedProfitKobo = entries.reduce((sum, e) => sum + (e.realisedReturnKobo ?? 0), 0);
  return {
    investedKobo,
    projectedProfitKobo,
    portfolioValueKobo: investedKobo + projectedProfitKobo,
    realisedProfitKobo,
  };
}

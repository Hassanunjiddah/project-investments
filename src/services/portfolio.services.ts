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
  units_allotted: number | null;
  projects: {
    name: string;
    sector: string;
    stage: string;
    banner_storage_path: string | null;
    estimated_roi_bps: number;
    target_minor: number;
    raised_minor: number;
    total_units: number | null;
    profit_split_investor_bps: number | null;
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

  const unitsHeld = Number(row.units_allotted ?? 0);
  const totalUnits = project?.total_units ?? 0;
  const unitPriceMinor =
    unitsHeld > 0 && amount > 0
      ? Math.round(amount / unitsHeld)
      : totalUnits > 0 && (project?.target_minor ?? 0) > 0
        ? Math.floor((project?.target_minor ?? 0) / totalUnits)
        : 0;
  // Per-unit realised profit for THIS investor's position, blended across
  // their units. Realised comes from distribution notices (time-based), so
  // units pledged after a declaration dilute this personal figure but never
  // claim past profit.
  const perUnitProfitMinor = unitsHeld > 0 ? Math.round(realised / unitsHeld) : 0;
  const navPerUnitMinor = unitPriceMinor + perUnitProfitMinor;
  const positionValueMinor = amount + realised;
  const pnlMinor = positionValueMinor - amount;
  const pnlBps = amount > 0 ? Math.round((pnlMinor / amount) * 10000) : 0;
  const ownershipPct =
    totalUnits > 0 && unitsHeld > 0 ? (unitsHeld / totalUnits) * 100 : 0;
  const profitSplitInvestorPct =
    project?.profit_split_investor_bps != null
      ? project.profit_split_investor_bps / 100
      : undefined;

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
    unitsHeld,
    totalUnits: totalUnits > 0 ? totalUnits : undefined,
    ownershipPct: ownershipPct > 0 ? ownershipPct : undefined,
    profitSplitInvestorPct,
    projectTargetMinor: target > 0 ? target : undefined,
    unitPriceMinor,
    navPerUnitMinor,
    positionValueMinor,
    pnlMinor,
    pnlBps,
  };
}

export async function fetchPortfolio(userId: string): Promise<PortfolioEntry[]> {
  const [holdingsRes, profitSummary] = await Promise.all([
    supabase
      .from('invites')
      .select(
        'id, amount_minor, projected_profit_minor, project_id, units_allotted, projects(name, sector, stage, banner_storage_path, estimated_roi_bps, target_minor, raised_minor, total_units, profit_split_investor_bps)',
      )
      .eq('investor_id', userId)
      .eq('status', 'CONFIRMED')
      .order('updated_at', { ascending: false }),
    fetchInvestorProfitSummary(),
  ]);

  if (holdingsRes.error) throw normalizeError(holdingsRes.error);

  const realisedByProject = new Map<string, number>();
  for (const row of profitSummary) {
    realisedByProject.set(
      row.projectId,
      (realisedByProject.get(row.projectId) ?? 0) + row.investorShareMinor,
    );
  }

  const mapped = (holdingsRes.data ?? []).map((row) =>
    mapRow(row as unknown as PortfolioRow, realisedByProject),
  );
  const byProject = new Map<string, PortfolioEntry>();
  for (const entry of mapped) {
    const existing = byProject.get(entry.projectId);
    if (!existing) {
      byProject.set(entry.projectId, { ...entry });
      continue;
    }
    existing.capitalKobo += entry.capitalKobo;
    existing.unitsHeld += entry.unitsHeld;
    existing.projectedReturnKobo += entry.projectedReturnKobo;
    existing.positionValueMinor = existing.capitalKobo + (existing.realisedReturnKobo ?? 0);
    existing.pnlMinor = existing.positionValueMinor - existing.capitalKobo;
    existing.pnlBps =
      existing.capitalKobo > 0
        ? Math.round((existing.pnlMinor / existing.capitalKobo) * 10000)
        : 0;
    existing.ownershipPct =
      (existing.totalUnits ?? 0) > 0
        ? (existing.unitsHeld / (existing.totalUnits ?? 1)) * 100
        : existing.ownershipPct;
  }
  return [...byProject.values()];
}

export function computePortfolioStats(entries: PortfolioEntry[]): PortfolioStats {
  const investedKobo = entries.reduce((sum, e) => sum + e.capitalKobo, 0);
  const projectedProfitKobo = entries.reduce((sum, e) => sum + e.projectedReturnKobo, 0);
  const realisedProfitKobo = entries.reduce((sum, e) => sum + (e.realisedReturnKobo ?? 0), 0);
  // Portfolio value is now mark-to-market: capital + realised (net) profit,
  // NOT forward-looking projected profit. Matches the user's mental model:
  // "1 unit = ₦1,200 after a ₦1,000 declaration" (with fees applied).
  const portfolioValueKobo = investedKobo + realisedProfitKobo;
  const pnlBps = investedKobo > 0 ? Math.round((realisedProfitKobo / investedKobo) * 10000) : 0;
  const totalUnitsHeld = entries.reduce((sum, e) => sum + (e.unitsHeld ?? 0), 0);
  // One headline percentage per investor: units-weighted effective share of
  // declared profit = ownership of the unit pool × investor pool split.
  // Dilutes automatically when an approved raise increases total units.
  const shareWeight = entries.reduce((sum, e) => {
    if (!(e.unitsHeld > 0) || e.ownershipPct == null || e.profitSplitInvestorPct == null)
      return sum;
    return sum + e.unitsHeld * ((e.ownershipPct * e.profitSplitInvestorPct) / 100);
  }, 0);
  const shareUnits = entries.reduce((sum, e) => {
    if (!(e.unitsHeld > 0) || e.ownershipPct == null || e.profitSplitInvestorPct == null)
      return sum;
    return sum + e.unitsHeld;
  }, 0);
  const effectiveProfitSharePct = shareUnits > 0 ? shareWeight / shareUnits : undefined;
  // Investors' collective 70/30-style split, units-weighted across positions.
  const poolWeight = entries.reduce((sum, e) => {
    if (!(e.unitsHeld > 0) || e.profitSplitInvestorPct == null) return sum;
    return sum + e.unitsHeld * e.profitSplitInvestorPct;
  }, 0);
  const poolUnits = entries.reduce((sum, e) => {
    if (!(e.unitsHeld > 0) || e.profitSplitInvestorPct == null) return sum;
    return sum + e.unitsHeld;
  }, 0);
  const investorPoolPct = poolUnits > 0 ? poolWeight / poolUnits : undefined;
  // entries are already deduped per project, so this never double-counts.
  const totalProjectCapitalKobo = entries.reduce(
    (sum, e) => sum + (e.projectTargetMinor ?? 0),
    0,
  );
  return {
    investedKobo,
    projectedProfitKobo,
    portfolioValueKobo,
    realisedProfitKobo,
    pnlBps,
    totalUnitsHeld,
    effectiveProfitSharePct,
    investorPoolPct,
    totalProjectCapitalKobo,
  };
}

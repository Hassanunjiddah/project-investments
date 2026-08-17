import type { MockProjectWithCreator } from '@/db/types/project';
import type { Project } from '@/src/types/project.types';

/**
 * Adapter: converts a `MockProjectWithCreator` (used by seed / demo screens)
 * into the shape expected by the production `Project` type used by shared
 * UI components (FinancialOverview, KeyDetailsList, ProjectProgressCard).
 *
 * This exists solely to keep the legacy mock screens compiling — real data
 * from Supabase already comes back as a `Project`.
 */
export function mockToProject(m: MockProjectWithCreator): Project {
  const targetMinor = m.targetKobo;
  const raisedMinor = m.raisedKobo;
  return {
    id: m.id,
    code: m.id.slice(0, 8).toUpperCase(),
    name: m.name,
    sector: m.sector,
    location: m.location,
    summary: m.summary,
    fullDetails: m.fullDetails,
    risks: m.risks,
    timeline: m.timeline,
    stage: m.stage,
    approvalStatus: m.approvalStatus,
    currencyCode: 'NGN',
    targetMinor,
    raisedMinor,
    drawnMinor: 0,
    raiseFeeMinor: 0,
    estimatedRoiBps: Math.round(m.estimatedRoiPct * 100),
    durationValue: m.durationMonths,
    durationUnit: 'MONTHS',
    isPublic: true,
    submittedAt: m.createdAt,
    profitSplitInvestorBps: m.profitSplitInvestorBps,
    exitNoticeDays: m.exitNoticeDays,
    earlyExitPenaltyBps: m.earlyExitPenaltyBps,
    createdBy: { id: m.createdBy, full_name: m.creatorName },
    bannerUrl: m.coverImageUrl,
    createdAt: m.createdAt,
    realisedProfitMinor: 0,
    targetKobo: targetMinor,
    raisedKobo: raisedMinor,
  };
}

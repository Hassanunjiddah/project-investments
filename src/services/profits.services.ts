import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import type {
  ProfitUpdate,
  InvestorProjectProfit,
  ManagerProfitSummary,
  OwnerProfitSummary,
  InvestorPayout,
} from '@/src/types/profit.types';

// Cast to any for calls whose types are not yet in the generated Database type
// (new RPCs + tables added in the phase-3 migration).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

// PostgREST error codes that indicate the Phase 3 migration has not been applied yet.
// We treat these as "empty" instead of throwing so the app remains usable pre-migration.
const MISSING_SCHEMA_CODES = new Set([
  '42P01', // relation does not exist
  '42703', // column does not exist
  'PGRST202', // function not found in schema cache
  'PGRST204', // column not found
  'PGRST205', // relation not found in schema cache
]);

function isMissingSchema(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return !!code && MISSING_SCHEMA_CODES.has(code);
}

// ---------------------------------------------------------------------------
// Project realised-profit + progress-start-at fetch (safe against missing columns)
// ---------------------------------------------------------------------------

export type ProjectProfitMeta = {
  realisedProfitMinor: number;
  /**
   * Net investor pool distributed cumulatively across all APPROVED
   * profit declarations for this project. This is what actually reached
   * investor payables — net of platform fee and manager share. Used to
   * derive per-unit NAV in the investor UI.
   */
  investorRealisedMinor: number;
  progressStartedAt?: string;
};

export async function fetchProjectProfitMeta(projectId: string): Promise<ProjectProfitMeta> {
  if (!projectId) return { realisedProfitMinor: 0, investorRealisedMinor: 0 };
  const [projectRes, poolRes] = await Promise.all([
    sb
      .from('projects')
      .select('realised_profit_minor, progress_started_at')
      .eq('id', projectId)
      .maybeSingle(),
    sb
      .from('profit_declarations')
      .select('investor_pool_minor')
      .eq('project_id', projectId)
      .eq('status', 'APPROVED'),
  ]);
  if (projectRes.error) {
    if (isMissingSchema(projectRes.error)) {
      return { realisedProfitMinor: 0, investorRealisedMinor: 0 };
    }
    throw normalizeError(projectRes.error);
  }
  // Pool query is soft — if the declarations table is missing, treat as 0.
  const pool =
    poolRes.error && isMissingSchema(poolRes.error)
      ? 0
      : ((poolRes.data ?? []) as Array<{ investor_pool_minor: number | null }>)
          .reduce((sum, r) => sum + (r.investor_pool_minor ?? 0), 0);
  return {
    realisedProfitMinor: projectRes.data?.realised_profit_minor ?? 0,
    investorRealisedMinor: pool,
    progressStartedAt: projectRes.data?.progress_started_at ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Profit updates feed
// ---------------------------------------------------------------------------

export async function fetchProfitUpdates(projectId: string): Promise<ProfitUpdate[]> {
  if (!projectId) return [];
  const { data, error } = await sb
    .from('profit_updates')
    .select('id, project_id, amount_minor, note, posted_by, created_at, profiles:posted_by(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingSchema(error)) return [];
    throw normalizeError(error);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    amountMinor: row.amount_minor,
    note: row.note ?? '',
    postedBy: row.posted_by,
    postedByName: row.profiles?.full_name,
    createdAt: row.created_at,
  }));
}

/**
 * Fetches every profit update across every project the current user can see
 * (RLS scopes this to their own projects when they're a Line Manager).
 * Used by the Earnings dashboard to render a cross-project activity feed.
 */
export async function fetchAllProfitUpdates(limit = 50): Promise<
  (ProfitUpdate & { projectName?: string })[]
> {
  const { data, error } = await sb
    .from('profit_updates')
    .select(
      'id, project_id, amount_minor, note, posted_by, created_at, profiles:posted_by(full_name), projects:project_id(name, profit_split_investor_bps)',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSchema(error)) return [];
    throw normalizeError(error);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    amountMinor: row.amount_minor,
    note: row.note ?? '',
    postedBy: row.posted_by,
    postedByName: row.profiles?.full_name,
    createdAt: row.created_at,
    projectName: row.projects?.name,
    profitSplitInvestorBps: row.projects?.profit_split_investor_bps ?? 7000,
  }));
}

export async function postProfitUpdate(
  projectId: string,
  amountMinor: number,
  note: string,
): Promise<ProfitUpdate> {
  const { data, error } = await sb.rpc('post_profit_update', {
    p_project_id: projectId,
    p_amount_minor: amountMinor,
    p_note: note,
  });

  if (error) throw normalizeError(error);

  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: row.id,
    projectId: row.project_id,
    amountMinor: row.amount_minor,
    note: row.note ?? '',
    postedBy: row.posted_by,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Investor profit summary (per-project + aggregate)
// ---------------------------------------------------------------------------

export async function fetchInvestorProfitSummary(): Promise<InvestorProjectProfit[]> {
  const { data, error } = await sb.rpc('get_investor_profit_summary', {
    p_investor_id: null,
  });

  if (error) {
    if (isMissingSchema(error)) return [];
    throw normalizeError(error);
  }

  return ((data as any[]) ?? []).map((row) => ({
    projectId: row.project_id,
    inviteId: row.invite_id,
    capitalMinor: row.capital_minor ?? 0,
    realisedProfitMinor: row.realised_profit_minor ?? 0,
    investorShareMinor: row.investor_share_minor ?? 0,
    projectStage: row.project_stage,
    projectName: row.project_name,
  }));
}

// ---------------------------------------------------------------------------
// Manager profit summary
// ---------------------------------------------------------------------------

export async function fetchManagerProfitSummary(): Promise<ManagerProfitSummary> {
  const { data, error } = await sb.rpc('get_manager_profit_summary', {
    p_manager_id: null,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return {
        totalRealisedProfitMinor: 0,
        platformFeeMinor: 0,
        managerShareMinor: 0,
        raiseFeeMinor: 0,
        profitFeeMinor: 0,
        projectCount: 0,
      };
    }
    throw normalizeError(error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const raiseFee = Number(row?.raise_fee_minor ?? 0);
  const profitFee = Number(row?.profit_fee_minor ?? 0);
  const combined = raiseFee + profitFee;
  const fee =
    combined > 0 ? combined : (row?.platform_fee_minor ?? row?.manager_share_minor ?? 0);
  return {
    totalRealisedProfitMinor: row?.total_realised_profit_minor ?? 0,
    platformFeeMinor: fee,
    managerShareMinor: fee,
    raiseFeeMinor: raiseFee,
    profitFeeMinor: profitFee,
    projectCount: row?.project_count ?? 0,
  };
}

export async function fetchOwnerProfitSummary(): Promise<OwnerProfitSummary> {
  const { data, error } = await (sb.rpc as any)('get_owner_profit_summary', {
    p_owner_id: null,
  });

  if (error) {
    if (isMissingSchema(error)) {
      return { totalRealisedProfitMinor: 0, managerShareMinor: 0, projectCount: 0 };
    }
    throw normalizeError(error);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalRealisedProfitMinor: row?.total_realised_profit_minor ?? 0,
    managerShareMinor: row?.manager_share_minor ?? 0,
    projectCount: row?.project_count ?? 0,
  };
}

export async function fetchEarningBreakdown(
  kind: 'platform' | 'manager_share',
): Promise<import('@/src/types/profit.types').EarningBreakdownRow[]> {
  const { data, error } = await (sb.rpc as any)('list_earning_breakdown', {
    p_kind: kind,
  });
  if (error) {
    if (isMissingSchema(error)) return [];
    throw normalizeError(error);
  }
  return ((data as any[]) ?? []).map((row) => ({
    projectId: row.project_id,
    projectCode: row.project_code,
    projectName: row.project_name,
    grossMinor: row.gross_minor ?? 0,
    amountMinor: row.amount_minor ?? 0,
    declarationCount: row.declaration_count ?? 0,
    raiseFeeMinor: row.raise_fee_minor ?? 0,
    profitFeeMinor: row.profit_fee_minor ?? row.amount_minor ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// End project manually (LM/CEO): sets stage -> END. Payout economics are
// governed exclusively by the profit-declaration / distribution-notice flow.
// ---------------------------------------------------------------------------

export async function endProjectNow(projectId: string): Promise<void> {
  if (!projectId) throw new Error('Missing project id');
  const { error } = await sb.rpc('end_project_now', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
}

// ---------------------------------------------------------------------------
// Investor payouts (final END-stage snapshot)
// ---------------------------------------------------------------------------

export async function fetchInvestorPayoutForInvite(inviteId: string): Promise<InvestorPayout | null> {
  if (!inviteId) return null;
  const { data, error } = await sb
    .from('investor_payouts')
    .select('id, project_id, invite_id, investor_id, capital_minor, profit_minor, paid_at, created_at')
    .eq('invite_id', inviteId)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) return null;
    throw normalizeError(error);
  }
  if (!data) return null;
  return {
    id: data.id,
    projectId: data.project_id,
    inviteId: data.invite_id,
    investorId: data.investor_id,
    capitalMinor: data.capital_minor,
    profitMinor: data.profit_minor,
    paidAt: data.paid_at ?? undefined,
    createdAt: data.created_at,
  };
}

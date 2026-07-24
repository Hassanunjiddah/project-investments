import { supabase } from './supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type DeclarationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ProfitDeclaration = {
  id: string;
  projectId: string;
  reference: string;
  label: string | null;
  isFinal: boolean;
  grossMinor: number;
  costsMinor: number;
  netMinor: number;
  platformFeeBps: number;
  platformFeeMinor: number;
  distributableMinor: number;
  profitSplitInvestorBps: number;
  investorPoolMinor: number;
  managerShareMinor: number;
  totalUnitsAtDeclaration: number;
  perUnitMinor: number;
  status: DeclarationStatus;
  declaredBy: string;
  declaredAt: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionNote?: string | null;
  projectName?: string;
  projectCode?: string;
};

type Row = {
  id: string;
  project_id: string;
  reference: string;
  label: string | null;
  is_final: boolean;
  gross_amount_minor: number;
  costs_minor: number;
  net_amount_minor: number;
  platform_fee_bps: number;
  platform_fee_minor: number;
  distributable_minor: number;
  profit_split_investor_bps: number;
  investor_pool_minor: number;
  manager_share_minor: number;
  total_units_at_declaration: number;
  per_unit_minor: number;
  status: DeclarationStatus;
  declared_by: string;
  declared_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_note: string | null;
  projects?: { name: string; code: string } | null;
};

function mapRow(row: Row): ProfitDeclaration {
  return {
    id: row.id,
    projectId: row.project_id,
    reference: row.reference,
    label: row.label,
    isFinal: row.is_final,
    grossMinor: row.gross_amount_minor,
    costsMinor: row.costs_minor,
    netMinor: row.net_amount_minor,
    platformFeeBps: row.platform_fee_bps,
    platformFeeMinor: row.platform_fee_minor,
    distributableMinor: row.distributable_minor,
    profitSplitInvestorBps: row.profit_split_investor_bps,
    investorPoolMinor: row.investor_pool_minor,
    managerShareMinor: row.manager_share_minor,
    totalUnitsAtDeclaration: row.total_units_at_declaration,
    perUnitMinor: row.per_unit_minor,
    status: row.status,
    declaredBy: row.declared_by,
    declaredAt: row.declared_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    rejectionNote: row.rejection_note,
    projectName: row.projects?.name,
    projectCode: row.projects?.code,
  };
}

export async function fetchProjectDeclarations(projectId: string): Promise<ProfitDeclaration[]> {
  if (!projectId) return [];
  const { data, error } = await supabase
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, is_final, gross_amount_minor, costs_minor, net_amount_minor, platform_fee_bps, platform_fee_minor, distributable_minor, profit_split_investor_bps, investor_pool_minor, manager_share_minor, total_units_at_declaration, per_unit_minor, status, declared_by, declared_at, approved_by, approved_at, rejected_by, rejected_at, rejection_note',
    )
    .eq('project_id', projectId)
    .order('declared_at', { ascending: false });
  if (error) throw normalizeError(error);
  return ((data ?? []) as unknown as Row[]).map(mapRow);
}

export async function fetchPendingDeclarations(): Promise<ProfitDeclaration[]> {
  const { data, error } = await (supabase.rpc as any)('list_pending_declarations');
  if (error) throw normalizeError(error);
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function declareProfit(input: {
  projectId: string;
  grossMinor: number;
  costsMinor?: number;
  label?: string;
  isFinal?: boolean;
}): Promise<ProfitDeclaration> {
  const { data, error } = await (supabase.rpc as any)('declare_profit', {
    p_project_id: input.projectId,
    p_gross_minor: input.grossMinor,
    p_costs_minor: input.costsMinor ?? 0,
    p_label: input.label ?? null,
    p_is_final: input.isFinal ?? false,
  });
  if (error) throw normalizeError(error);
  return mapRow(data as Row);
}

export async function approveDeclaration(declarationId: string): Promise<ProfitDeclaration> {
  const { data, error } = await (supabase.rpc as any)('approve_profit_declaration', {
    p_declaration_id: declarationId,
  });
  if (error) throw normalizeError(error);
  return mapRow(data as Row);
}

export async function rejectDeclaration(
  declarationId: string,
  note?: string,
): Promise<ProfitDeclaration> {
  const { data, error } = await (supabase.rpc as any)('reject_profit_declaration', {
    p_declaration_id: declarationId,
    p_note: note ?? '',
  });
  if (error) throw normalizeError(error);
  return mapRow(data as Row);
}

// Pure client-side waterfall preview so the UI can show the math live before
// the LM even submits. Mirrors the SQL exactly to keep numbers consistent.
export function previewWaterfall(input: {
  grossMinor: number;
  costsMinor: number;
  platformFeeBps: number;
  profitSplitInvestorBps: number;
  totalUnits: number;
}) {
  const gross = Math.max(0, Math.floor(input.grossMinor));
  const costs = Math.max(0, Math.floor(input.costsMinor));
  const net = Math.max(0, gross - costs);
  const platformFee = Math.floor((net * input.platformFeeBps) / 10000);
  const distributable = net - platformFee;
  const investorPool = Math.floor((distributable * input.profitSplitInvestorBps) / 10000);
  const managerShare = distributable - investorPool;
  const perUnit = input.totalUnits > 0 ? Math.floor(investorPool / input.totalUnits) : 0;
  return { gross, costs, net, platformFee, distributable, investorPool, managerShare, perUnit };
}

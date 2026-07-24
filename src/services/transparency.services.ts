import { supabase } from './supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type InvestorNotice = {
  id: string;
  declarationId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  inviteId: string;
  unitsHeld: number;
  perUnitMinor: number;
  profitMinor: number;
  capitalReturnedMinor: number;
  reference: string;
  isFinal: boolean;
  createdAt: string;
  declarationReference: string;
  declarationLabel: string | null;
  grossMinor: number;
  netMinor: number;
  platformFeeMinor: number;
  investorPoolMinor: number;
  platformFeeBps: number;
  profitSplitInvestorBps: number;
};

export type AuditEvent = {
  id: string;
  projectId: string | null;
  entityType: string;
  entityId: string | null;
  eventType: string;
  actorId: string | null;
  context: Record<string, unknown>;
  createdAt: string;
};

export type ReconciliationRow = {
  inviteId: string;
  investorId: string;
  investorName: string | null;
  status: string;
  paymentReference: string | null;
  unitsPledged: number | null;
  unitsAllotted: number | null;
  expectedMinor: number;
  claimedMinor: number;
  varianceMinor: number;
  claimBank: string | null;
  claimDate: string | null;
  claimNarration: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  verifiedByName: string | null;
};

export async function fetchInvestorNotices(): Promise<InvestorNotice[]> {
  const { data, error } = await (supabase.rpc as any)('list_investor_notices');
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    declarationId: r.declaration_id,
    projectId: r.project_id,
    projectName: r.project_name,
    projectCode: r.project_code,
    inviteId: r.invite_id,
    unitsHeld: r.units_held,
    perUnitMinor: r.per_unit_minor,
    profitMinor: r.profit_minor,
    capitalReturnedMinor: r.capital_returned_minor,
    reference: r.reference,
    isFinal: r.is_final,
    createdAt: r.created_at,
    declarationReference: r.declaration_reference,
    declarationLabel: r.declaration_label,
    grossMinor: r.gross_minor ?? r.gross_amount_minor,
    netMinor: r.net_minor ?? r.net_amount_minor,
    platformFeeMinor: r.platform_fee_minor,
    investorPoolMinor: r.investor_pool_minor,
    platformFeeBps: r.platform_fee_bps,
    profitSplitInvestorBps: r.profit_split_investor_bps,
  }));
}

export async function fetchProjectAudit(projectId: string, limit = 200): Promise<AuditEvent[]> {
  if (!projectId) return [];
  const { data, error } = await (supabase.rpc as any)('list_project_audit', {
    p_project_id: projectId,
    p_limit: limit,
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    entityType: r.entity_type,
    entityId: r.entity_id,
    eventType: r.event_type,
    actorId: r.actor_id,
    context: r.context ?? {},
    createdAt: r.created_at,
  }));
}

export async function fetchReconciliation(projectId: string): Promise<ReconciliationRow[]> {
  if (!projectId) return [];
  const { data, error } = await (supabase.rpc as any)('project_reconciliation', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    inviteId: r.invite_id,
    investorId: r.investor_id,
    investorName: r.investor_name,
    status: r.status,
    paymentReference: r.payment_reference,
    unitsPledged: r.units_pledged,
    unitsAllotted: r.units_allotted,
    expectedMinor: r.expected_minor ?? 0,
    claimedMinor: r.claimed_minor ?? 0,
    varianceMinor: r.variance_minor ?? 0,
    claimBank: r.claim_bank,
    claimDate: r.claim_date,
    claimNarration: r.claim_narration,
    verifiedAt: r.verified_at,
    verifiedBy: r.verified_by,
    verifiedByName: r.verified_by_name,
  }));
}

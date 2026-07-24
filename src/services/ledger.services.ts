import { supabase } from './supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type LedgerEntry = {
  id: string;
  transactionRef: string;
  sequence: number;
  projectId: string;
  accountCode: string;
  partyId: string | null;
  direction: 'DR' | 'CR';
  amountMinor: number;
  refType: string | null;
  refId: string | null;
  memo: string | null;
  createdAt: string;
};

export async function fetchProjectLedger(projectId: string, limit = 500): Promise<LedgerEntry[]> {
  if (!projectId) return [];
  const { data, error } = await (supabase.rpc as any)('list_project_ledger', {
    p_project_id: projectId,
    p_limit: limit,
  });
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    transactionRef: r.transaction_ref,
    sequence: r.sequence,
    projectId: r.project_id,
    accountCode: r.account_code,
    partyId: r.party_id,
    direction: r.direction,
    amountMinor: r.amount_minor,
    refType: r.ref_type,
    refId: r.ref_id,
    memo: r.memo,
    createdAt: r.created_at,
  }));
}

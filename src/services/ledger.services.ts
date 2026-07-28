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

export type BackfillLedgerResult = {
  invitesBackfilled: number;
  declarationsBackfilled: number;
  finalReturnsBackfilled: number;
  executedAt: string;
  actorId: string | null;
};

/**
 * One-shot backfill of historical ledger entries — replays the balanced
 * lines that the P4 auto-post triggers would have posted for invites
 * that reached CONFIRMED and declarations that reached APPROVED before
 * the triggers were installed. Idempotent; safe to re-run.
 *
 * Server-side guard: only CEO / ADMIN may execute.
 */
export async function backfillLedger(): Promise<BackfillLedgerResult> {
  const { data, error } = await (supabase.rpc as any)('backfill_ledger');
  if (error) throw normalizeError(error);
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    invitesBackfilled: Number(r.invites_backfilled ?? 0),
    declarationsBackfilled: Number(r.declarations_backfilled ?? 0),
    finalReturnsBackfilled: Number(r.final_returns_backfilled ?? 0),
    executedAt: String(r.executed_at ?? new Date().toISOString()),
    actorId: (r.actor_id as string | null) ?? null,
  };
}

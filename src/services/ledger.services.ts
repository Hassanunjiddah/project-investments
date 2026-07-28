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

export type LedgerIntegrityImbalance = {
  transactionRef: string;
  drMinor: number;
  crMinor: number;
  deltaMinor: number;
  firstPostedAt: string;
  refType: string | null;
  refId: string | null;
};

export type LedgerIntegrityOrphan = {
  transactionRef: string;
  refType: string | null;
  refId: string | null;
  rowCount: number;
};

export type LedgerIntegrityResult = {
  balanced: boolean;
  transactionCount: number;
  rowCount: number;
  totalDrMinor: number;
  totalCrMinor: number;
  grandDeltaMinor: number;
  imbalancedCount: number;
  imbalanced: LedgerIntegrityImbalance[];
  orphanCount: number;
  orphans: LedgerIntegrityOrphan[];
  checkedAt: string;
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

/**
 * Read-only self-audit of the ledger. Verifies:
 *   1. Every `transaction_ref` has sum(DR) = sum(CR).
 *   2. Grand total DR = CR (book closes to ₦0).
 *   3. No orphan entries whose `ref_id` points at a deleted invite / declaration.
 *
 * Moves no money. CEO / ADMIN only.
 */
export async function checkLedgerIntegrity(): Promise<LedgerIntegrityResult> {
  const { data, error } = await (supabase.rpc as any)('check_ledger_integrity');
  if (error) throw normalizeError(error);
  const r = (data ?? {}) as Record<string, unknown>;
  const rawImb = (r.imbalanced as Record<string, unknown>[] | undefined) ?? [];
  const rawOrp = (r.orphans as Record<string, unknown>[] | undefined) ?? [];
  return {
    balanced: Boolean(r.balanced ?? false),
    transactionCount: Number(r.transaction_count ?? 0),
    rowCount: Number(r.row_count ?? 0),
    totalDrMinor: Number(r.total_dr_minor ?? 0),
    totalCrMinor: Number(r.total_cr_minor ?? 0),
    grandDeltaMinor: Number(r.grand_delta_minor ?? 0),
    imbalancedCount: Number(r.imbalanced_count ?? 0),
    imbalanced: rawImb.map((x) => ({
      transactionRef: String(x.transaction_ref ?? ''),
      drMinor: Number(x.dr_minor ?? 0),
      crMinor: Number(x.cr_minor ?? 0),
      deltaMinor: Number(x.delta_minor ?? 0),
      firstPostedAt: String(x.first_posted_at ?? ''),
      refType: (x.ref_type as string | null) ?? null,
      refId: (x.ref_id as string | null) ?? null,
    })),
    orphanCount: Number(r.orphan_count ?? 0),
    orphans: rawOrp.map((x) => ({
      transactionRef: String(x.transaction_ref ?? ''),
      refType: (x.ref_type as string | null) ?? null,
      refId: (x.ref_id as string | null) ?? null,
      rowCount: Number(x.row_count ?? 0),
    })),
    checkedAt: String(r.checked_at ?? new Date().toISOString()),
  };
}

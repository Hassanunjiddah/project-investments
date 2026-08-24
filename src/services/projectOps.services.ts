import { supabase } from '@/src/services/supabase';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';
import { invokeCreateProjectOwner } from '@/src/services/edgeFunctions.services';
import { computeCapexSummary } from '@/src/utils/pdfCapex';

export type FundDrawdown = {
  id: string;
  projectId: string;
  requestedBy: string;
  amountMinor: number;
  purpose: string;
  category: 'FUND_USE' | 'RISK_MITIGATION' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  reference?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  supportDocId?: string;
  supportDocTitle?: string;
  supportDocFileName?: string;
  supportDocStoragePath?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  projectId: string;
  inviteId?: string;
  investorId: string;
  amountMinor: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  kind: 'INVESTOR' | 'OWNER';
  reference?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
};

function mapDrawdown(row: Record<string, unknown>): FundDrawdown {
  const support =
    row.support_doc && typeof row.support_doc === 'object' && !Array.isArray(row.support_doc)
      ? (row.support_doc as Record<string, unknown>)
      : null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    requestedBy: String(row.requested_by),
    amountMinor: Number(row.amount_minor),
    purpose: String(row.purpose),
    category: row.category as FundDrawdown['category'],
    status: row.status as FundDrawdown['status'],
    reference: (row.reference as string) ?? undefined,
    bankName: (row.bank_name as string) ?? undefined,
    accountName: (row.account_name as string) ?? undefined,
    accountNumber: (row.account_number as string) ?? undefined,
    supportDocId: (row.support_doc_id as string) ?? (support?.id as string) ?? undefined,
    supportDocTitle: (support?.title as string) ?? undefined,
    supportDocFileName: (support?.file_name as string) ?? undefined,
    supportDocStoragePath: (support?.storage_path as string) ?? undefined,
    decidedBy: (row.decided_by as string) ?? undefined,
    decidedAt: (row.decided_at as string) ?? undefined,
    decisionNote: (row.decision_note as string) ?? undefined,
    createdAt: String(row.created_at),
  };
}

function mapWithdrawal(row: Record<string, unknown>): WithdrawalRequest {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    inviteId: row.invite_id != null ? String(row.invite_id) : undefined,
    investorId: String(row.investor_id),
    amountMinor: Number(row.amount_minor),
    status: row.status as WithdrawalRequest['status'],
    kind: (row.kind as WithdrawalRequest['kind']) ?? 'INVESTOR',
    reference: (row.reference as string) ?? undefined,
    decidedBy: (row.decided_by as string) ?? undefined,
    decidedAt: (row.decided_at as string) ?? undefined,
    decisionNote: (row.decision_note as string) ?? undefined,
    createdAt: String(row.created_at),
  };
}

export async function createProjectOwner(input: {
  projectId: string;
  email: string;
  fullName: string;
  resend?: boolean;
}) {
  return invokeCreateProjectOwner(input);
}

export async function fetchFundDrawdowns(projectId: string): Promise<FundDrawdown[]> {
  const { data, error } = await supabase
    .from('fund_drawdowns')
    .select(
      '*, support_doc:project_docs!support_doc_id(id, title, file_name, storage_path, mime_type)',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    // Embed may fail on older clients; fall back to bare rows.
    const fallback = await supabase
      .from('fund_drawdowns')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (fallback.error) throw normalizeError(fallback.error);
    return (fallback.data ?? []).map((r) => mapDrawdown(r as Record<string, unknown>));
  }
  return (data ?? []).map((r) => mapDrawdown(r as Record<string, unknown>));
}

export async function requestFundDrawdown(input: {
  projectId: string;
  amountMinor: number;
  purpose: string;
  category?: 'FUND_USE' | 'RISK_MITIGATION' | 'OTHER';
  bankName: string;
  accountName: string;
  accountNumber: string;
  supportDocId: string;
}): Promise<FundDrawdown> {
  const { data, error } = await supabase.rpc('request_fund_drawdown', {
    p_project_id: input.projectId,
    p_amount_minor: input.amountMinor,
    p_purpose: input.purpose,
    p_category: input.category ?? 'FUND_USE',
    p_bank_name: input.bankName,
    p_account_name: input.accountName,
    p_account_number: input.accountNumber,
    p_support_doc_id: input.supportDocId,
  });
  if (error) throw normalizeError(error);
  return mapDrawdown(data as Record<string, unknown>);
}

export async function decideFundDrawdown(
  drawdownId: string,
  approve: boolean,
  note?: string,
): Promise<FundDrawdown> {
  const { data, error } = await supabase.rpc('decide_fund_drawdown', {
    p_drawdown_id: drawdownId,
    p_approve: approve,
    p_note: note,
  });
  if (error) throw normalizeError(error);
  return mapDrawdown(data as Record<string, unknown>);
}

export async function markFundDrawdownPaid(drawdownId: string): Promise<FundDrawdown> {
  const { data, error } = await supabase.rpc('mark_fund_drawdown_paid', {
    p_drawdown_id: drawdownId,
  });
  if (error) throw normalizeError(error);
  return mapDrawdown(data as Record<string, unknown>);
}

export async function fetchWithdrawalsForProject(projectId: string): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data ?? []).map((r) => mapWithdrawal(r as Record<string, unknown>));
}

export async function fetchWithdrawalsForInvite(inviteId: string): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('invite_id', inviteId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data ?? []).map((r) => mapWithdrawal(r as Record<string, unknown>));
}

export async function fetchOwnerWithdrawalsForProject(
  projectId: string,
): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('project_id', projectId)
    .eq('kind', 'OWNER')
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data ?? []).map((r) => mapWithdrawal(r as Record<string, unknown>));
}

export async function fetchMyWithdrawals(): Promise<WithdrawalRequest[]> {
  const uid = (await supabase.auth.getSession()).data.session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('investor_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
  return (data ?? []).map((r) => mapWithdrawal(r as Record<string, unknown>));
}

export async function investorWithdrawableMinor(inviteId: string): Promise<number> {
  const { data, error } = await supabase.rpc('investor_withdrawable_minor', {
    p_invite_id: inviteId,
  });
  if (error) throw normalizeError(error);
  return Number(data ?? 0);
}

export async function ownerWithdrawableMinor(projectId: string): Promise<number> {
  const { data, error } = await supabase.rpc('owner_withdrawable_minor', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  return Number(data ?? 0);
}

export async function startProjectProgress(projectId: string): Promise<void> {
  const { error } = await supabase.rpc('start_project_progress', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
}

export async function requestProfitWithdrawal(
  inviteId: string,
  amountMinor: number,
): Promise<WithdrawalRequest> {
  const { data, error } = await supabase.rpc('request_profit_withdrawal', {
    p_invite_id: inviteId,
    p_amount_minor: amountMinor,
  });
  if (error) throw normalizeError(error);
  return mapWithdrawal(data as Record<string, unknown>);
}

export async function requestOwnerProfitWithdrawal(
  projectId: string,
  amountMinor: number,
): Promise<WithdrawalRequest> {
  const { data, error } = await supabase.rpc('request_owner_profit_withdrawal', {
    p_project_id: projectId,
    p_amount_minor: amountMinor,
  });
  if (error) throw normalizeError(error);
  return mapWithdrawal(data as Record<string, unknown>);
}

export async function decideProfitWithdrawal(
  withdrawalId: string,
  approve: boolean,
  note?: string,
): Promise<WithdrawalRequest> {
  const { data, error } = await supabase.rpc('decide_profit_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_approve: approve,
    p_note: note,
  });
  if (error) throw normalizeError(error);
  return mapWithdrawal(data as Record<string, unknown>);
}

export async function markProfitWithdrawalPaid(withdrawalId: string): Promise<WithdrawalRequest> {
  const { data, error } = await supabase.rpc('mark_profit_withdrawal_paid', {
    p_withdrawal_id: withdrawalId,
  });
  if (error) throw normalizeError(error);
  return mapWithdrawal(data as Record<string, unknown>);
}

export type ProjectPack = {
  exportedAt: string;
  project: Record<string, unknown>;
  invites: Array<Record<string, unknown>>;
  declarations: Array<Record<string, unknown>>;
  drawdowns: Array<Record<string, unknown>>;
  withdrawals: Array<Record<string, unknown>>;
  audit?: Array<Record<string, unknown>>;
  ledger?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
};

export async function fetchProjectPack(projectId: string): Promise<ProjectPack> {
  const { data, error } = await supabase.rpc('export_project_pack', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  if (!data) throw new AppError('Empty export');
  return data as ProjectPack;
}

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function appendSectionRows(
  lines: string[],
  section: string,
  rows: Array<Record<string, unknown>>,
) {
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      lines.push([section, csvEscape(row.reference ?? row.id ?? ''), csvEscape(k), csvEscape(v)].join(','));
    }
  }
}

/** Lightweight owner CSV (project + core ops). */
export function downloadProjectPackCsv(pack: ProjectPack) {
  if (typeof window === 'undefined') return;

  const code = String(pack.project.code ?? 'PROJECT');
  const projLines = ['section,key,value'];
  for (const [k, v] of Object.entries(pack.project)) {
    projLines.push(['project', csvEscape(k), csvEscape(v)].join(','));
  }
  for (const inv of pack.invites) {
    projLines.push(
      [
        'invite',
        csvEscape(inv.paymentReference ?? inv.id),
        csvEscape(
          `${inv.email}|${inv.status}|units=${inv.unitsPledged ?? inv.unitsAllotted ?? ''}|amount_kobo=${inv.amountMinor ?? ''}`,
        ),
      ].join(','),
    );
  }
  for (const d of pack.declarations) {
    projLines.push(
      [
        'declaration',
        csvEscape(d.reference ?? d.id),
        csvEscape(
          `${d.status}|gross_kobo=${d.grossMinor ?? ''}|investor_pool_kobo=${d.investorPoolMinor ?? ''}|fee_kobo=${d.platformFeeMinor ?? ''}`,
        ),
      ].join(','),
    );
  }
  for (const f of pack.drawdowns) {
    projLines.push(
      [
        'drawdown',
        csvEscape(f.reference ?? f.id),
        csvEscape(`${f.status}|${f.category}|amount_kobo=${f.amountMinor}|${f.purpose}`),
      ].join(','),
    );
  }
  for (const w of pack.withdrawals) {
    projLines.push(
      [
        'withdrawal',
        csvEscape(w.reference ?? w.id),
        csvEscape(`${w.status}|amount_kobo=${w.amountMinor}|investor=${w.investorId}`),
      ].join(','),
    );
  }
  projLines.push(`meta,exportedAt,${csvEscape(pack.exportedAt)}`);

  const blob = new Blob([projLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-export.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Full Carfax CSV for LM / CEO transparency. */
export function downloadCarfaxCsv(pack: ProjectPack) {
  if (typeof window === 'undefined') return;

  const code = String(pack.project.code ?? 'PROJECT');
  const lines = ['section,row_key,field,value'];
  for (const [k, v] of Object.entries(pack.project)) {
    lines.push(['project', csvEscape(pack.project.code ?? ''), csvEscape(k), csvEscape(v)].join(','));
  }
  appendSectionRows(lines, 'invite', pack.invites);
  appendSectionRows(lines, 'declaration', pack.declarations);
  appendSectionRows(lines, 'drawdown', pack.drawdowns);
  appendSectionRows(lines, 'withdrawal', pack.withdrawals);
  appendSectionRows(lines, 'audit', pack.audit ?? []);
  appendSectionRows(lines, 'ledger', pack.ledger ?? []);
  appendSectionRows(lines, 'document', pack.documents ?? []);
  lines.push(['meta', '', 'exportedAt', csvEscape(pack.exportedAt)].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-carfax.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** CapEx-focused CSV: capital summary + remittance register. */
export function downloadCapexCsv(pack: ProjectPack) {
  if (typeof window === 'undefined') return;

  const summary = computeCapexSummary(pack);
  const code = String(pack.project.code ?? 'PROJECT');
  const lines = ['section,row_key,field,value'];

  lines.push(['summary', code, 'targetMinor', csvEscape(summary.targetMinor)].join(','));
  lines.push(['summary', code, 'raisedMinor', csvEscape(summary.raisedMinor)].join(','));
  lines.push(['summary', code, 'raiseFeeMinor', csvEscape(summary.raiseFeeMinor)].join(','));
  lines.push(['summary', code, 'drawnMinor', csvEscape(summary.drawnMinor)].join(','));
  lines.push(
    ['summary', code, 'currentCapitalMinor', csvEscape(summary.currentCapitalMinor)].join(','),
  );
  lines.push(
    ['summary', code, 'utilizationRatio', csvEscape(summary.utilization.toFixed(6))].join(','),
  );
  lines.push(
    ['summary', code, 'remittanceCount', csvEscape(summary.remittanceCount)].join(','),
  );

  for (const [status, row] of Object.entries(summary.byStatus)) {
    lines.push(
      ['status', status, 'count', csvEscape(row.count)].join(','),
      ['status', status, 'amountMinor', csvEscape(row.amountMinor)].join(','),
    );
  }
  for (const [cat, row] of Object.entries(summary.byCategoryPaid)) {
    lines.push(
      ['category_paid', cat, 'count', csvEscape(row.count)].join(','),
      ['category_paid', cat, 'amountMinor', csvEscape(row.amountMinor)].join(','),
    );
  }
  for (const [cat, row] of Object.entries(summary.byCategoryPending)) {
    lines.push(
      ['category_pipeline', cat, 'count', csvEscape(row.count)].join(','),
      ['category_pipeline', cat, 'amountMinor', csvEscape(row.amountMinor)].join(','),
    );
  }

  appendSectionRows(lines, 'drawdown', pack.drawdowns);
  lines.push(['meta', '', 'exportedAt', csvEscape(pack.exportedAt)].join(','));

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-capex.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

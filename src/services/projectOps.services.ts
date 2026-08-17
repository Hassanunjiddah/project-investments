import { supabase } from '@/src/services/supabase';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';
import { invokeCreateProjectOwner } from '@/src/services/edgeFunctions.services';

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
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
};

export type WithdrawalRequest = {
  id: string;
  projectId: string;
  inviteId: string;
  investorId: string;
  amountMinor: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  reference?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  createdAt: string;
};

function mapDrawdown(row: Record<string, unknown>): FundDrawdown {
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
    inviteId: String(row.invite_id),
    investorId: String(row.investor_id),
    amountMinor: Number(row.amount_minor),
    status: row.status as WithdrawalRequest['status'],
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
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw normalizeError(error);
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
}): Promise<FundDrawdown> {
  const { data, error } = await supabase.rpc('request_fund_drawdown', {
    p_project_id: input.projectId,
    p_amount_minor: input.amountMinor,
    p_purpose: input.purpose,
    p_category: input.category ?? 'FUND_USE',
    p_bank_name: input.bankName,
    p_account_name: input.accountName,
    p_account_number: input.accountNumber,
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
    p_note: note ?? null,
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

export async function decideProfitWithdrawal(
  withdrawalId: string,
  approve: boolean,
  note?: string,
): Promise<WithdrawalRequest> {
  const { data, error } = await supabase.rpc('decide_profit_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_approve: approve,
    p_note: note ?? null,
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
};

export async function fetchProjectPack(projectId: string): Promise<ProjectPack> {
  const { data, error } = await supabase.rpc('export_project_pack', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  if (!data) throw new AppError('Empty export');
  return data as ProjectPack;
}

/** Download a multi-section CSV pack with project references for CEO / Prism LM. */
export function downloadProjectPackCsv(pack: ProjectPack) {
  if (typeof window === 'undefined') return;

  const code = String(pack.project.code ?? 'PROJECT');
  const escape = (v: unknown) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const sections: string[] = [];
  sections.push('SECTION,Project');
  sections.push(
    ['Field', 'Value']
      .concat(
        Object.entries(pack.project).flatMap(([k, v]) => [escape(k), escape(v)].join(',')),
      )
      .join('\n'),
  );

  // Rebuild project section properly
  const projLines = ['section,field,value'];
  for (const [k, v] of Object.entries(pack.project)) {
    projLines.push(['project', escape(k), escape(v)].join(','));
  }
  for (const inv of pack.invites) {
    projLines.push(
      [
        'invite',
        escape(inv.paymentReference ?? inv.id),
        escape(
          `${inv.email}|${inv.status}|units=${inv.unitsPledged ?? ''}|amount_kobo=${inv.amountMinor ?? ''}`,
        ),
      ].join(','),
    );
  }
  for (const d of pack.declarations) {
    projLines.push(
      [
        'declaration',
        escape(d.reference ?? d.id),
        escape(
          `${d.status}|gross_kobo=${d.grossMinor ?? ''}|investor_pool_kobo=${d.investorPoolMinor ?? ''}|fee_kobo=${d.platformFeeMinor ?? ''}`,
        ),
      ].join(','),
    );
  }
  for (const f of pack.drawdowns) {
    projLines.push(
      [
        'drawdown',
        escape(f.reference ?? f.id),
        escape(`${f.status}|${f.category}|amount_kobo=${f.amountMinor}|${f.purpose}`),
      ].join(','),
    );
  }
  for (const w of pack.withdrawals) {
    projLines.push(
      [
        'withdrawal',
        escape(w.reference ?? w.id),
        escape(`${w.status}|amount_kobo=${w.amountMinor}|investor=${w.investorId}`),
      ].join(','),
    );
  }
  projLines.push(`meta,exportedAt,${escape(pack.exportedAt)}`);

  const blob = new Blob([projLines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-export.csv`;
  a.click();
  URL.revokeObjectURL(url);
  void sections;
}

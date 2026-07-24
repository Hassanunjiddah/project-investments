import { supabase } from './supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

export type TrialBalanceRow = {
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  accountCode: string;
  partyId: string | null;
  balanceMinor: number;
};

/**
 * Fetches the ledger balance per (project, account, party) across the whole
 * platform. CEO/admin only — RLS on ledger_project_balances handles gating.
 */
export async function fetchTrialBalance(): Promise<TrialBalanceRow[]> {
  const { data, error } = await supabase
    .from('ledger_project_balances')
    .select('project_id, account_code, party_id, balance_minor, projects(code, name)');
  if (error) throw normalizeError(error);
  return ((data ?? []) as any[]).map((r) => ({
    projectId: r.project_id,
    projectCode: r.projects?.code ?? null,
    projectName: r.projects?.name ?? null,
    accountCode: r.account_code,
    partyId: r.party_id,
    balanceMinor: r.balance_minor,
  }));
}

const ACCOUNT_LABELS: Record<string, string> = {
  project_bank: 'Project bank account',
  investor_capital: 'Investor capital',
  project_realised_pnl: 'Project P&L',
  platform_fee_payable: 'Prism Capital fee payable',
  manager_payable: 'Manager share payable',
  investor_payable: 'Investor profit payable',
  rounding_reserve: 'Rounding reserve',
};

/**
 * Convert the trial balance into an auditor-ready CSV and trigger a browser
 * download. Groups by project + account and formats amounts as absolute ₦
 * (positive = DR side, negative shown with leading minus).
 */
export function downloadTrialBalanceCsv(rows: TrialBalanceRow[]) {
  if (typeof window === 'undefined') return;

  const sorted = [...rows].sort((a, b) => {
    const pc = (a.projectCode ?? '').localeCompare(b.projectCode ?? '');
    if (pc !== 0) return pc;
    return a.accountCode.localeCompare(b.accountCode);
  });

  const header = [
    'Project code',
    'Project name',
    'Account code',
    'Account label',
    'Party ID',
    'Balance (NGN)',
    'Balance (kobo)',
  ].join(',');

  const escape = (v: string | number | null) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = sorted.map((r) =>
    [
      escape(r.projectCode),
      escape(r.projectName),
      escape(r.accountCode),
      escape(ACCOUNT_LABELS[r.accountCode] ?? r.accountCode),
      escape(r.partyId),
      escape((r.balanceMinor / 100).toFixed(2)),
      escape(r.balanceMinor),
    ].join(','),
  );

  // Roll-up rows per account (across all projects) — auditors love this
  const rollup = new Map<string, number>();
  for (const r of sorted) {
    rollup.set(r.accountCode, (rollup.get(r.accountCode) ?? 0) + r.balanceMinor);
  }
  lines.push(''); // blank separator
  lines.push('TOTALS BY ACCOUNT');
  lines.push('Account code,Account label,Balance (NGN),Balance (kobo)');
  for (const [acct, bal] of rollup.entries()) {
    lines.push(
      [
        escape(acct),
        escape(ACCOUNT_LABELS[acct] ?? acct),
        escape((bal / 100).toFixed(2)),
        escape(bal),
      ].join(','),
    );
  }

  // Grand total — trial balance must sum to zero across all accounts.
  const grand = sorted.reduce((s, r) => s + r.balanceMinor, 0);
  lines.push('');
  lines.push(`GRAND TOTAL,,${(grand / 100).toFixed(2)},${grand}`);
  lines.push(
    grand === 0
      ? 'STATUS,,Balanced (DR = CR),'
      : `STATUS,,IMBALANCE OF ${grand} kobo — INVESTIGATE,`,
  );

  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `Prism_Trial_Balance_${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

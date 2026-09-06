import type { ProjectPack } from '@/src/services/projectOps.services';

const CATEGORIES = ['FUND_USE', 'RISK_MITIGATION', 'OTHER'] as const;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type CapexSummary = {
  targetMinor: number;
  raisedMinor: number;
  raiseFeeMinor: number;
  drawnMinor: number;
  currentCapitalMinor: number;
  utilization: number;
  remittanceCount: number;
  byStatus: Record<string, { count: number; amountMinor: number }>;
  byCategoryPaid: Record<string, { count: number; amountMinor: number }>;
  byCategoryPending: Record<string, { count: number; amountMinor: number }>;
};

/** Aggregate CapEx metrics from a project pack (shared by PDF + CSV). */
export function computeCapexSummary(pack: ProjectPack): CapexSummary {
  const project = pack.project;
  const raisedMinor = num(project.raisedMinor);
  const drawnMinor = num(project.drawnMinor);
  const raiseFeeMinor = num(project.raiseFeeMinor);
  const currentCapitalMinor =
    project.currentCapitalMinor != null
      ? num(project.currentCapitalMinor)
      : Math.max(raisedMinor - raiseFeeMinor - drawnMinor, 0);

  const byStatus: CapexSummary['byStatus'] = {};
  const byCategoryPaid: CapexSummary['byCategoryPaid'] = {};
  const byCategoryPending: CapexSummary['byCategoryPending'] = {};
  for (const c of CATEGORIES) {
    byCategoryPaid[c] = { count: 0, amountMinor: 0 };
    byCategoryPending[c] = { count: 0, amountMinor: 0 };
  }

  for (const f of pack.drawdowns ?? []) {
    const status = String(f.status ?? 'UNKNOWN').toUpperCase();
    const cat = String(f.category ?? 'OTHER').toUpperCase();
    const amount = num(f.amountMinor);
    if (!byStatus[status]) byStatus[status] = { count: 0, amountMinor: 0 };
    byStatus[status].count += 1;
    byStatus[status].amountMinor += amount;

    const bucket =
      status === 'PAID'
        ? byCategoryPaid
        : status === 'PENDING' || status === 'APPROVED'
          ? byCategoryPending
          : null;
    if (bucket) {
      if (!bucket[cat]) bucket[cat] = { count: 0, amountMinor: 0 };
      bucket[cat].count += 1;
      bucket[cat].amountMinor += amount;
    }
  }

  return {
    targetMinor: num(project.targetMinor),
    raisedMinor,
    raiseFeeMinor,
    drawnMinor,
    currentCapitalMinor,
    utilization: raisedMinor > 0 ? drawnMinor / raisedMinor : 0,
    remittanceCount: (pack.drawdowns ?? []).length,
    byStatus,
    byCategoryPaid,
    byCategoryPending,
  };
}

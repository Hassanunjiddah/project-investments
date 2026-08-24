import { jsPDF } from 'jspdf';
import type { ProjectPack } from '@/src/services/projectOps.services';
import { MAKER_CREDIT } from '@/src/constants/site';

const INK_TEXT = { r: 15, g: 21, b: 18 };
const INK_MUTED = { r: 78, g: 90, b: 82 };
const INK_LINE = { r: 213, g: 222, b: 216 };
const BRAND_700 = { r: 22, g: 101, b: 52 };

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 42;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_H = 40;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 12;

const CATEGORIES = ['FUND_USE', 'RISK_MITIGATION', 'OTHER'] as const;
const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  FUND_USE: 'Fund use',
  RISK_MITIGATION: 'Risk mitigation',
  OTHER: 'Other',
};

function fmtNaira(minor: unknown): string {
  const n = Number(minor ?? 0) / 100;
  return `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(2)}%`;
}

function fmtDate(iso: unknown): string {
  if (!iso) return '—';
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function str(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

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

/**
 * Institutional Capital Expenditure report (PDF).
 * Actual remittances only — not a CapEx budget.
 */
export function buildCapexPdfBlob(pack: ProjectPack): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const project = pack.project;
  const code = str(project.code);
  const name = str(project.name);
  const summary = computeCapexSummary(pack);
  let y = 56;
  let page = 1;

  const ensureSpace = (need: number) => {
    if (y + need <= CONTENT_BOTTOM) return;
    drawFooter();
    doc.addPage();
    page += 1;
    y = 48;
  };

  const drawFooter = () => {
    doc.setDrawColor(INK_LINE.r, INK_LINE.g, INK_LINE.b);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, PAGE_H - FOOTER_H, PAGE_W - MARGIN_X, PAGE_H - FOOTER_H);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(INK_MUTED.r, INK_MUTED.g, INK_MUTED.b);
    doc.text(`Prism Capital · CapEx · ${MAKER_CREDIT}`, MARGIN_X, PAGE_H - 22);
    doc.text(`Page ${page}`, PAGE_W - MARGIN_X, PAGE_H - 22, { align: 'right' });
  };

  const heading = (title: string) => {
    ensureSpace(36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(BRAND_700.r, BRAND_700.g, BRAND_700.b);
    doc.text(title.toUpperCase(), MARGIN_X, y);
    y += 8;
    doc.setDrawColor(BRAND_700.r, BRAND_700.g, BRAND_700.b);
    doc.setLineWidth(1.2);
    doc.line(MARGIN_X, y, MARGIN_X + 140, y);
    y += 14;
  };

  const kv = (label: string, value: string) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK_MUTED.r, INK_MUTED.g, INK_MUTED.b);
    doc.text(label, MARGIN_X, y);
    doc.setTextColor(INK_TEXT.r, INK_TEXT.g, INK_TEXT.b);
    const lines = doc.splitTextToSize(value, CONTENT_W - 160);
    doc.text(lines, MARGIN_X + 160, y);
    y += Math.max(14, lines.length * 11);
  };

  const para = (text: string) => {
    ensureSpace(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK_TEXT.r, INK_TEXT.g, INK_TEXT.b);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    doc.text(lines, MARGIN_X, y);
    y += lines.length * 11 + 4;
  };

  // Cover
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(BRAND_700.r, BRAND_700.g, BRAND_700.b);
  doc.text('PRISM CAPITAL', MARGIN_X, y);
  y += 18;
  doc.setFontSize(20);
  doc.setTextColor(INK_TEXT.r, INK_TEXT.g, INK_TEXT.b);
  doc.text('Capital Expenditure Report', MARGIN_X, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const titleLines = doc.splitTextToSize(`${name} (${code})`, CONTENT_W);
  doc.text(titleLines, MARGIN_X, y);
  y += titleLines.length * 14 + 10;
  doc.setFontSize(9);
  doc.setTextColor(INK_MUTED.r, INK_MUTED.g, INK_MUTED.b);
  doc.text(`Exported ${fmtDate(pack.exportedAt)}`, MARGIN_X, y);
  y += 10;
  doc.text(
    'Institutional CapEx pack — capital raised vs remitted, category deployment, and remittance register.',
    MARGIN_X,
    y,
  );
  y += 8;
  doc.text(MAKER_CREDIT, MARGIN_X, y);
  y += 28;

  heading('1. Executive capital summary');
  kv('Stage', str(project.stage));
  kv('Approval', str(project.approvalStatus));
  kv('Target capital', fmtNaira(summary.targetMinor));
  kv('Capital raised', fmtNaira(summary.raisedMinor));
  kv(
    'Raise fee reserved',
    `${fmtNaira(summary.raiseFeeMinor)} (${Number(project.raiseFeeBps ?? 0) / 100}% of raised)`,
  );
  kv('Capital remitted (drawn)', fmtNaira(summary.drawnMinor));
  kv('Current capital remaining', fmtNaira(summary.currentCapitalMinor));
  kv('Utilization (drawn / raised)', fmtPct(summary.utilization));
  kv('Remittance requests', String(summary.remittanceCount));

  heading('2. Status totals');
  const statusOrder = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'];
  const statusKeys = [
    ...statusOrder.filter((s) => summary.byStatus[s]),
    ...Object.keys(summary.byStatus).filter((s) => !statusOrder.includes(s)),
  ];
  if (statusKeys.length === 0) {
    para('No remittance requests on this project.');
  } else {
    for (const s of statusKeys) {
      const row = summary.byStatus[s];
      kv(s, `${row.count} request(s) · ${fmtNaira(row.amountMinor)}`);
    }
  }

  heading('3. CapEx by category');
  para(
    'Deployed CapEx = PAID remittances. Pipeline = PENDING + APPROVED (not yet deducted as drawn until paid).',
  );
  for (const cat of CATEGORIES) {
    const paid = summary.byCategoryPaid[cat] ?? { count: 0, amountMinor: 0 };
    const pending = summary.byCategoryPending[cat] ?? { count: 0, amountMinor: 0 };
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(INK_TEXT.r, INK_TEXT.g, INK_TEXT.b);
    doc.text(CATEGORY_LABELS[cat], MARGIN_X, y);
    y += 12;
    kv('  Deployed (PAID)', `${paid.count} · ${fmtNaira(paid.amountMinor)}`);
    kv('  Pipeline (PENDING/APPROVED)', `${pending.count} · ${fmtNaira(pending.amountMinor)}`);
  }

  heading('4. Remittance register');
  const rows = [...(pack.drawdowns ?? [])].sort((a, b) => {
    const ta = new Date(String(a.createdAt ?? a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.createdAt ?? b.created_at ?? 0)).getTime();
    return tb - ta;
  });
  if (rows.length === 0) {
    para('No fund remittance requests.');
  } else {
    for (const f of rows) {
      ensureSpace(72);
      para(
        `${str(f.reference)} · ${str(f.status)} · ${fmtNaira(f.amountMinor)} · ${str(f.category)}`,
      );
      para(`Purpose: ${str(f.purpose)}`);
      para(
        `Pay to: ${str(f.bankName)} · ${str(f.accountName)} · ${str(f.accountNumber)}`,
      );
      para(
        `Evidence: ${str(f.supportDocTitle ?? f.supportDocFileName ?? '—')} · Requested ${fmtDate(f.createdAt ?? f.created_at)} · Decided ${fmtDate(f.decidedAt ?? f.decided_at)}`,
      );
      y += 4;
    }
  }

  heading('5. Controls & scope');
  para(
    'This report reflects actual capital remittances (fund drawdowns) recorded on Prism Capital. It is not a CapEx budget or forecast. FUND_USE remittances require supporting evidence. Requests are subject to Prism Line Manager / CEO approval (four-eyes) before funds are marked paid and capital drawn is updated.',
  );
  para(
    `Confidential · ${code} · Generated for institutional review · ${MAKER_CREDIT}`,
  );

  drawFooter();
  return doc.output('blob');
}

export function downloadCapexPdf(pack: ProjectPack) {
  if (typeof window === 'undefined') return;
  const code = String(pack.project.code ?? 'PROJECT');
  const blob = buildCapexPdfBlob(pack);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-capex.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

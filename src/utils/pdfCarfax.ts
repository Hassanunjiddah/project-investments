import { jsPDF } from 'jspdf';
import type { ProjectPack } from '@/src/services/projectOps.services';

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

function fmtNaira(minor: unknown): string {
  const n = Number(minor ?? 0) / 100;
  return `NGN ${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

/**
 * Generate a printable Carfax-style project transparency report (PDF).
 * Returns a Blob for web download.
 */
export function buildCarfaxPdfBlob(pack: ProjectPack): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const project = pack.project;
  const code = str(project.code);
  const name = str(project.name);
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
    doc.text(`Prism Capital · Carfax report · ${code}`, MARGIN_X, PAGE_H - 22);
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
    doc.line(MARGIN_X, y, MARGIN_X + 120, y);
    y += 14;
  };

  const kv = (label: string, value: string) => {
    ensureSpace(16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(INK_MUTED.r, INK_MUTED.g, INK_MUTED.b);
    doc.text(label, MARGIN_X, y);
    doc.setTextColor(INK_TEXT.r, INK_TEXT.g, INK_TEXT.b);
    const lines = doc.splitTextToSize(value, CONTENT_W - 150);
    doc.text(lines, MARGIN_X + 150, y);
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
  doc.text('Project Carfax Report', MARGIN_X, y);
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
    'Institutional transparency pack — capital, remittances, profits, audit, ledger, and documents.',
    MARGIN_X,
    y,
  );
  y += 28;

  heading('1. Capital snapshot');
  kv('Stage', str(project.stage));
  kv('Approval', str(project.approvalStatus));
  kv('Target', fmtNaira(project.targetMinor));
  kv('Capital raised', fmtNaira(project.raisedMinor));
  kv('Raise fee', `${fmtNaira(project.raiseFeeMinor)} (${Number(project.raiseFeeBps ?? 0) / 100}%)`);
  kv('Drawn', fmtNaira(project.drawnMinor));
  kv('Current capital', fmtNaira(project.currentCapitalMinor));
  kv('Total units', str(project.totalUnits));
  kv('Profit fee', `${Number(project.platformFeeBps ?? 0) / 100}% of net`);
  kv('Realised (gross)', fmtNaira(project.realisedProfitMinor));

  heading('2. Investor register');
  if ((pack.invites ?? []).length === 0) {
    para('No invitations on this project.');
  } else {
    for (const inv of pack.invites) {
      ensureSpace(40);
      para(
        `${str(inv.email)} · ${str(inv.status)} · units ${str(inv.unitsAllotted ?? inv.unitsPledged)} · ${fmtNaira(inv.amountMinor)} · ref ${str(inv.paymentReference)}`,
      );
    }
  }

  heading('3. Profit declarations');
  if ((pack.declarations ?? []).length === 0) {
    para('No profit declarations.');
  } else {
    for (const d of pack.declarations) {
      ensureSpace(48);
      para(
        `${str(d.reference)} · ${str(d.status)}${d.isFinal ? ' · FINAL' : ''} · gross ${fmtNaira(d.grossMinor)} · fee ${fmtNaira(d.platformFeeMinor)} · investor pool ${fmtNaira(d.investorPoolMinor)} · ${fmtDate(d.declaredAt ?? d.createdAt)}`,
      );
    }
  }

  heading('4. Owner remittance history');
  if ((pack.drawdowns ?? []).length === 0) {
    para('No fund remittance requests.');
  } else {
    for (const f of pack.drawdowns) {
      ensureSpace(56);
      para(
        `${str(f.reference)} · ${str(f.status)} · ${fmtNaira(f.amountMinor)} · ${str(f.category)}`,
      );
      para(`Purpose: ${str(f.purpose)}`);
      para(
        `Pay to: ${str(f.bankName)} · ${str(f.accountName)} · ${str(f.accountNumber)} · Evidence: ${str(f.supportDocTitle ?? f.supportDocFileName ?? '—')}`,
      );
    }
  }

  heading('5. Investor withdrawals');
  if ((pack.withdrawals ?? []).length === 0) {
    para('No investor withdrawal requests.');
  } else {
    for (const w of pack.withdrawals) {
      ensureSpace(28);
      para(
        `${str(w.reference)} · ${str(w.status)} · ${fmtNaira(w.amountMinor)} · investor ${str(w.investorId)} · ${fmtDate(w.createdAt)}`,
      );
    }
  }

  heading('6. Audit trail');
  const audit = pack.audit ?? [];
  if (audit.length === 0) {
    para('No audit events recorded.');
  } else {
    for (const a of audit.slice(0, 80)) {
      ensureSpace(28);
      para(
        `${fmtDate(a.createdAt)} · ${str(a.entityType)}.${str(a.eventType)} · ${str(a.entityId)}`,
      );
    }
    if (audit.length > 80) {
      para(`… ${audit.length - 80} additional audit events in the CSV pack.`);
    }
  }

  heading('7. Ledger');
  const ledger = pack.ledger ?? [];
  if (ledger.length === 0) {
    para('No ledger entries.');
  } else {
    for (const l of ledger.slice(0, 120)) {
      ensureSpace(22);
      para(
        `${str(l.transactionRef)} · ${str(l.accountCode)} · ${str(l.direction)} ${fmtNaira(l.amountMinor)} · ${str(l.memo)}`,
      );
    }
    if (ledger.length > 120) {
      para(`… ${ledger.length - 120} additional ledger lines in the CSV pack.`);
    }
  }

  heading('8. Document index');
  const documents = pack.documents ?? [];
  if (documents.length === 0) {
    para('No project documents indexed.');
  } else {
    for (const d of documents) {
      ensureSpace(24);
      para(
        `${str(d.kind)} · ${str(d.title)} · ${str(d.fileName)} · ${fmtDate(d.createdAt)}`,
      );
    }
  }

  drawFooter();
  return doc.output('blob');
}

export function downloadCarfaxPdf(pack: ProjectPack) {
  if (typeof window === 'undefined') return;
  const code = String(pack.project.code ?? 'PROJECT');
  const blob = buildCarfaxPdfBlob(pack);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PRSM-${code}-carfax.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

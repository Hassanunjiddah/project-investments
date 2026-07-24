import { jsPDF } from 'jspdf';
import type { InvestorNotice } from '@/src/services/transparency.services';

// ─── Brand palette (PDF-local — kept in sync with src/constants/colors.ts) ──
const INK_TEXT = { r: 15, g: 21, b: 18 };
const INK_MUTED = { r: 78, g: 90, b: 82 };
const INK_LINE = { r: 213, g: 222, b: 216 };
const INK_FAINT = { r: 244, g: 247, b: 245 };
const BRAND_700 = { r: 22, g: 101, b: 52 };  // #166534
const BRAND_50 = { r: 238, g: 247, b: 240 }; // #EEF7F0
const GOLD_500 = { r: 176, g: 141, b: 46 };  // #B08D2E

// Page geometry (A4 portrait, pt).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const HEADER_H = 74;   // top letterhead band
const FOOTER_H = 56;   // bottom band
const CONTENT_TOP = HEADER_H + 22;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 16;

// ─── Formatting helpers ─────────────────────────────────────────────────
/** Format kobo → "₦1,234,567.00" (bold Naira sign; UI shows ₦ via Unicode). */
function fmtNaira(minor: number): string {
  const n = (minor / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // jsPDF's built-in fonts don't cover the ₦ codepoint reliably; use "NGN".
  return `NGN ${n}`;
}

/** Format a negative kobo figure as "- NGN 1,000.00". */
function fmtNairaNeg(minor: number): string {
  return `- ${fmtNaira(minor)}`;
}

/** dd MMMM yyyy · HH:mm */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** dd MMMM yyyy */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Percentage from bps ("7.50%"). */
function fmtBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// ─── Cumulative summary ─────────────────────────────────────────────────
export type CumulativeSummary = {
  /** All-time distributions on this project prior to *and including* this notice. */
  totalDistributionsMinor: number;
  /** Number of distributions issued on this project so far. */
  distributionsCount: number;
  /** Optional: the investor's original capital commitment on this project.
   *  Callers may compute from `unitsAllotted × unitPrice` and pass through. */
  investedMinor?: number;
};

/**
 * Derive a cumulative summary from the caller's known list of notices.
 * Includes the current notice. Only notices with the same `projectId` are
 * considered.
 */
export function computeCumulative(
  allNotices: InvestorNotice[],
  currentNotice: InvestorNotice,
  investedMinor?: number,
): CumulativeSummary {
  const onProject = allNotices.filter((n) => n.projectId === currentNotice.projectId);
  const upToNow = onProject.filter((n) => n.createdAt <= currentNotice.createdAt);
  const totalDistributionsMinor = upToNow.reduce(
    (sum, n) => sum + n.profitMinor + (n.isFinal ? n.capitalReturnedMinor : 0),
    0,
  );
  return {
    totalDistributionsMinor,
    distributionsCount: upToNow.length,
    investedMinor,
  };
}

// ─── PDF primitives ─────────────────────────────────────────────────────
type Rgb = { r: number; g: number; b: number };
function setColor(doc: jsPDF, c: Rgb, target: 'text' | 'fill' | 'draw' = 'text') {
  if (target === 'text') doc.setTextColor(c.r, c.g, c.b);
  if (target === 'fill') doc.setFillColor(c.r, c.g, c.b);
  if (target === 'draw') doc.setDrawColor(c.r, c.g, c.b);
}

/** Draw the letterhead band. Called on every page. */
function drawHeader(doc: jsPDF, opts: { reference: string; issuedAt: string }) {
  // Top green rule
  setColor(doc, BRAND_700, 'fill');
  doc.rect(0, 0, PAGE_W, 4, 'F');

  // Wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setColor(doc, BRAND_700, 'text');
  doc.text('Prism Capital', MARGIN_X, 38);

  // Tagline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK_MUTED, 'text');
  doc.text('Institutional Private Placements', MARGIN_X, 52);

  // Right side: statement number + issue date
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  setColor(doc, INK_TEXT, 'text');
  doc.text(opts.reference, PAGE_W - MARGIN_X, 34, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK_MUTED, 'text');
  doc.text(`Issued ${fmtDate(opts.issuedAt)}`, PAGE_W - MARGIN_X, 50, { align: 'right' });

  // Divider under the letterhead
  setColor(doc, INK_LINE, 'draw');
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, HEADER_H - 8, PAGE_W - MARGIN_X, HEADER_H - 8);
}

/** Draw footer band. Called on every page after content is laid out. */
function drawFooter(
  doc: jsPDF,
  opts: { reference: string; generatedAt: Date; page: number; total: number },
) {
  const y = PAGE_H - FOOTER_H;

  // Top divider
  setColor(doc, INK_LINE, 'draw');
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);

  // Legal line
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  setColor(doc, INK_MUTED, 'text');
  const legal =
    "Private placement. This statement is generated from Prism Capital's audited transaction ledger.";
  doc.text(legal, MARGIN_X, y + 16);

  // Second line: generation timestamp + statement ref + page X of Y
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const genLine = `Generated ${fmtDateTime(opts.generatedAt.toISOString())}`;
  doc.text(genLine, MARGIN_X, y + 30);

  doc.setFont('courier', 'normal');
  doc.text(opts.reference, PAGE_W / 2, y + 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.text(`Page ${opts.page} of ${opts.total}`, PAGE_W - MARGIN_X, y + 30, { align: 'right' });
}

/** Ensure the cursor has room; add a page if not. Returns updated y. */
function ensureRoom(doc: jsPDF, y: number, needed: number, ctx: HeaderCtx): number {
  if (y + needed <= CONTENT_BOTTOM) return y;
  doc.addPage();
  drawHeader(doc, ctx);
  return CONTENT_TOP;
}

type HeaderCtx = { reference: string; issuedAt: string };

// ─── Section painters ───────────────────────────────────────────────────
function sectionLabel(doc: jsPDF, y: number, label: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, BRAND_700, 'text');
  doc.text(label.toUpperCase(), MARGIN_X, y);
  // underline
  setColor(doc, BRAND_700, 'draw');
  doc.setLineWidth(1);
  doc.line(MARGIN_X, y + 4, MARGIN_X + 24, y + 4);
  return y + 18;
}

function twoUpBlock(
  doc: jsPDF,
  y: number,
  left: { heading: string; lines: string[] },
  right: { heading: string; lines: string[] },
): number {
  const colW = (CONTENT_W - 16) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colW + 16;
  const rowH = 14;
  const contentLines = Math.max(left.lines.length, right.lines.length);
  const boxH = 32 + contentLines * rowH;

  setColor(doc, INK_FAINT, 'fill');
  setColor(doc, INK_LINE, 'draw');
  doc.setLineWidth(0.6);
  doc.roundedRect(leftX, y, colW, boxH, 6, 6, 'FD');
  doc.roundedRect(rightX, y, colW, boxH, 6, 6, 'FD');

  const paintCol = (x: number, block: { heading: string; lines: string[] }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setColor(doc, INK_MUTED, 'text');
    doc.text(block.heading.toUpperCase(), x + 12, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(doc, INK_TEXT, 'text');
    let cy = y + 32;
    for (const line of block.lines) {
      doc.text(line, x + 12, cy);
      cy += rowH;
    }
  };
  paintCol(leftX, left);
  paintCol(rightX, right);

  return y + boxH + 14;
}

function waterfallTable(
  doc: jsPDF,
  y: number,
  n: InvestorNotice,
): number {
  const rowH = 20;
  const costsMinor = Math.max(0, n.grossMinor - n.netMinor);
  // Manager share is what's left in the distributable pool after investor pool +
  // platform fee. Because the notice payload doesn't expose it directly, derive.
  const distributableMinor = n.netMinor - n.platformFeeMinor;
  const managerShareMinor = Math.max(0, distributableMinor - n.investorPoolMinor);

  type Row = { label: string; value: string; kind?: 'positive' | 'negative' | 'subtotal' | 'hero' };
  const rows: Row[] = [
    { label: 'Gross profit', value: fmtNaira(n.grossMinor) },
    { label: 'Costs', value: fmtNairaNeg(costsMinor), kind: 'negative' },
    { label: 'Net after costs', value: fmtNaira(n.netMinor), kind: 'subtotal' },
    { label: `Prism Capital fee (${fmtBps(n.platformFeeBps)})`, value: fmtNairaNeg(n.platformFeeMinor), kind: 'negative' },
    { label: 'Distributable pool', value: fmtNaira(distributableMinor), kind: 'subtotal' },
    { label: `Investor pool (${(n.profitSplitInvestorBps / 100).toFixed(0)}%)`, value: fmtNaira(n.investorPoolMinor) },
    { label: 'Manager share', value: fmtNaira(managerShareMinor) },
    { label: `Per unit${n.perUnitMinor > 0 ? ` (pool: ${Math.round(n.investorPoolMinor / n.perUnitMinor)} units)` : ''}`, value: fmtNaira(n.perUnitMinor), kind: 'subtotal' },
  ];

  // Header row
  setColor(doc, INK_LINE, 'draw');
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, INK_MUTED, 'text');
  doc.text('DESCRIPTION', MARGIN_X, y + 8);
  doc.text('AMOUNT', PAGE_W - MARGIN_X, y + 8, { align: 'right' });
  y += 14;
  doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  y += 4;

  // Rows
  for (const row of rows) {
    doc.setFont('helvetica', row.kind === 'subtotal' ? 'bold' : 'normal');
    doc.setFontSize(10);
    setColor(doc, INK_TEXT, 'text');
    doc.text(row.label, MARGIN_X, y + 12);
    doc.setFont('courier', row.kind === 'subtotal' ? 'bold' : 'normal');
    if (row.kind === 'negative') setColor(doc, INK_MUTED, 'text');
    doc.text(row.value, PAGE_W - MARGIN_X, y + 12, { align: 'right' });
    y += rowH;
    // hairline between rows
    setColor(doc, INK_LINE, 'draw');
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
  }
  return y + 10;
}

function yourShareHero(doc: jsPDF, y: number, n: InvestorNotice): number {
  const boxH = 78;
  setColor(doc, BRAND_50, 'fill');
  setColor(doc, BRAND_700, 'draw');
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 8, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, BRAND_700, 'text');
  doc.text('YOUR SHARE', MARGIN_X + 18, y + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  setColor(doc, INK_TEXT, 'text');
  doc.text(fmtNaira(n.profitMinor), MARGIN_X + 18, y + 52);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, INK_MUTED, 'text');
  doc.text(
    `${n.unitsHeld} units × ${fmtNaira(n.perUnitMinor)} per unit`,
    MARGIN_X + 18,
    y + 66,
  );

  if (n.isFinal && n.capitalReturnedMinor > 0) {
    // Right-aligned "+ capital returned" chip
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setColor(doc, GOLD_500, 'text');
    doc.text('+ CAPITAL RETURNED', PAGE_W - MARGIN_X - 18, y + 22, { align: 'right' });
    doc.setFont('courier', 'bold');
    doc.setFontSize(16);
    setColor(doc, INK_TEXT, 'text');
    doc.text(fmtNaira(n.capitalReturnedMinor), PAGE_W - MARGIN_X - 18, y + 46, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setColor(doc, INK_MUTED, 'text');
    doc.text(
      `Total credit: ${fmtNaira(n.profitMinor + n.capitalReturnedMinor)}`,
      PAGE_W - MARGIN_X - 18,
      y + 66,
      { align: 'right' },
    );
  }

  return y + boxH + 16;
}

function cumulativeBlock(doc: jsPDF, y: number, cum: CumulativeSummary): number {
  y = sectionLabel(doc, y, 'Cumulative on this project');

  const rows: Array<[string, string]> = [
    ['Distributions issued to date', String(cum.distributionsCount)],
    ['Total distributions received', fmtNaira(cum.totalDistributionsMinor)],
  ];
  if (typeof cum.investedMinor === 'number') {
    rows.unshift(['Original capital committed', fmtNaira(cum.investedMinor)]);
    const roi = cum.investedMinor > 0
      ? ((cum.totalDistributionsMinor / cum.investedMinor) * 100).toFixed(2) + '%'
      : '—';
    rows.push(['Return on capital to date', roi]);
  }

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setColor(doc, INK_TEXT, 'text');
    doc.text(label, MARGIN_X, y + 12);
    doc.setFont('courier', 'normal');
    doc.text(value, PAGE_W - MARGIN_X, y + 12, { align: 'right' });
    setColor(doc, INK_LINE, 'draw');
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y + 18, PAGE_W - MARGIN_X, y + 18);
    y += 22;
  }
  return y + 8;
}

// ─── Main API ───────────────────────────────────────────────────────────
export type DownloadNoticePdfOpts = {
  investorName?: string;
  investorEmail?: string;
  cumulative?: CumulativeSummary;
};

/**
 * Generate + download an institutional-grade PDF statement.
 *
 * Structure:
 *   1. Letterhead (every page)                  — wordmark, ref, issue date
 *   2. INVESTOR + PROJECT blocks (two-up)
 *   3. YOUR SHARE hero
 *   4. Waterfall table (gross → per-unit)
 *   5. CUMULATIVE on this project
 *   6. Footer band (every page)                 — legal, gen-time, ref, page X/Y
 *
 * Colour discipline: brand green only on top rule + section labels + hero
 * outline. Everything else greyscale → prints legibly in BW.
 */
export function downloadNoticePdf(n: InvestorNotice, opts: DownloadNoticePdfOpts = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const headerCtx: HeaderCtx = { reference: n.reference, issuedAt: n.createdAt };
  const generatedAt = new Date();

  // Page 1
  drawHeader(doc, headerCtx);
  let y = CONTENT_TOP;

  // Statement title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  setColor(doc, INK_TEXT, 'text');
  doc.text(
    n.isFinal ? 'FINAL Distribution Statement' : 'Distribution Statement',
    MARGIN_X,
    y,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setColor(doc, INK_MUTED, 'text');
  doc.text(
    n.declarationLabel
      ? `${n.declarationReference} · ${n.declarationLabel}`
      : n.declarationReference,
    MARGIN_X,
    y + 16,
  );
  y += 40;

  // Investor + Project blocks
  y = twoUpBlock(
    doc,
    y,
    {
      heading: 'Investor',
      lines: [
        opts.investorName ?? '—',
        opts.investorEmail ?? '',
      ].filter(Boolean),
    },
    {
      heading: 'Project',
      lines: [n.projectName, n.projectCode, n.isFinal ? 'Stage: END (final)' : 'Stage: IN PROGRESS'],
    },
  );

  // Hero
  y = ensureRoom(doc, y, 96, headerCtx);
  y = yourShareHero(doc, y, n);

  // Waterfall
  y = ensureRoom(doc, y, 220, headerCtx);
  y = sectionLabel(doc, y, 'Distribution waterfall');
  y = waterfallTable(doc, y, n);

  // Cumulative
  if (opts.cumulative) {
    y = ensureRoom(doc, y, 100, headerCtx);
    y = cumulativeBlock(doc, y, opts.cumulative);
  }

  // ── Footer + page numbers ─────────────────────────────────────────────
  const total = doc.internal.pages.length - 1; // jsPDF pages array is 1-indexed
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, {
      reference: n.reference,
      generatedAt,
      page: p,
      total,
    });
  }

  doc.save(`Statement_${n.reference}.pdf`);
}

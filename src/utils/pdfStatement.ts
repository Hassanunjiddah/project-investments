import { jsPDF } from 'jspdf';
import { InvestorNotice } from '@/src/services/transparency.services';

function fmt(minor: number): string {
  const n = (minor / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  return `NGN ${n}`;
}

/**
 * Generate + download a PDF statement for an investor distribution notice.
 * Works on Expo Web only (uses browser download). Native platforms can wire
 * `expo-print` later.
 */
export function downloadNoticePdf(n: InvestorNotice, investorName?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 64;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(22, 101, 52); // #166534
  doc.text('Prism Capital', marginX, y);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Distribution Notice · Institutional Private Placement', marginX, y + 16);

  // Reference
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(n.reference, width - marginX, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    width - marginX, y + 16, { align: 'right' });

  y += 48;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, width - marginX, y);
  y += 24;

  // Project + investor block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(n.projectName, marginX, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Investor: ${investorName ?? '—'}`,
    marginX,
    y,
  );
  doc.text(
    `Declaration: ${n.declarationReference}${n.declarationLabel ? ' · ' + n.declarationLabel : ''}`,
    marginX,
    y + 14,
  );
  y += 44;

  // Hero: your share
  doc.setFillColor(240, 253, 244); // primaryLight
  doc.roundedRect(marginX, y, width - marginX * 2, 72, 8, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text('YOUR SHARE', marginX + 16, y + 22);
  doc.setFontSize(24);
  doc.text(fmt(n.profitMinor), marginX + 16, y + 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${n.unitsHeld} units × ${fmt(n.perUnitMinor)}`,
    width - marginX - 16,
    y + 52,
    { align: 'right' },
  );
  y += 96;

  if (n.isFinal && n.capitalReturnedMinor > 0) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(marginX, y, width - marginX * 2, 44, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(22, 101, 52);
    doc.text(`+ Capital returned: ${fmt(n.capitalReturnedMinor)}`, marginX + 16, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(
      `Total credit: ${fmt(n.profitMinor + n.capitalReturnedMinor)}`,
      marginX + 16,
      y + 36,
    );
    y += 62;
  }

  // Waterfall
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('HOW THIS WAS CALCULATED', marginX, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const rows: Array<[string, string]> = [
    ['Gross profit', fmt(n.grossMinor)],
    ['Net after costs', fmt(n.netMinor)],
    [`Prism Capital fee (${(n.platformFeeBps / 100).toFixed(1)}%)`, `-${fmt(n.platformFeeMinor)}`],
    [`Investor pool (${(n.profitSplitInvestorBps / 100).toFixed(0)}%)`, fmt(n.investorPoolMinor)],
    [`Per unit`, fmt(n.perUnitMinor)],
  ];
  for (const [label, value] of rows) {
    doc.setFontSize(10);
    doc.text(label, marginX, y);
    doc.setFont('courier', 'normal');
    doc.text(value, width - marginX, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 16;
  }

  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(marginX, y, width - marginX, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52);
  doc.text(`Your ${n.unitsHeld} × ${fmt(n.perUnitMinor)}`, marginX, y);
  doc.setFont('courier', 'bold');
  doc.text(fmt(n.profitMinor), width - marginX, y, { align: 'right' });
  y += 32;

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const footer =
    'This is an immutable distribution notice generated at declaration approval. ' +
    'Every number is locked at the timestamp above and can be cross-referenced ' +
    'to the underlying ledger entries.';
  doc.text(doc.splitTextToSize(footer, width - marginX * 2), marginX, y);

  doc.save(`Statement_${n.reference}.pdf`);
}

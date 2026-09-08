import { Platform } from 'react-native';

/** Quote a CSV field when it contains a delimiter, quote, or newline. */
function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV document from a header row and data rows. */
export function buildCsv(header: string[], rows: (string | number)[][]): string {
  return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n');
}

/**
 * Deliver a CSV to the user: browser download on web, share sheet on native.
 * The UTF-8 BOM makes Excel open the file with correct encoding.
 */
export async function downloadCsv(filename: string, csv: string): Promise<void> {
  const content = `\uFEFF${csv}`;

  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: filename,
  });
}

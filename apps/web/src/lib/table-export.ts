export type TableExportFormat = 'pdf' | 'xlsx' | 'txt';

export type ExportTableSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .trim();
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(sections: ExportTableSection[]): string {
  const lines: string[] = ['sep=;'];
  for (const section of sections) {
    lines.push(escapeCsvCell(section.title));
    lines.push(section.headers.map(escapeCsvCell).join(';'));
    for (const row of section.rows) {
      const cells = section.headers.map((_, index) => escapeCsvCell(sanitizeCell(row[index] ?? '')));
      lines.push(cells.join(';'));
    }
    lines.push('');
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

function columnWidths(headers: string[], rows: string[][], maxWidth = 36): number[] {
  return headers.map((header, index) => {
    const longest = Math.max(
      header.length,
      ...rows.map((row) => sanitizeCell(row[index] ?? '').length),
    );
    return Math.min(maxWidth, Math.max(8, longest));
  });
}

function truncate(value: string, width: number): string {
  const text = sanitizeCell(value);
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(1, width - 1))}…`;
}

function buildTxt(sections: ExportTableSection[]): string {
  const blocks: string[] = [];
  for (const section of sections) {
    const widths = columnWidths(section.headers, section.rows);
    const formatRow = (cells: string[]) =>
      cells.map((cell, index) => truncate(cell, widths[index]).padEnd(widths[index])).join('  ');
    blocks.push(`${section.title.toUpperCase()} (${section.rows.length})`);
    blocks.push(formatRow(section.headers));
    blocks.push(formatRow(widths.map((width) => '-'.repeat(width))));
    for (const row of section.rows) {
      blocks.push(formatRow(section.headers.map((_, index) => row[index] ?? '')));
    }
    blocks.push('');
  }
  return blocks.join('\r\n');
}

async function buildPdf(title: string, subtitle: string | undefined, sections: ExportTableSection[]) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const document = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let cursorY = 14;

  document.setFontSize(14);
  document.text(title, 14, cursorY);
  cursorY += 7;
  if (subtitle) {
    document.setFontSize(9);
    document.text(subtitle, 14, cursorY);
    cursorY += 8;
  }

  for (const section of sections) {
    if (cursorY > 180) {
      document.addPage();
      cursorY = 14;
    }
    document.setFontSize(11);
    document.text(`${section.title} (${section.rows.length})`, 14, cursorY);
    cursorY += 4;

    autoTable(document, {
      startY: cursorY,
      head: [section.headers],
      body: section.rows.map((row) => section.headers.map((_, index) => sanitizeCell(row[index] ?? ''))),
      styles: {
        fontSize: 7.5,
        cellPadding: 1.6,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [33, 37, 41],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });

    const finalY = (document as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY) + 10;
  }

  return document;
}

export async function exportTablesReport(options: {
  filename: string;
  title: string;
  subtitle?: string;
  sections: ExportTableSection[];
  format: TableExportFormat;
}) {
  const { filename, title, subtitle, sections, format } = options;

  if (format === 'xlsx') {
    downloadBlob(
      new Blob([buildCsv(sections)], { type: 'text/csv;charset=utf-8' }),
      `${filename}.csv`,
    );
    return;
  }

  if (format === 'txt') {
    const header = [title, subtitle].filter(Boolean).join('\r\n');
    downloadBlob(
      new Blob([`${header}\r\n\r\n${buildTxt(sections)}`], { type: 'text/plain;charset=utf-8' }),
      `${filename}.txt`,
    );
    return;
  }

  const document = await buildPdf(title, subtitle, sections);
  document.save(`${filename}.pdf`);
}

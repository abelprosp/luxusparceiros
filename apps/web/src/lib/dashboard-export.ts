import type { DashboardDetailRow, DashboardDetails } from '@luxus/types';

export type DashboardExportFormat = 'pdf' | 'xlsx' | 'txt';

const SECTION_LABELS: Record<keyof Pick<DashboardDetails, 'sales' | 'partners' | 'lines' | 'commissions' | 'campaigns'>, string> = {
  sales: 'Vendas realizadas',
  partners: 'Parceiros',
  lines: 'Linhas',
  commissions: 'Comissões',
  campaigns: 'Campanhas',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

function formatValue(value?: number) {
  return value == null ? '' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function rowsToObjects(rows: DashboardDetailRow[]) {
  return rows.map((row) => ({
    Item: row.primary,
    Detalhes: row.secondary ?? '',
    Status: row.status ?? '',
    Valor: row.value ?? '',
    Data: formatDate(row.date),
  }));
}

function reportSections(details: DashboardDetails) {
  return (Object.keys(SECTION_LABELS) as Array<keyof typeof SECTION_LABELS>).map((key) => ({
    key,
    label: SECTION_LABELS[key],
    rows: details[key],
  }));
}

export async function exportDashboardReport(
  details: DashboardDetails,
  format: DashboardExportFormat,
) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `relatorio-dashboard-${timestamp}`;

  if (format === 'xlsx') {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Seção', 'Item', 'Detalhes', 'Status', 'Valor', 'Data'];
    const rows = reportSections(details).flatMap((section) =>
      rowsToObjects(section.rows).map((row) => [
        section.label,
        row.Item,
        row.Detalhes,
        row.Status,
        row.Valor,
        row.Data,
      ]),
    );
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(';')).join('\r\n');
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
      `${filename}.csv`,
    );
    return;
  }

  if (format === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const document = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = document.internal.pageSize.getWidth();
    let y = 18;
    document.setFontSize(16);
    document.text('Relatório do Dashboard', 14, y);
    y += 8;
    document.setFontSize(9);
    document.text(`Escopo: ${details.scopeLabel}`, 14, y);
    y += 5;
    document.text(`Gerado em: ${formatDate(details.generatedAt)}`, 14, y);
    y += 9;

    for (const section of reportSections(details)) {
      if (y > 270) {
        document.addPage();
        y = 18;
      }
      document.setFontSize(12);
      document.text(`${section.label} (${section.rows.length})`, 14, y);
      y += 6;
      document.setFontSize(8);
      for (const row of section.rows) {
        const line = [row.primary, row.secondary, row.status, formatValue(row.value), formatDate(row.date)]
          .filter(Boolean)
          .join(' | ');
        const lines = document.splitTextToSize(line, pageWidth - 28) as string[];
        if (y + lines.length * 4 > 282) {
          document.addPage();
          y = 18;
        }
        document.text(lines, 14, y);
        y += lines.length * 4 + 1;
      }
      y += 5;
    }
    document.save(`${filename}.pdf`);
    return;
  }

  const text = [
    'RELATÓRIO DO DASHBOARD',
    `Escopo: ${details.scopeLabel}`,
    `Gerado em: ${formatDate(details.generatedAt)}`,
    '',
    ...reportSections(details).flatMap((section) => [
      `${section.label.toUpperCase()} (${section.rows.length})`,
      ...section.rows.map((row) =>
        [row.primary, row.secondary, row.status, formatValue(row.value), formatDate(row.date)]
          .filter(Boolean)
          .join(' | '),
      ),
      '',
    ]),
  ].join('\r\n');
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${filename}.txt`);
}

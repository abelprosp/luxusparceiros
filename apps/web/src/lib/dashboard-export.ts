import type { DashboardDetailRow, DashboardDetails } from '@luxus/types';
import { exportTablesReport, type TableExportFormat } from '@/lib/table-export';

export type DashboardExportFormat = TableExportFormat;

const SECTION_LABELS: Record<
  keyof Pick<
    DashboardDetails,
    'sales' | 'salesInProgress' | 'salesCancelled' | 'partners' | 'lines' | 'commissions' | 'campaigns'
  >,
  string
> = {
  sales: 'Vendas realizadas',
  salesInProgress: 'Vendas em andamento',
  salesCancelled: 'Vendas canceladas',
  partners: 'Parceiros',
  lines: 'Linhas',
  commissions: 'Comissões',
  campaigns: 'Campanhas',
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : '';
}

function formatValue(value?: number) {
  return value == null ? '' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  const sections = reportSections(details).map((section) => ({
    title: section.label,
    headers: ['Item', 'Detalhes', 'Status', 'Valor', 'Data'],
    rows: section.rows.map((row: DashboardDetailRow) => [
      row.primary,
      row.secondary ?? '',
      row.status ?? '',
      row.value == null ? '' : formatValue(row.value),
      formatDate(row.date),
    ]),
  }));

  await exportTablesReport({
    filename: `relatorio-dashboard-${timestamp}`,
    title: 'Relatório do Dashboard',
    subtitle: `${details.scopeLabel} • Gerado em ${formatDate(details.generatedAt)}`,
    sections,
    format,
  });
}

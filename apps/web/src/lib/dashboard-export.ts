import {
  LINE_STATUS_LABELS,
  SALE_STATUS_LABELS,
  type DashboardDetailRow,
  type DashboardDetails,
} from '@luxus/types';
import type { Cell, Row } from 'write-excel-file/browser';
import { exportTablesReport, type TableExportFormat } from '@/lib/table-export';

export type DashboardExportFormat = TableExportFormat;

const STATUS_LABELS: Record<string, string> = {
  ...SALE_STATUS_LABELS,
  ...LINE_STATUS_LABELS,
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  INACTIVE: 'Inativo',
  FORECAST: 'Previsão',
  PAID: 'Pagamento confirmado',
};

type ColumnKind = 'text' | 'money' | 'date' | 'integer';

type ReportColumn = {
  header: string;
  width: number;
  kind: ColumnKind;
};

type ReportSheet = {
  name: string;
  columns: ReportColumn[];
  rows: Array<Array<string | number | Date | null>>;
};

const HEADER_STYLE = {
  fontWeight: 'bold' as const,
  backgroundColor: '#0f172a',
  color: '#ffffff',
  alignVertical: 'center' as const,
};

const ALT_ROW = { backgroundColor: '#f8fafc' };

export function dashboardStatusLabel(status?: string) {
  if (!status) return '';
  return STATUS_LABELS[status] ?? status;
}

function plainMoney(value: number) {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${formatted.replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ')}`;
}

function plainDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
}

function asDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function saleFields(row: DashboardDetailRow) {
  if (row.partnerName || row.clientName || row.planName) {
    return {
      partner: row.partnerName ?? '',
      branch: row.branchName ?? '',
      client: row.clientName ?? '',
      plan: row.planName ?? '',
      line: row.lineNumber ?? '',
      phone: row.phone ?? '',
      document: row.document ?? '',
    };
  }

  const parts = (row.secondary ?? '').split(' • ').map((part) => part.trim()).filter(Boolean);
  const labeled = (prefix: string) =>
    parts.find((part) => part.toLowerCase().startsWith(`${prefix.toLowerCase()} `))
      ?.slice(prefix.length + 1)
      .trim() ?? '';
  const plain = parts.filter((part) => !/^(linha|tel|cpf|cnpj)\s/i.test(part));
  return {
    partner: plain[0] ?? '',
    branch: plain[1] ?? '',
    client: plain[2] ?? '',
    plan: plain[3] ?? '',
    line: labeled('Linha'),
    phone: labeled('Tel'),
    document: labeled('CPF') || labeled('CNPJ'),
  };
}

function partnerPlace(row: DashboardDetailRow) {
  if (row.city || row.state) {
    return { city: row.city ?? '', state: row.state ?? '' };
  }
  const text = row.secondary ?? '';
  const split = text.lastIndexOf(' - ');
  if (split < 0) return { city: text, state: '' };
  return { city: text.slice(0, split), state: text.slice(split + 3) };
}

function lineFields(row: DashboardDetailRow) {
  if (row.operatorName || row.partnerName) {
    return {
      number: row.lineNumber || row.primary,
      operator: row.operatorName ?? '',
      partner: row.partnerName ?? '',
    };
  }
  const [operator, partner] = (row.secondary ?? '').split(' • ').map((part) => part.trim());
  return {
    number: row.primary,
    operator: operator ?? '',
    partner: partner ?? '',
  };
}

function campaignCount(row: DashboardDetailRow) {
  if (row.count != null) return row.count;
  const match = row.secondary?.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

const SALE_COLUMNS: ReportColumn[] = [
  { header: 'Protocolo', width: 22, kind: 'text' },
  { header: 'Parceiro', width: 28, kind: 'text' },
  { header: 'Filial', width: 28, kind: 'text' },
  { header: 'Cliente', width: 36, kind: 'text' },
  { header: 'Plano', width: 16, kind: 'text' },
  { header: 'Linha', width: 20, kind: 'text' },
  { header: 'Telefone', width: 20, kind: 'text' },
  { header: 'CPF/CNPJ', width: 20, kind: 'text' },
  { header: 'Status', width: 18, kind: 'text' },
  { header: 'Valor', width: 14, kind: 'money' },
  { header: 'Data', width: 20, kind: 'date' },
];

function saleRows(rows: DashboardDetailRow[]): ReportSheet['rows'] {
  return rows.map((row) => {
    const fields = saleFields(row);
    return [
      row.primary,
      fields.partner,
      fields.branch,
      fields.client,
      fields.plan,
      fields.line,
      fields.phone,
      fields.document,
      dashboardStatusLabel(row.status),
      row.value ?? null,
      asDate(row.date),
    ];
  });
}

function reportSheets(details: DashboardDetails): ReportSheet[] {
  const sales = (name: string, rows: DashboardDetailRow[]): ReportSheet => ({
    name,
    columns: SALE_COLUMNS,
    rows: saleRows(rows),
  });

  const summaryRows: ReportSheet['rows'] = [
    ['Vendas realizadas', details.sales.length, sum(details.sales)],
    ['Vendas em andamento', details.salesInProgress.length, sum(details.salesInProgress)],
    ['Vendas canceladas', details.salesCancelled.length, sum(details.salesCancelled)],
    ['Parceiros', details.partners.length, null],
    ['Linhas', details.lines.length, null],
    ['Comissões', details.commissions.length, sum(details.commissions)],
    ['Campanhas', details.campaigns.length, sum(details.campaigns)],
  ];

  return [
    {
      name: 'Resumo',
      columns: [
        { header: 'Indicador', width: 28, kind: 'text' },
        { header: 'Quantidade', width: 16, kind: 'integer' },
        { header: 'Valor total', width: 18, kind: 'money' },
      ],
      rows: summaryRows,
    },
    sales('Vendas realizadas', details.sales),
    sales('Vendas em andamento', details.salesInProgress),
    sales('Vendas canceladas', details.salesCancelled),
    {
      name: 'Parceiros',
      columns: [
        { header: 'Parceiro', width: 36, kind: 'text' },
        { header: 'Cidade', width: 24, kind: 'text' },
        { header: 'UF', width: 8, kind: 'text' },
        { header: 'Status', width: 16, kind: 'text' },
        { header: 'Cadastro', width: 20, kind: 'date' },
      ],
      rows: details.partners.map((row) => {
        const place = partnerPlace(row);
        return [row.primary, place.city, place.state, dashboardStatusLabel(row.status), asDate(row.date)];
      }),
    },
    {
      name: 'Linhas',
      columns: [
        { header: 'Número', width: 20, kind: 'text' },
        { header: 'Operadora', width: 20, kind: 'text' },
        { header: 'Parceiro', width: 32, kind: 'text' },
        { header: 'Status', width: 16, kind: 'text' },
        { header: 'Data', width: 20, kind: 'date' },
      ],
      rows: details.lines.map((row) => {
        const fields = lineFields(row);
        return [fields.number, fields.operator, fields.partner, dashboardStatusLabel(row.status), asDate(row.date)];
      }),
    },
    {
      name: 'Comissões',
      columns: [
        { header: 'Protocolo da venda', width: 22, kind: 'text' },
        { header: 'Parceiro', width: 32, kind: 'text' },
        { header: 'Status', width: 24, kind: 'text' },
        { header: 'Valor', width: 14, kind: 'money' },
        { header: 'Data', width: 20, kind: 'date' },
      ],
      rows: details.commissions.map((row) => [
        row.primary,
        row.partnerName || row.secondary || '',
        dashboardStatusLabel(row.status),
        row.value ?? null,
        asDate(row.date),
      ]),
    },
    {
      name: 'Campanhas',
      columns: [
        { header: 'Campanha', width: 36, kind: 'text' },
        { header: 'Vendas', width: 12, kind: 'integer' },
        { header: 'Valor', width: 14, kind: 'money' },
      ],
      rows: details.campaigns.map((row) => [
        row.primary,
        campaignCount(row),
        row.value ?? null,
      ]),
    },
  ];
}

function sum(rows: DashboardDetailRow[]) {
  const total = rows.reduce((acc, row) => acc + (row.value ?? 0), 0);
  return rows.some((row) => row.value != null) ? total : null;
}

function textFor(kind: ColumnKind, value: string | number | Date | null) {
  if (value == null || value === '') return '';
  if (kind === 'money' && typeof value === 'number') return plainMoney(value);
  if (kind === 'date') return value instanceof Date ? plainDate(value.toISOString()) : plainDate(String(value));
  return String(value);
}

function excelCell(
  kind: ColumnKind,
  value: string | number | Date | null,
  alternate: boolean,
): Cell {
  const shade = alternate ? ALT_ROW : {};
  if (value == null || value === '') return shade;
  if (kind === 'money' && typeof value === 'number') {
    return { value, type: Number, format: '"R$" #,##0.00', align: 'right', ...shade };
  }
  if (kind === 'integer' && typeof value === 'number') {
    return { value, type: Number, format: '#,##0', align: 'right', ...shade };
  }
  if (kind === 'date' && value instanceof Date) {
    return { value, type: Date, format: 'dd/mm/yyyy hh:mm', ...shade };
  }
  return { value: String(value), type: String, ...shade };
}

function excelRows(sheet: ReportSheet, intro?: Row[]): Row[] {
  const header: Row = sheet.columns.map((column) => ({
    value: column.header,
    type: String,
    ...HEADER_STYLE,
  }));
  const body = sheet.rows.length
    ? sheet.rows.map((row, index) =>
      sheet.columns.map((column, columnIndex) => excelCell(column.kind, row[columnIndex] ?? null, index % 2 === 1)),
    )
    : [[
      { value: 'Nenhum registro neste período', type: String, columnSpan: sheet.columns.length },
      ...sheet.columns.slice(1).map(() => null),
    ]];
  return [...(intro ?? []), header, ...body];
}

export async function exportDashboardReport(
  details: DashboardDetails,
  format: DashboardExportFormat,
) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const sheets = reportSheets(details);
  const filename = `relatorio-dashboard-${timestamp}`;

  if (format === 'xlsx') {
    const writeXlsxFile = (await import('write-excel-file/browser')).default;
    const generatedAt = asDate(details.generatedAt);
    const summaryIntro: Row[] = [
      [{ value: 'Relatório do Dashboard', type: String, fontWeight: 'bold', fontSize: 16, columnSpan: 3 }, null, null],
      [{ value: 'Escopo', type: String, fontWeight: 'bold' }, { value: details.scopeLabel, type: String, columnSpan: 2 }, null],
      [
        { value: 'Gerado em', type: String, fontWeight: 'bold' },
        generatedAt
          ? { value: generatedAt, type: Date, format: 'dd/mm/yyyy hh:mm', columnSpan: 2 }
          : { value: details.generatedAt, type: String, columnSpan: 2 },
        null,
      ],
      [null, null, null],
    ];

    await writeXlsxFile(
      sheets.map((sheet) => ({
        sheet: sheet.name,
        columns: sheet.columns.map((column) => ({ width: column.width })),
        stickyRowsCount: sheet.name === 'Resumo' ? 5 : 1,
        data: excelRows(sheet, sheet.name === 'Resumo' ? summaryIntro : undefined),
      })),
      { fontFamily: 'Calibri', fontSize: 11 },
    ).toFile(`${filename}.xlsx`);
    return;
  }

  await exportTablesReport({
    filename,
    title: 'Relatório do Dashboard',
    subtitle: `${details.scopeLabel} • Gerado em ${plainDate(details.generatedAt)}`,
    sections: sheets.map((sheet) => ({
      title: sheet.name,
      headers: sheet.columns.map((column) => column.header),
      rows: sheet.rows.map((row) =>
        sheet.columns.map((column, index) => textFor(column.kind, row[index] ?? null)),
      ),
    })),
    format,
  });
}

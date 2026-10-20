export type SalesImportMode = 'new' | 'concluded';

type Requirement = 'always' | 'new' | 'concluded' | 'never';

interface ImportColumn {
  key: string;
  header: string;
  required: Requirement;
  hint: string;
  example: string;
  width: number;
  onlyMode?: SalesImportMode;
  adminOnly?: boolean;
}

const COLUMNS: ImportColumn[] = [
  { key: 'taskProtocol', header: 'Protocolo no Luxus Task', required: 'concluded', onlyMode: 'concluded', width: 22, example: 'LUX-2026-000123', hint: 'Protocolo da demanda já concluída no Luxus Task. Cada protocolo só pode ser importado uma vez.' },
  { key: 'soldAt', header: 'Data da venda', required: 'concluded', onlyMode: 'concluded', width: 14, example: '06/07/2026', hint: 'Dia em que a venda foi feita (dd/mm/aaaa). É a data usada no dashboard.' },
  { key: 'concludedAt', header: 'Data de conclusão', required: 'never', onlyMode: 'concluded', width: 16, example: '08/07/2026', hint: 'Dia em que o Luxus Task concluiu (dd/mm/aaaa). Em branco = mesma data da venda.' },
  { key: 'partner', header: 'Parceiro', required: 'always', adminOnly: true, width: 26, example: 'Loja Exemplo', hint: 'Nome ou CNPJ do parceiro, igual ao cadastro (aba "Parceiros e lojas").' },
  { key: 'branch', header: 'Loja', required: 'never', width: 20, example: 'Centro', hint: 'Nome da loja/filial do parceiro. Em branco = Matriz.' },
  { key: 'clientName', header: 'Cliente - nome', required: 'always', width: 28, example: 'Maria da Silva', hint: 'Nome completo do cliente.' },
  { key: 'clientDocument', header: 'Cliente - CPF/CNPJ', required: 'always', width: 18, example: '123.456.789-09', hint: 'CPF (11 dígitos) ou CNPJ (14 dígitos), com ou sem pontuação.' },
  { key: 'clientRg', header: 'Cliente - RG', required: 'never', width: 14, example: '1234567890', hint: 'RG do cliente.' },
  { key: 'clientPhone', header: 'Cliente - telefone de contato', required: 'new', width: 18, example: '(51) 99999-0000', hint: 'Telefone com DDD. Precisa ser diferente da linha vendida.' },
  { key: 'clientEmail', header: 'Cliente - e-mail', required: 'never', width: 24, example: 'maria@email.com', hint: 'E-mail do cliente.' },
  { key: 'zipCode', header: 'CEP', required: 'never', width: 11, example: '90000-000', hint: 'CEP do cliente.' },
  { key: 'address', header: 'Endereço', required: 'never', width: 26, example: 'Rua das Flores', hint: 'Rua/avenida.' },
  { key: 'addressNumber', header: 'Número', required: 'never', width: 9, example: '100', hint: 'Número do endereço.' },
  { key: 'complement', header: 'Complemento', required: 'never', width: 14, example: 'Apto 201', hint: 'Complemento.' },
  { key: 'neighborhood', header: 'Bairro', required: 'never', width: 16, example: 'Centro', hint: 'Bairro.' },
  { key: 'city', header: 'Cidade', required: 'never', width: 16, example: 'Porto Alegre', hint: 'Cidade.' },
  { key: 'state', header: 'UF', required: 'never', width: 6, example: 'RS', hint: 'Sigla do estado.' },
  { key: 'operator', header: 'Operadora', required: 'always', width: 12, example: 'Vivo', hint: 'Nome da operadora, igual ao cadastro (aba "Planos").' },
  { key: 'plan', header: 'Plano', required: 'always', width: 24, example: 'Controle 20GB', hint: 'Nome do plano, igual ao cadastro (aba "Planos").' },
  { key: 'value', header: 'Valor da venda', required: 'never', width: 14, example: '59,90', hint: 'Valor em reais. Em branco = preço do plano.' },
  { key: 'lineNumber', header: 'Linha vendida', required: 'always', width: 16, example: '(51) 98888-7777', hint: 'Número da linha com DDD. Na portabilidade, pode deixar em branco e usar o número portado.' },
  { key: 'simType', header: 'Tipo de chip', required: 'never', width: 12, example: 'Chip', hint: 'Chip ou eSIM. Em branco = Chip.' },
  { key: 'chipIccid', header: 'ICCID do chip', required: 'never', width: 24, example: '8955000000000000000', hint: 'Formate a coluna como Texto antes de digitar (o Excel corta números longos).' },
  { key: 'deviceImei', header: 'IMEI (eSIM)', required: 'never', width: 18, example: '', hint: 'Obrigatório para eSIM em vendas novas: 15 dígitos.' },
  { key: 'deviceEid', header: 'EID (eSIM)', required: 'never', width: 34, example: '', hint: 'Obrigatório para eSIM em vendas novas: 32 dígitos. Formate a coluna como Texto.' },
  { key: 'devicePlatform', header: 'Sistema do aparelho (eSIM)', required: 'never', width: 14, example: '', hint: 'iOS ou Android. Obrigatório para eSIM em vendas novas.' },
  { key: 'isPortability', header: 'Portabilidade', required: 'never', width: 13, example: 'Não', hint: 'Sim ou Não. Em branco = Não.' },
  { key: 'portabilityNumber', header: 'Número portado', required: 'never', width: 16, example: '', hint: 'Obrigatório se Portabilidade = Sim.' },
  { key: 'donorOperator', header: 'Operadora doadora', required: 'never', width: 14, example: '', hint: 'Vivo, TIM, Claro, Surf ou Outra. Obrigatório se Portabilidade = Sim.' },
  { key: 'contractFormat', header: 'Formato do contrato', required: 'new', width: 16, example: 'Impressão', hint: 'Impressão ou ZapSign. Nas concluídas, em branco = Impressão.' },
  { key: 'notes', header: 'Observações', required: 'never', width: 30, example: '', hint: 'Qualquer informação extra da venda.' },
];

export const SALES_IMPORT_MAX_ROWS = 300;

export const MODE_LABELS: Record<SalesImportMode, string> = {
  new: 'Vendas novas (vão para aprovação)',
  concluded: 'Vendas já concluídas no Luxus Task',
};

function isRequired(column: ImportColumn, mode: SalesImportMode) {
  return column.required === 'always' || column.required === mode;
}

export function importColumns(mode: SalesImportMode, isAdmin: boolean) {
  return COLUMNS.filter((column) =>
    (!column.onlyMode || column.onlyMode === mode) && (!column.adminOnly || isAdmin),
  );
}

function headerLabel(column: ImportColumn, mode: SalesImportMode) {
  return isRequired(column, mode) ? `${column.header} *` : column.header;
}

function normalizeHeader(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SalesTemplateData {
  plans: Array<{ operator: string; plan: string; price: number }>;
  partners?: Array<{ name: string; document: string; billedByLuxus: boolean; branches: string[] }>;
}

export async function downloadSalesTemplate(mode: SalesImportMode, isAdmin: boolean, data: SalesTemplateData) {
  const writeXlsxFile = (await import('write-excel-file/browser')).default;
  const columns = importColumns(mode, isAdmin);
  const bold = { type: String, fontWeight: 'bold' as const };
  const headerCell = (value: string) => ({ ...bold, value, backgroundColor: '#E8EEF9' });

  const salesSheet = [columns.map((column) => headerCell(headerLabel(column, mode)))];
  const instructions = [
    [{ ...bold, value: `Planilha padrão — ${MODE_LABELS[mode]}`, fontSize: 14, columnSpan: 4 }, null, null, null],
    [{ type: String, value: mode === 'new'
      ? 'Cada linha vira uma venda que vai direto para análise do administrador. Depois de aprovada, segue para o Luxus Task. A planilha não leva anexos: as fotos (chip, CPF, RG) podem ser pedidas na análise.'
      : 'Cada linha vira uma venda já concluída, ligada ao protocolo do Luxus Task. Nada é enviado nem alterado no Luxus Task. A comissão é gerada e a venda entra no dashboard pela data da venda.',
    columnSpan: 4 }, null, null, null],
    [{ type: String, value: `Preencha a aba "Vendas" a partir da linha 2, uma venda por linha (até ${SALES_IMPORT_MAX_ROWS} por arquivo). Não mude os títulos da linha 1. Colunas com * são obrigatórias.`, columnSpan: 4 }, null, null, null],
    [null, null, null, null],
    [headerCell('Coluna'), headerCell('Obrigatória'), headerCell('Como preencher'), headerCell('Exemplo')],
    ...columns.map((column) => [
      { type: String, value: column.header },
      { type: String, value: isRequired(column, mode) ? 'Sim' : 'Não' },
      { type: String, value: column.hint },
      { type: String, value: column.example || '—' },
    ]),
  ];

  const sheets = [
    {
      sheet: 'Vendas',
      data: salesSheet,
      columns: columns.map((column) => ({ width: column.width })),
      stickyRowsCount: 1,
    },
    {
      sheet: 'Instruções',
      data: instructions,
      columns: [{ width: 30 }, { width: 12 }, { width: 80 }, { width: 22 }],
    },
    {
      sheet: 'Planos',
      data: [
        [headerCell('Operadora'), headerCell('Plano'), headerCell('Preço')],
        ...data.plans.map((plan) => [
          { type: String, value: plan.operator },
          { type: String, value: plan.plan },
          { type: Number, value: plan.price, format: '#,##0.00' },
        ]),
      ],
      columns: [{ width: 16 }, { width: 34 }, { width: 12 }],
      stickyRowsCount: 1,
    },
    ...(isAdmin && data.partners ? [{
      sheet: 'Parceiros e lojas',
      data: [
        [headerCell('Parceiro'), headerCell('CNPJ/CPF'), headerCell('Cobrança pela Luxus'), headerCell('Lojas (em branco = Matriz)')],
        ...data.partners.map((partner) => [
          { type: String, value: partner.name },
          { type: String, value: partner.document },
          { type: String, value: partner.billedByLuxus ? 'Sim' : 'Não' },
          { type: String, value: partner.branches.join(', ') || 'Somente Matriz' },
        ]),
      ],
      columns: [{ width: 34 }, { width: 22 }, { width: 20 }, { width: 60 }],
      stickyRowsCount: 1,
    }] : []),
  ];

  const filename = mode === 'new' ? 'planilha-vendas-novas.xlsx' : 'planilha-vendas-concluidas-luxus-task.xlsx';
  await writeXlsxFile(
    sheets as unknown as Parameters<typeof writeXlsxFile>[0],
    { fontFamily: 'Calibri', fontSize: 11 },
  ).toFile(filename);
}

export interface ParsedSalesFile {
  rows: Array<Record<string, unknown>>;
  missingColumns: string[];
}

function cellValue(value: unknown) {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'string') return value.trim();
  return value ?? null;
}

export async function readSalesFile(file: File, mode: SalesImportMode, isAdmin: boolean): Promise<ParsedSalesFile> {
  const { readSheet } = await import('read-excel-file/browser');
  let data: unknown[][];
  try {
    data = await readSheet(file, 'Vendas') as unknown[][];
  } catch {
    data = await readSheet(file) as unknown[][];
  }
  const columns = importColumns(mode, isAdmin);
  const byHeader = new Map(columns.map((column) => [normalizeHeader(column.header), column.key]));
  const headerRow = data[0] ?? [];
  const keys = headerRow.map((cell) => byHeader.get(normalizeHeader(cell)) ?? null);
  const found = new Set(keys.filter(Boolean));
  const missingColumns = columns
    .filter((column) => isRequired(column, mode) && !found.has(column.key))
    .map((column) => column.header);

  const rows: Array<Record<string, unknown>> = [];
  data.slice(1).forEach((cells, index) => {
    const row: Record<string, unknown> = { row: index + 2 };
    let filled = false;
    keys.forEach((key, column) => {
      if (!key) return;
      const value = cellValue(cells[column]);
      if (value !== null && value !== '') filled = true;
      row[key] = value;
    });
    if (filled) rows.push(row);
  });
  return { rows, missingColumns };
}

export interface SalesImportResult {
  mode: SalesImportMode;
  total: number;
  created: number;
  failed: number;
  results: Array<{ row: number; ok: boolean; protocol?: string; client?: string; error?: string }>;
}

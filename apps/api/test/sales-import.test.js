const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeImportRow,
  parseDate,
  parseMoney,
  yesNo,
} = require('../dist/src/modules/sales/sales-import.parse');
const { SalesImportService } = require('../dist/src/modules/sales/sales-import.service');

const baseRow = {
  row: 2,
  partner: 'Loja Exemplo',
  clientName: 'Maria da Silva',
  clientDocument: '123.456.789-09',
  clientPhone: '(51) 99999-0000',
  operator: 'Vivo',
  plan: 'Controle 20GB',
  value: '59,90',
  lineNumber: '51988887777',
  simType: 'Chip',
  contractFormat: 'Impressão',
};

test('planilha aceita valores e datas no formato brasileiro', () => {
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney(59.9), 59.9);
  assert.equal(parseMoney('abc'), null);
  assert.equal(yesNo('Não'), false);
  assert.equal(yesNo('SIM'), true);
  assert.equal(yesNo('talvez'), null);
  assert.equal(parseDate('06/07/2026').toISOString().slice(0, 10), '2026-07-06');
  assert.equal(parseDate('2026-07-06').toISOString().slice(0, 10), '2026-07-06');
  assert.equal(parseDate(new Date(Date.UTC(2026, 6, 6))).toISOString().slice(0, 10), '2026-07-06');
  assert.equal(parseDate('31/02/2026'), null);
});

test('venda nova válida vira linha normalizada', () => {
  const { value, errors } = normalizeImportRow(baseRow, 'new');
  assert.deepEqual(errors, []);
  assert.equal(value.clientDocument, '12345678909');
  assert.equal(value.clientDocumentType, 'CPF');
  assert.equal(value.value, 59.9);
  assert.equal(value.contractFormat, 'PRINT');
  assert.equal(value.simType, 'CHIP');
});

test('venda nova exige formato do contrato e dados do eSIM', () => {
  const { value, errors } = normalizeImportRow(
    { ...baseRow, contractFormat: '', simType: 'eSIM' },
    'new',
  );
  assert.equal(value, undefined);
  assert.ok(errors.includes('Formato do contrato deve ser Impressão ou ZapSign'));
  assert.ok(errors.includes('eSIM: informe o IMEI do aparelho'));
});

test('números digitados como número no Excel são tratados', () => {
  const { value } = normalizeImportRow({ ...baseRow, clientDocument: 1234567890 }, 'new');
  assert.equal(value.clientDocument, '01234567890');

  const cut = normalizeImportRow({ ...baseRow, chipIccid: 8955000000000000000 }, 'new');
  assert.match(cut.errors[0], /ICCID foi digitado como número/);
});

test('linha vendida não pode ser igual ao telefone de contato', () => {
  const { errors } = normalizeImportRow({ ...baseRow, lineNumber: '51999990000' }, 'new');
  assert.ok(errors.includes('Telefone de contato deve ser diferente da linha vendida'));
});

test('venda concluída exige protocolo do Task e datas coerentes', () => {
  const missing = normalizeImportRow(baseRow, 'concluded');
  assert.ok(missing.errors.includes('Informe o protocolo da demanda no Luxus Task'));
  assert.ok(missing.errors.includes('Data da venda inválida (use dd/mm/aaaa)'));

  const inverted = normalizeImportRow(
    { ...baseRow, taskProtocol: 'lux-2026-0001', soldAt: '10/07/2026', concludedAt: '01/07/2026' },
    'concluded',
    new Date('2026-10-19T12:00:00Z'),
  );
  assert.ok(inverted.errors.includes('Data de conclusão não pode ser antes da data da venda'));

  const ok = normalizeImportRow(
    { ...baseRow, contractFormat: '', clientPhone: '', taskProtocol: 'lux-2026-0001', soldAt: '06/07/2026' },
    'concluded',
    new Date('2026-10-19T12:00:00Z'),
  );
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.value.taskProtocol, 'LUX-2026-0001');
  assert.equal(ok.value.contractFormat, 'PRINT');
  assert.equal(ok.value.concludedAt.toISOString(), ok.value.soldAt.toISOString());
});

test('somente o administrador importa vendas já concluídas', async () => {
  const service = new SalesImportService({}, {}, {}, {}, {});
  await assert.rejects(
    service.import({ mode: 'concluded', rows: [baseRow] }, { id: 'u1', role: 'PARTNER', partnerId: 'p1' }),
    /Somente o administrador/,
  );
});

test('importação devolve o erro de cada linha sem parar as outras', async () => {
  const prisma = {
    partner: { findMany: async () => [] },
    operator: { findMany: async () => [{ id: 'op-1', name: 'Vivo' }] },
    plan: { findMany: async () => [] },
  };
  const audit = { log: async () => undefined };
  const notifications = { createForAdminUsers: async () => undefined };
  const service = new SalesImportService(prisma, {}, {}, notifications, audit);
  const result = await service.import(
    { mode: 'new', rows: [{ ...baseRow, clientName: '' }, { ...baseRow, row: 3 }] },
    { id: 'admin', name: 'Admin', role: 'ADMIN' },
  );
  assert.equal(result.total, 2);
  assert.equal(result.created, 0);
  assert.match(result.results[0].error, /nome do cliente/);
  assert.match(result.results[1].error, /Parceiro "Loja Exemplo" não encontrado/);
});

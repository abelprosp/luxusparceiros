const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  buildTelefoniaSalePayload,
  telefoniaIntakeUrl,
  moneyAmount,
} = require('../dist/src/modules/telefonia-intake/telefonia-intake.payload');

test('a url do telefonia-2 aceita a origem ou o caminho completo', () => {
  assert.equal(
    telefoniaIntakeUrl('https://telefonia.exemplo.com/'),
    'https://telefonia.exemplo.com/v1/integrations/luxus-parceiros/sales',
  );
  assert.equal(
    telefoniaIntakeUrl('https://telefonia.exemplo.com/v1/integrations/luxus-parceiros/sales'),
    'https://telefonia.exemplo.com/v1/integrations/luxus-parceiros/sales',
  );
});

test('o valor em decimal vira número', () => {
  assert.equal(moneyAmount({ toString: () => '59.90' }), 59.9);
  assert.equal(moneyAmount(null), null);
});

test('a venda concluída monta o cadastro sem exigir telefone ou endereço estruturado', () => {
  const payload = buildTelefoniaSalePayload({
    id: 'sale-1',
    protocol: 'VND-1',
    taskProtocol: 'LUX-2026-1',
    createdAt: new Date('2026-05-26T14:55:22.000Z'),
    activatedAt: new Date('2026-05-27T12:00:00.000Z'),
    value: { toString: () => '79.90' },
    commissionValue: { toString: () => '10.00' },
    newNumber: '51985370873',
    simType: 'ESIM',
    isVirginChip: false,
    deviceImei: '490154203237518',
    deviceEid: '89049032000000000000000000000000',
    devicePlatform: 'IOS',
    isPortability: true,
    portabilityNumber: '51999998888',
    donorOperator: 'VIVO',
    isUpgrade: true,
    contractFormat: 'ZAPSIGN',
    notes: 'obs',
    partner: { name: 'META CELL' },
    branch: { name: 'CRUZEIRO' },
    operator: { name: 'Vivo' },
    plan: { name: 'Controle' },
    upgradeOfSale: { protocol: 'VND-0' },
    client: {
      name: 'Amanda Martins',
      document: '02113419084',
      documentType: 'CPF',
      phone: 'sem telefone',
      email: 'nao-e-email',
      address: 'Mauro Vieira 500',
    },
  }, [{
    id: 'doc-1',
    type: 'CONTRACT',
    name: 'contrato.pdf',
    mimeType: 'application/pdf',
    contentBase64: 'YQ==',
  }], ['Anexo não enviado: selfie.jpg.']);

  assert.equal(payload.sale.id, 'sale-1');
  assert.equal(payload.sale.protocol, 'VND-1');
  assert.equal(payload.sale.lineNumber, '51985370873');
  assert.equal(payload.sale.simType, 'ESIM');
  assert.equal(payload.sale.upgradeOfProtocol, 'VND-0');
  assert.equal(payload.sale.value, 79.9);
  assert.match(payload.sale.notes, /Anexo não enviado/);
  assert.equal(payload.client.phone, 'sem telefone');
  assert.equal(payload.client.address, 'Mauro Vieira 500');
  assert.equal(payload.attachments[0].type, 'CONTRACT');
});

test('a conclusão da venda agenda o telefonia-2 sem desfazer a conclusão', () => {
  const source = readFileSync(
    join(__dirname, '../src/modules/task-integration/task-integration.service.ts'),
    'utf8',
  );
  assert.match(source, /telefoniaIntake\?\.enqueue\(sale\.id\)\?\.catch/);
  assert.match(source, /Falha ao agendar envio ao telefonia-2/);
});

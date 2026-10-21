const assert = require('node:assert/strict');
const { test } = require('node:test');
const { UserRole } = require('@luxus/types');
const { detectAllowedFileType, DOCUMENT_FILE_TYPES, safeDownloadHeaders } = require('../dist/src/common/utils/file-signature');
const { csvCell } = require('../dist/src/common/utils/csv');
const { maskBankData } = require('../dist/src/common/utils/bank-data');
const { assertDateRange } = require('../dist/src/common/utils/date-range');
const { cancelSaleCommission } = require('../dist/src/modules/commissions/commission-lifecycle');
const { CommissionsService } = require('../dist/src/modules/commissions/commissions.service');
const { PartnersService } = require('../dist/src/modules/partners/partners.service');
const { TicketsService } = require('../dist/src/modules/tickets/tickets.service');

const partnerAdmin = { id: 'u-1', name: 'Admin parceiro', role: UserRole.ADMIN, partnerId: 'partner-1' };
const platformAdmin = { id: 'u-2', name: 'Admin Luxus', role: UserRole.ADMIN };

test('upload aceita só PDF/PNG/JPEG pelos bytes reais', () => {
  assert.equal(detectAllowedFileType(Buffer.from('%PDF-1.7\n...'), DOCUMENT_FILE_TYPES).mimeType, 'application/pdf');
  assert.equal(detectAllowedFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), DOCUMENT_FILE_TYPES).extension, '.jpg');
  assert.equal(detectAllowedFileType(Buffer.from('<html><script>alert(1)</script>'), DOCUMENT_FILE_TYPES), null);
  assert.equal(detectAllowedFileType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), DOCUMENT_FILE_TYPES), null);
});

test('download de tipo fora da allowlist vira anexo binário', () => {
  assert.deepEqual(safeDownloadHeaders('text/html', true), {
    contentType: 'application/octet-stream',
    disposition: 'attachment',
  });
  assert.deepEqual(safeDownloadHeaders('application/pdf', true), {
    contentType: 'application/pdf',
    disposition: 'inline',
  });
});

test('CSV neutraliza fórmulas', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2', '@cmd']) {
    assert.ok(csvCell(value).startsWith(`"'`), value);
  }
  assert.equal(csvCell('Cliente'), '"Cliente"');
});

test('dados bancários ficam ocultos para quem não é ADMIN/PARTNER', () => {
  const partner = { id: 'p', pixKey: 'chave', bankAccount: '123' };
  assert.equal(maskBankData(partner, { role: UserRole.SUPERVISOR }).pixKey, null);
  assert.equal(maskBankData(partner, { role: UserRole.FINANCIAL }).bankDataRestricted, true);
  assert.equal(maskBankData(partner, { role: UserRole.PARTNER }).pixKey, 'chave');
});

test('intervalo de datas invertido é recusado', () => {
  assert.throws(() => assertDateRange('2026-10-20', '2026-10-01'), /anterior/);
  assert.doesNotThrow(() => assertDateRange('2026-10-01', '2026-10-20'));
});

test('cancelar venda cancela a comissão e bloqueia se já paga', async () => {
  const updates = [];
  const tx = (status) => ({
    commission: {
      findUnique: async () => ({ id: 'c-1', status }),
      update: async (args) => { updates.push(args); return args; },
    },
  });
  await cancelSaleCommission(tx('FORECAST'), 'sale-1');
  assert.equal(updates[0].data.status, 'CANCELLED');
  await assert.rejects(cancelSaleCommission(tx('PAID'), 'sale-1'), /já foi paga/);
  assert.equal(await cancelSaleCommission(tx('PAID'), 'sale-1', { keepPaid: true }), null);
});

test('administrador de parceiro não aprova nem paga comissão', async () => {
  const service = new CommissionsService({}, {}, {}, {});
  await assert.rejects(service.approve('c-1', {}, partnerAdmin), /equipe Luxus/);
  await assert.rejects(service.pay('c-1', {}, partnerAdmin), /equipe Luxus/);
});

test('comissão só é aprovada com a venda ativada', async () => {
  const prisma = {
    commission: {
      findUnique: async () => ({
        id: 'c-1', partnerId: 'partner-1', status: 'FORECAST', value: 10,
        sale: { status: 'APPROVED' },
      }),
    },
  };
  const service = new CommissionsService(prisma, {}, {}, {});
  await assert.rejects(service.approve('c-1', {}, platformAdmin), /venda estiver ativada/);
});

test('administrador de parceiro não altera catálogo nem suspende parceiro', async () => {
  const service = new PartnersService({}, { log: async () => undefined });
  await assert.rejects(service.setPartnerPlans('partner-1', { plans: [] }, partnerAdmin), /Somente a Luxus/);
  await assert.rejects(service.suspend('partner-1', { reason: 'x' }, partnerAdmin), /Somente a Luxus/);
  await assert.rejects(service.activate('partner-1', partnerAdmin), /Somente a Luxus/);
});

test('administrador de parceiro não muda comissão nem status pelo cadastro', async () => {
  let updateData;
  const tx = {
    partner: { update: async ({ data }) => { updateData = data; return { id: 'partner-1', ...data }; } },
    sale: { updateMany: async () => ({ count: 0 }) },
    refreshToken: { updateMany: async () => ({ count: 0 }) },
  };
  const service = new PartnersService({ $transaction: async (fn) => fn(tx) }, { log: async () => undefined });
  service.findOne = async () => ({ id: 'partner-1', status: 'ACTIVE', billedByLuxus: false, latitude: 1, longitude: 1 });
  await service.update('partner-1', { name: 'Novo nome', commissionRate: 99, status: 'ACTIVE' }, partnerAdmin);
  assert.equal(updateData.name, 'Novo nome');
  assert.equal('commissionRate' in updateData, false);
  assert.equal('status' in updateData, false);
});

test('chamado sem parceiro não aparece para usuário de parceiro', async () => {
  const prisma = {
    ticket: {
      findUnique: async () => ({ id: 't-1', partnerId: null, messages: [], documents: [] }),
    },
  };
  const service = new TicketsService(prisma, {}, {}, {}, {});
  await assert.rejects(service.findOne('t-1', partnerAdmin), /não encontrado/i);
  const ticket = await service.findOne('t-1', platformAdmin);
  assert.equal(ticket.id, 't-1');
});

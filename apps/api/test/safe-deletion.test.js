const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SaleReviewStatus, SaleStatus, SaleTaskSyncStatus, TicketStatus } = require('@prisma/client');
const { UserRole } = require('@luxus/types');
const { SalesService } = require('../dist/src/modules/sales/sales.service');
const { TicketsService } = require('../dist/src/modules/tickets/tickets.service');
const { RequestsService } = require('../dist/src/modules/requests/requests.service');

function admin() {
  return { id: 'admin-1', name: 'Admin', role: UserRole.ADMIN };
}

function salesHarness(overrides = {}) {
  const calls = { documents: 0, sale: 0, files: 0 };
  const prisma = {
    commission: { deleteMany: async () => {} },
    document: { deleteMany: async () => { calls.documents += 1; } },
    sale: { delete: async () => { calls.sale += 1; } },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new SalesService(
    prisma, { log: async () => {} }, {}, {}, { emitToPartner: () => {} }, {}, {},
    { removeStoredFiles: () => { calls.files += 1; } },
  );
  service.findOne = async () => ({
    id: 'sale-1', protocol: 'VND-1', partnerId: 'partner-1',
    status: SaleStatus.IN_ANALYSIS,
    reviewStatus: SaleReviewStatus.AWAITING_REVIEW,
    taskDemandId: null,
    taskSyncStatus: SaleTaskSyncStatus.NOT_READY,
    documents: [{ url: '/uploads/doc.jpg' }],
    ...overrides,
  });
  return { service, calls };
}

test('exclui venda não ativada e nunca enviada ao Luxus Task', async () => {
  const { service, calls } = salesHarness();
  await service.remove('sale-1', admin());
  assert.deepEqual(calls, { documents: 1, sale: 1, files: 1 });
});

test('bloqueia exclusão de venda já enviada ao Luxus Task', async () => {
  const { service, calls } = salesHarness({
    taskDemandId: 'task-1',
    taskSyncStatus: SaleTaskSyncStatus.SYNCED,
  });
  await assert.rejects(service.remove('sale-1', admin()), /Luxus Task não pode ser excluída/);
  assert.deepEqual(calls, { documents: 0, sale: 0, files: 0 });
});

test('bloqueia exclusão de venda ativada', async () => {
  const { service } = salesHarness({ status: SaleStatus.ACTIVATED });
  await assert.rejects(service.remove('sale-1', admin()), /Venda ativada não pode ser removida/);
});

test('administrador exclui chamado e seus anexos relacionados', async () => {
  const calls = { documents: 0, ticket: 0, files: 0 };
  const prisma = {
    document: { deleteMany: async () => { calls.documents += 1; } },
    ticket: { delete: async () => { calls.ticket += 1; } },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new TicketsService(
    prisma, { log: async () => {} }, {}, { emitToPartner: () => {} },
    { removeStoredFiles: () => { calls.files += 1; } },
  );
  service.findOne = async () => ({
    id: 'ticket-1', protocol: 'TKT-1', status: TicketStatus.NEW,
    partnerId: 'partner-1', documents: [{ url: '/uploads/ticket.pdf' }],
  });
  await service.remove('ticket-1', admin());
  assert.deepEqual(calls, { documents: 1, ticket: 1, files: 1 });
});

test('parceiro não pode excluir chamado', async () => {
  const service = new TicketsService({}, {}, {}, {}, {});
  await assert.rejects(
    service.remove('ticket-1', { id: 'partner-1', role: UserRole.PARTNER }),
    /Somente administradores/,
  );
});

function saleRow(overrides) {
  return {
    status: SaleStatus.IN_ANALYSIS,
    taskDemandId: null,
    taskSyncStatus: SaleTaskSyncStatus.NOT_READY,
    documents: [],
    commission: null,
    ...overrides,
  };
}

test('exclusão de vendas em lote preserva Task, ativadas e comissão paga', async () => {
  const deleted = [];
  const prisma = {
    sale: {
      findMany: async () => [
        saleRow({ id: 'sale-1', protocol: 'VND-1', taskDemandId: 'task-1', taskSyncStatus: SaleTaskSyncStatus.SYNCED }),
        saleRow({ id: 'sale-2', protocol: 'VND-2', commission: { status: 'PAID' } }),
        saleRow({ id: 'sale-3', protocol: 'VND-3', status: SaleStatus.ACTIVATED }),
        saleRow({ id: 'sale-4', protocol: 'VND-4' }),
      ],
      delete: async ({ where }) => deleted.push(where.id),
    },
    commission: { deleteMany: async () => {} },
    document: { deleteMany: async () => {} },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new SalesService(
    prisma, { log: async () => {} }, {}, {}, {}, {}, {}, { removeStoredFiles: () => {} },
  );
  const result = await service.bulkRemove(['sale-1', 'sale-2', 'sale-3', 'sale-4'], admin());
  assert.deepEqual(deleted, ['sale-4']);
  assert.deepEqual(result.deleted, ['sale-4']);
  const reasons = Object.fromEntries(result.failed.map((item) => [item.id, item.reason]));
  assert.match(reasons['sale-1'], /Luxus Task/);
  assert.match(reasons['sale-2'], /comissão.*paga/i);
  assert.match(reasons['sale-3'], /ativada/);
});

test('exclusão de vendas em lote fica restrita ao parceiro e à filial do administrador', async () => {
  let capturedWhere;
  const prisma = {
    sale: { findMany: async ({ where }) => { capturedWhere = where; return []; } },
  };
  const service = new SalesService(prisma, {}, {}, {}, {}, {}, {}, {});
  const result = await service.bulkRemove(
    ['sale-de-outro-parceiro'],
    { ...admin(), partnerId: 'partner-1', branchId: 'branch-1' },
  );
  assert.equal(capturedWhere.partnerId, 'partner-1');
  assert.equal(capturedWhere.branchId, 'branch-1');
  assert.deepEqual(result.deleted, []);
  assert.match(result.failed[0].reason, /não encontrada/);
});

test('exclusão de demandas em lote preserva as vinculadas ao Luxus Task', async () => {
  const deleted = [];
  let capturedWhere;
  const prisma = {
    request: {
      findMany: async ({ where }) => {
        capturedWhere = where;
        return [
          { id: 'request-1', protocol: 'REQ-1', taskDemandId: 'task-1', status: 'IN_PROGRESS', documents: [] },
          { id: 'request-2', protocol: 'REQ-2', taskDemandId: null, status: 'OPEN', documents: [] },
        ];
      },
      delete: async ({ where }) => deleted.push(where.id),
    },
    document: { deleteMany: async () => {} },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new RequestsService(prisma, { log: async () => {} }, {}, {}, {});
  const result = await service.bulkRemove(['request-1', 'request-2'], { ...admin(), partnerId: 'partner-1' });
  assert.equal(capturedWhere.partnerId, 'partner-1');
  assert.deepEqual(deleted, ['request-2']);
  assert.deepEqual(result.deleted, ['request-2']);
  assert.match(result.failed[0].reason, /Luxus Task/);
});

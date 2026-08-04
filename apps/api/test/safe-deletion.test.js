const assert = require('node:assert/strict');
const { test } = require('node:test');
const { SaleReviewStatus, SaleStatus, SaleTaskSyncStatus, TicketStatus } = require('@prisma/client');
const { UserRole } = require('@luxus/types');
const { SalesService } = require('../dist/src/modules/sales/sales.service');
const { TicketsService } = require('../dist/src/modules/tickets/tickets.service');

function admin() {
  return { id: 'admin-1', name: 'Admin', role: UserRole.ADMIN };
}

function salesHarness(overrides = {}) {
  const calls = { documents: 0, sale: 0, files: 0 };
  const prisma = {
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

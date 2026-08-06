const assert = require('node:assert/strict');
const { test } = require('node:test');
const { ContractFormat, SaleContractStage, SaleReviewStatus, SaleStatus, SaleTaskSyncStatus } = require('@prisma/client');
const { UserRole } = require('@luxus/types');
const { SalesService } = require('../dist/src/modules/sales/sales.service');

function buildService() {
  const calls = { update: null, commission: 0, partnerNotifications: 0 };
  const prisma = {
    sale: {
      update: async (args) => {
        calls.update = args;
        return { id: 'sale-1', partnerId: 'partner-1', protocol: 'VND-1', ...args.data };
      },
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
    },
  };
  const service = new SalesService(
    prisma,
    { log: async () => {} },
    { createFromSale: async () => { calls.commission += 1; } },
    { createForPartnerUsers: async () => { calls.partnerNotifications += 1; } },
    { emitToPartner: () => {} },
    {},
    { isConfigured: () => true, getDemand: async () => { throw new Error('offline no teste'); } },
  );
  service.findOne = async () => ({
    id: 'sale-1', protocol: 'VND-1', partnerId: 'partner-1',
    status: 'IN_ANALYSIS', reviewStatus: SaleReviewStatus.UNDER_REVIEW,
    contractFormat: ContractFormat.ZAPSIGN, notes: null,
  });
  return { service, calls };
}

test('aprovação administrativa enfileira a venda sem efetivar comissão', async () => {
  const { service, calls } = buildService();
  await service.approveForTask('sale-1', {
    responsibleId: 'a0b1c2d3-e4f5-4678-9012-abcdefabcdef',
    clientName: 'Cliente manual', clientDocumentType: 'pf', clientDocument: '12345678901',
    deadline: '2026-08-20T23:59:59.000Z', priority: true,
  }, { id: 'admin-1', name: 'Admin', role: UserRole.ADMIN });

  assert.equal(calls.update.data.reviewStatus, SaleReviewStatus.APPROVED);
  assert.equal(calls.update.data.taskSyncStatus, SaleTaskSyncStatus.PENDING);
  assert.equal(calls.commission, 0);
  assert.equal(calls.partnerNotifications, 1);
});

test('parceiro não pode aprovar e escolher responsável do Luxus Task', async () => {
  const { service } = buildService();
  await assert.rejects(
    service.approveForTask('sale-1', {}, { id: 'partner-1', name: 'Parceiro', role: UserRole.PARTNER }),
    /Apenas administradores/,
  );
});

test('administrador finaliza e comissiona somente depois da aprovação do Task', async () => {
  const { service, calls } = buildService();
  service.findOne = async () => ({
    id: 'sale-1', protocol: 'VND-1', partnerId: 'partner-1',
    status: SaleStatus.APPROVED,
    contractStage: SaleContractStage.TASK_APPROVED_REVIEW_PENDING,
  });

  await service.finalizeAfterTaskApproval(
    'sale-1',
    { id: 'admin-1', name: 'Admin', role: UserRole.ADMIN },
  );

  assert.equal(calls.update.data.contractStage, SaleContractStage.COMPLETED);
  assert.equal(calls.update.data.status, SaleStatus.ACTIVATED);
  assert.equal(calls.commission, 1);
  assert.equal(calls.partnerNotifications, 1);
});

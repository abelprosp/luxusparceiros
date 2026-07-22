const assert = require('node:assert/strict');
const test = require('node:test');
const { SaleStatus } = require('@prisma/client');
const { DashboardService } = require('../dist/src/modules/dashboard/dashboard.service');

test('dashboard considera somente vendas realizadas em seus filtros', () => {
  const service = new DashboardService({});
  const where = service.buildSaleWhere({ partnerId: 'partner-1' });

  assert.deepEqual(where.status, {
    in: [SaleStatus.APPROVED, SaleStatus.ACTIVATED],
  });
  assert.equal(where.partnerId, 'partner-1');
});

test('comissões do dashboard respeitam venda realizada, campanha, operadora e filial', () => {
  const service = new DashboardService({});
  const since = new Date('2026-07-01T00:00:00.000Z');
  const where = service.buildCommissionWhere(
    { partnerId: 'partner-1', campaignId: 'campaign-1', operatorId: 'operator-1' },
    since,
    'branch-1',
  );

  assert.equal(where.partnerId, 'partner-1');
  assert.equal(where.createdAt.gte, since);
  assert.deepEqual(where.sale, {
    status: { in: [SaleStatus.APPROVED, SaleStatus.ACTIVATED] },
    branchId: 'branch-1',
    campaignId: 'campaign-1',
    operatorId: 'operator-1',
  });
});

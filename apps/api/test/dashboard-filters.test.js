const assert = require('node:assert/strict');
const test = require('node:test');
const { SaleStatus } = require('@prisma/client');
const { DashboardService } = require('../dist/src/modules/dashboard/dashboard.service');

test('dashboard considera somente vendas realizadas em seus filtros', () => {
  const service = new DashboardService({});
  const where = service.buildSaleWhere({ partnerId: 'partner-1' });

  assert.deepEqual(where.status, {
    in: [SaleStatus.ACTIVATED],
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
  assert.deepEqual(where.sale, {
    status: { in: [SaleStatus.ACTIVATED] },
    OR: [
      { activatedAt: { gte: since } },
      { activatedAt: null, createdAt: { gte: since } },
    ],
    branchId: 'branch-1',
    campaignId: 'campaign-1',
    operatorId: 'operator-1',
  });
});

test('receita do dashboard usa data de ativação e não só a de cadastro', () => {
  const service = new DashboardService({});
  const since = new Date('2026-09-01T00:00:00.000Z');
  const where = service.buildSaleWhere({ partnerId: 'partner-1' }, since);

  assert.deepEqual(where.status, { in: [SaleStatus.ACTIVATED] });
  assert.deepEqual(where.OR, [
    { activatedAt: { gte: since } },
    { activatedAt: null, createdAt: { gte: since } },
  ]);
});

test('detalhes do ranking nunca retornam vendas de outro parceiro', async () => {
  let capturedSaleWhere;
  const prisma = {
    sale: {
      findMany: async ({ where }) => {
        capturedSaleWhere = where;
        return [];
      },
      groupBy: async () => [],
    },
    partner: {
      findMany: async () => [{
        id: 'partner-1',
        name: 'Parceiro 1',
        city: null,
        state: null,
        status: 'ACTIVE',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      }],
    },
    line: { findMany: async () => [] },
    commission: { findMany: async () => [] },
    campaign: { findMany: async () => [] },
    branch: { findUnique: async () => null },
  };
  const service = new DashboardService(prisma);
  const user = {
    id: 'user-1',
    name: 'Parceiro',
    email: 'parceiro@local',
    role: 'PARTNER',
    partnerId: 'partner-1',
  };

  const result = await service.getDetails(user, { partnerId: 'partner-2' });

  assert.equal(capturedSaleWhere.partnerId, 'partner-1');
  assert.deepEqual(result.sales, []);
  assert.equal(JSON.stringify(result).includes('partner-2'), false);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { SaleStatus } = require('@prisma/client');
const {
  REALIZED_SALE_STATUSES,
  realizedSaleStatusFilter,
} = require('../dist/src/common/constants/realized-sale-statuses');

test('somente vendas aprovadas ou ativadas são consideradas realizadas', () => {
  assert.deepEqual(REALIZED_SALE_STATUSES, [SaleStatus.APPROVED, SaleStatus.ACTIVATED]);

  const filter = realizedSaleStatusFilter();
  assert.deepEqual(filter, {
    in: [SaleStatus.APPROVED, SaleStatus.ACTIVATED],
  });

  for (const status of [
    SaleStatus.IN_ANALYSIS,
    SaleStatus.PENDING,
    SaleStatus.REJECTED,
    SaleStatus.CANCELLED,
    SaleStatus.CONTESTED,
    SaleStatus.DOCUMENTS_PENDING,
  ]) {
    assert.equal(filter.in.includes(status), false, `${status} não deve contar como venda realizada`);
  }
});

test('cada filtro recebe uma lista independente', () => {
  const first = realizedSaleStatusFilter();
  first.in.push(SaleStatus.REJECTED);

  assert.deepEqual(realizedSaleStatusFilter(), {
    in: [SaleStatus.APPROVED, SaleStatus.ACTIVATED],
  });
});

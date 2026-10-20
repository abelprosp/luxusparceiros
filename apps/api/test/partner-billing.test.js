const assert = require('node:assert/strict');
const test = require('node:test');
const { PartnersService } = require('../dist/src/modules/partners/partners.service');

function setup(existing) {
  const calls = { partnerUpdate: [], saleUpdateMany: [] };
  const tx = {
    partner: { update: async (args) => { calls.partnerUpdate.push(args); return { id: existing.id }; } },
    sale: { updateMany: async (args) => { calls.saleUpdateMany.push(args); return { count: 2 }; } },
  };
  const prisma = { $transaction: async (fn) => fn(tx) };
  const service = new PartnersService(prisma, { log: async () => undefined });
  service.findOne = async () => existing;
  return { service, calls };
}

const existing = { id: 'p1', billedByLuxus: false, latitude: 1, longitude: 1 };
const admin = { id: 'admin', role: 'ADMIN' };

test('marcar cobrança pela Luxus no parceiro leva as vendas em aberto junto', async () => {
  const { service, calls } = setup(existing);
  await service.update('p1', { billedByLuxus: true }, admin);

  assert.equal(calls.partnerUpdate[0].data.billedByLuxus, true);
  assert.equal(calls.saleUpdateMany.length, 1);
  assert.deepEqual(calls.saleUpdateMany[0].where.partnerId, 'p1');
  assert.deepEqual(calls.saleUpdateMany[0].where.status, { notIn: ['ACTIVATED', 'CANCELLED', 'REJECTED'] });
  assert.equal(calls.saleUpdateMany[0].data.billedByLuxus, true);
});

test('salvar o parceiro sem mudar a cobrança não mexe nas vendas', async () => {
  const { service, calls } = setup(existing);
  await service.update('p1', { billedByLuxus: false, name: 'Loja' }, admin);
  assert.equal(calls.saleUpdateMany.length, 0);
});

test('usuário do próprio parceiro não muda a cobrança', async () => {
  const { service, calls } = setup(existing);
  await service.update('p1', { billedByLuxus: true }, { id: 'u1', role: 'PARTNER', partnerId: 'p1' });
  assert.equal(calls.partnerUpdate[0].data.billedByLuxus, undefined);
  assert.equal(calls.saleUpdateMany.length, 0);
});

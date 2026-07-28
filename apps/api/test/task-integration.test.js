const assert = require('node:assert/strict');
const test = require('node:test');
const { UnauthorizedException } = require('@nestjs/common');
const {
  TaskIntegrationGuard,
} = require('../dist/src/modules/task-integration/task-integration.guard');
const {
  TaskIntegrationService,
} = require('../dist/src/modules/task-integration/task-integration.service');

function contextWithKey(value) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { 'x-integration-key': value } }),
    }),
  };
}

test('callback exige a chave compartilhada exata', () => {
  const guard = new TaskIntegrationGuard({ get: () => 'segredo-com-32-caracteres-123456' });

  assert.equal(
    guard.canActivate(contextWithKey('segredo-com-32-caracteres-123456')),
    true,
  );
  assert.throws(
    () => guard.canActivate(contextWithKey('segredo-incorreto')),
    UnauthorizedException,
  );
});

test('callback concluído atualiza somente a solicitação vinculada', async () => {
  const updates = [];
  const timelines = [];
  const prisma = {
    request: {
      findUnique: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        taskDemandId: '22222222-2222-4222-8222-222222222222',
        status: 'IN_PROGRESS',
      }),
    },
    $transaction: async (work) => work({
      request: { update: async (args) => updates.push(args) },
      requestTimeline: { create: async (args) => timelines.push(args) },
    }),
  };
  const service = new TaskIntegrationService({ get: () => undefined }, prisma);

  await service.applyCallback({
    externalRequestId: '11111111-1111-4111-8111-111111111111',
    demandId: '22222222-2222-4222-8222-222222222222',
    protocol: 'LUX-2026-00001',
    status: 'concluido',
    observations: ['Atendimento executado com sucesso.'],
    responsibleName: 'Rafa',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(updates[0].data.status, 'COMPLETED');
  assert.equal(updates[0].data.resolution, 'Atendimento executado com sucesso.');
  assert.equal(timelines.length, 1);
});

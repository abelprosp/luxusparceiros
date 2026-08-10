const assert = require('node:assert/strict');
const test = require('node:test');
const { existsSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { mkdtempSync } = require('node:fs');
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

test('integração tolera o tempo de despertar do Render', () => {
  const configured = new TaskIntegrationService(
    {
      get: (key) => key === 'LUXUS_TASK_TIMEOUT_MS' ? '45000' : undefined,
    },
    {},
  );
  const defaultTimeout = new TaskIntegrationService(
    { get: () => undefined },
    {},
  );

  assert.equal(configured.timeoutMs, 45000);
  assert.equal(defaultTimeout.timeoutMs, 90000);
});

test('callback concluído atualiza somente a solicitação vinculada', async () => {
  const updates = [];
  const timelines = [];
  const partnerNotifications = [];
  const userNotifications = [];
  const prisma = {
    request: {
      findUnique: async () => ({
        id: '11111111-1111-4111-8111-111111111111',
        protocol: 'REQ-TESTE',
        partnerId: '33333333-3333-4333-8333-333333333333',
        createdById: '44444444-4444-4444-8444-444444444444',
        createdBy: { partnerId: null },
        taskDemandId: '22222222-2222-4222-8222-222222222222',
        status: 'IN_PROGRESS',
      }),
    },
    $transaction: async (work) => work({
      request: { update: async (args) => updates.push(args) },
      requestTimeline: { create: async (args) => timelines.push(args) },
    }),
  };
  const notifications = {
    createForPartnerUsers: async (...args) => partnerNotifications.push(args),
    create: async (args) => userNotifications.push(args),
  };
  const service = new TaskIntegrationService(
    { get: () => undefined },
    prisma,
    notifications,
  );

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
  assert.equal(partnerNotifications.length, 1);
  assert.equal(userNotifications.length, 1);
  assert.equal(userNotifications[0].data.requestId, '11111111-1111-4111-8111-111111111111');
});

test('primeira conclusao da venda retorna contrato em branco sem ativar nem comissionar', async () => {
  const updates = [];
  const importedDocuments = [];
  let commissions = 0;
  const sale = {
    id: '11111111-1111-4111-8111-111111111111', protocol: 'VND-TESTE',
    partnerId: '33333333-3333-4333-8333-333333333333',
    createdById: '44444444-4444-4444-8444-444444444444',
    createdBy: { partnerId: '33333333-3333-4333-8333-333333333333' },
    taskDemandId: '22222222-2222-4222-8222-222222222222',
    taskStatus: 'em_andamento', contractStage: 'TASK_PROCESSING', status: 'APPROVED',
  };
  const prisma = {
    request: { findUnique: async () => null },
    sale: {
      findUnique: async () => sale,
      update: async (args) => { updates.push(args); return { ...sale, ...args.data }; },
    },
    document: { upsert: async (args) => importedDocuments.push(args) },
  };
  const service = new TaskIntegrationService(
    { get: () => undefined }, prisma,
    { createForAdminUsers: async () => {}, createForPartnerUsers: async () => {}, create: async () => {} },
    { createFromSale: async () => { commissions += 1; } },
  );
  await service.applyCallback({
    externalRequestId: sale.id, demandId: sale.taskDemandId,
    protocol: 'LUX-2026-00002', status: 'concluido',
    workflowStage: 'BLANK_CONTRACT_READY_FOR_ADMIN',
    attachments: [{ id: 'anexo-1', name: 'contrato-em-branco.pdf', mimeType: 'application/pdf', size: 1200 }],
  });
  assert.equal(updates[0].data.contractStage, 'BLANK_CONTRACT_READY_FOR_ADMIN');
  assert.equal(updates[0].data.status, undefined);
  assert.equal(importedDocuments[0].create.purpose, 'BLANK_CONTRACT');
  assert.equal(commissions, 0);
});

test('aprovacao do Task aguarda confirmacao final do administrador sem ativar venda', async () => {
  const updates = [];
  let commissions = 0;
  const sale = {
    id: '11111111-1111-4111-8111-111111111111', protocol: 'VND-TESTE',
    partnerId: '33333333-3333-4333-8333-333333333333',
    createdById: '44444444-4444-4444-8444-444444444444',
    createdBy: { partnerId: '33333333-3333-4333-8333-333333333333' },
    taskDemandId: '22222222-2222-4222-8222-222222222222',
    taskStatus: 'em_andamento', contractStage: 'TASK_VALIDATING_SIGNED_CONTRACT', status: 'APPROVED',
  };
  const prisma = {
    request: { findUnique: async () => null },
    sale: {
      findUnique: async () => sale,
      update: async (args) => { updates.push(args); return { ...sale, ...args.data }; },
    },
    document: { upsert: async () => {} },
  };
  const service = new TaskIntegrationService(
    { get: () => undefined }, prisma,
    { createForAdminUsers: async () => {}, createForPartnerUsers: async () => {}, create: async () => {} },
    { createFromSale: async () => { commissions += 1; } },
  );
  await service.applyCallback({
    externalRequestId: sale.id, demandId: sale.taskDemandId,
    protocol: 'LUX-2026-00002', status: 'concluido', workflowStage: 'TASK_APPROVED_REVIEW_PENDING',
  });
  assert.equal(updates[0].data.status, undefined);
  assert.equal(updates[0].data.contractStage, 'TASK_APPROVED_REVIEW_PENDING');
  assert.equal(commissions, 0);
});

test('callback materializa bytes do anexo do Task sem depender de outro download', async () => {
  const uploadDir = mkdtempSync(join(tmpdir(), 'luxus-task-callback-'));
  const importedDocuments = [];
  const sale = {
    id: '11111111-1111-4111-8111-111111111111',
    protocol: 'VND-TESTE',
    partnerId: '33333333-3333-4333-8333-333333333333',
    createdById: '44444444-4444-4444-8444-444444444444',
    createdBy: { partnerId: '33333333-3333-4333-8333-333333333333' },
    taskDemandId: '22222222-2222-4222-8222-222222222222',
    taskStatus: 'em_andamento',
    contractStage: 'TASK_PROCESSING',
    status: 'APPROVED',
  };
  const prisma = {
    request: { findUnique: async () => null },
    sale: {
      findUnique: async () => sale,
      update: async () => sale,
    },
    document: { upsert: async (args) => importedDocuments.push(args) },
  };
  const service = new TaskIntegrationService(
    { get: (key) => key === 'UPLOAD_DIR' ? uploadDir : undefined },
    prisma,
    { createForAdminUsers: async () => {}, createForPartnerUsers: async () => {}, create: async () => {} },
  );

  try {
    await service.applyCallback({
      externalRequestId: sale.id,
      demandId: sale.taskDemandId,
      protocol: 'LUX-2026-00003',
      status: 'em_andamento',
      attachments: [{
        id: '55555555-5555-4555-8555-555555555555',
        name: 'contrato.pdf',
        mimeType: 'application/pdf',
        size: 4,
        contentBase64: Buffer.from('PDF!').toString('base64'),
      }],
    });

    assert.equal(importedDocuments.length, 1);
    const storedUrl = importedDocuments[0].create.url;
    assert.match(storedUrl, /^\/uploads\//);
    const storedPath = join(uploadDir, storedUrl.replace('/uploads/', ''));
    assert.equal(existsSync(storedPath), true);
    assert.equal(readFileSync(storedPath).toString(), 'PDF!');
  } finally {
    rmSync(uploadDir, { recursive: true, force: true });
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  TicketsService,
} = require('../dist/src/modules/tickets/tickets.service');

function createService(overrides = {}) {
  const timelines = [];
  const partnerNotifications = [];
  const adminNotifications = [];
  const prisma = {
    ticket: {
      findUnique: async () => null,
      create: async () => null,
      update: async () => null,
      ...overrides.ticket,
    },
    ticketTimeline: {
      create: async (args) => {
        timelines.push(args);
        return args.data;
      },
    },
  };
  const notifications = {
    createForPartnerUsers: async (...args) => partnerNotifications.push(args),
    createForAdminUsers: async (...args) => adminNotifications.push(args),
  };
  const events = {
    emitToPartner: () => undefined,
  };
  const service = new TicketsService(
    prisma,
    { log: async () => undefined },
    notifications,
    events,
  );
  return {
    service,
    timelines,
    partnerNotifications,
    adminNotifications,
  };
}

test('novo chamado de parceiro avisa os administradores', async () => {
  const partnerId = '11111111-1111-4111-8111-111111111111';
  const { service, adminNotifications } = createService({
    ticket: {
      create: async ({ data }) => ({
        id: '22222222-2222-4222-8222-222222222222',
        protocol: 'TKT-TESTE',
        subject: data.subject,
        partnerId,
        partner: { id: partnerId, name: 'Parceiro Teste' },
        createdBy: { id: 'user-partner', name: 'Maria' },
      }),
    },
  });

  await service.create(
    {
      subject: 'Preciso de ajuda',
      category: 'SUPPORT',
      priority: 'MEDIUM',
    },
    {
      id: 'user-partner',
      name: 'Maria',
      email: 'maria@example.com',
      role: 'PARTNER',
      partnerId,
      permissions: [],
    },
  );

  assert.equal(adminNotifications.length, 1);
  assert.equal(adminNotifications[0][0].data.ticketId, '22222222-2222-4222-8222-222222222222');
});

test('primeira visualização move chamado e avisa o parceiro uma única vez', async () => {
  let status = 'NEW';
  const ticket = {
    id: '33333333-3333-4333-8333-333333333333',
    protocol: 'TKT-VISTO',
    subject: 'Acompanhar chamado',
    partnerId: '44444444-4444-4444-8444-444444444444',
    messages: [],
    status,
  };
  const { service, timelines, partnerNotifications } = createService({
    ticket: {
      findUnique: async () => ({ ...ticket, status }),
      update: async ({ data }) => {
        status = data.status;
        return { ...ticket, status };
      },
    },
  });
  const admin = {
    id: 'user-admin',
    name: 'Administrador',
    email: 'admin@example.com',
    role: 'ADMIN',
    permissions: [],
  };

  await service.acknowledge(ticket.id, admin);
  await service.acknowledge(ticket.id, admin);

  assert.equal(status, 'IN_PROGRESS');
  assert.equal(timelines.length, 1);
  assert.equal(partnerNotifications.length, 1);
  assert.equal(partnerNotifications[0][1].data.ticketId, ticket.id);
});

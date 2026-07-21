import {
  PrismaClient,
  UserRole,
  PartnerStatus,
  BranchStatus,
  LineStatus,
  CommissionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PERMISSIONS } from '@luxus/types';

const prisma = new PrismaClient();

async function seedPermissions() {
  const allPermissions = Object.values(PERMISSIONS);
  for (const name of allPermissions) {
    const module = name.split(':')[0];
    await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: `Permissão ${name}` },
      update: {},
    });
  }
  console.log(`✓ ${allPermissions.length} permissões`);
}

async function seedOperators() {
  const operators = [
    {
      name: 'Claro',
      slug: 'claro',
      description: 'Operadora Claro',
      status: true,
    },
    {
      name: 'Vivo',
      slug: 'vivo',
      description: 'Operadora Vivo',
      status: true,
    },
    {
      name: 'TIM',
      slug: 'tim',
      description: 'Operadora TIM',
      status: true,
    },
    {
      name: 'Oi',
      slug: 'oi',
      description: 'Operadora Oi',
      status: true,
    },
  ];

  const created: Record<string, string> = {};
  for (const op of operators) {
    const record = await prisma.operator.upsert({
      where: { slug: op.slug },
      create: op,
      update: { name: op.name, description: op.description, status: op.status },
    });
    created[op.slug] = record.id;
    console.log(`  ✓ Operadora: ${record.name}`);
  }
  console.log(`✓ ${operators.length} operadoras`);
  return created;
}

async function seedPlans(operatorIds: Record<string, string>) {
  const plans = [
    {
      name: 'Claro Controle 30GB',
      operatorSlug: 'claro',
      price: 59.99,
      commission: 10,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 5.99,
      dataFranchise: '30GB',
      speed: '4G',
      description: 'Plano Claro Controle com 30GB de dados',
      status: true,
    },
    {
      name: 'Claro Pós 50GB',
      operatorSlug: 'claro',
      price: 99.99,
      commission: 12,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 12.0,
      dataFranchise: '50GB',
      speed: '5G',
      description: 'Plano Claro Pós com 50GB de dados',
      status: true,
    },
    {
      name: 'Vivo Controle 25GB',
      operatorSlug: 'vivo',
      price: 54.99,
      commission: 10,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 5.5,
      dataFranchise: '25GB',
      speed: '4G',
      description: 'Plano Vivo Controle com 25GB de dados',
      status: true,
    },
    {
      name: 'Vivo Pós 60GB',
      operatorSlug: 'vivo',
      price: 109.99,
      commission: 12,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 13.2,
      dataFranchise: '60GB',
      speed: '5G',
      description: 'Plano Vivo Pós com 60GB de dados',
      status: true,
    },
    {
      name: 'TIM Black 40GB',
      operatorSlug: 'tim',
      price: 79.99,
      commission: 11,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 8.8,
      dataFranchise: '40GB',
      speed: '4G',
      description: 'Plano TIM Black com 40GB de dados',
      status: true,
    },
    {
      name: 'Oi Livre 20GB',
      operatorSlug: 'oi',
      price: 44.99,
      commission: 8,
      commissionType: CommissionType.PERCENTAGE,
      commissionValue: 3.6,
      dataFranchise: '20GB',
      speed: '4G',
      description: 'Plano Oi Livre com 20GB de dados',
      status: true,
    },
  ];

  const createdIds: string[] = [];
  for (const plan of plans) {
    const { operatorSlug, price, commission, commissionValue, ...rest } = plan;
    const operatorId = operatorIds[operatorSlug];
    if (!operatorId) continue;

    const existing = await prisma.plan.findFirst({
      where: { name: plan.name, operatorId },
    });

    if (existing) {
      createdIds.push(existing.id);
      console.log(`  ~ Plano já existe: ${plan.name}`);
    } else {
      const record = await prisma.plan.create({
        data: {
          ...rest,
          operatorId,
          price,
          commission,
          commissionValue,
        },
      });
      createdIds.push(record.id);
      console.log(`  ✓ Plano: ${record.name}`);
    }
  }
  console.log(`✓ ${plans.length} planos`);
  return createdIds;
}

async function seedPartnerAndUsers(hashedPassword: string) {
  const partner = await prisma.partner.upsert({
    where: { document: '12345678000190' },
    create: {
      name: 'Parceiro Luxus',
      tradeName: 'Parceiro Luxus',
      document: '12345678000190',
      email: 'contato@luxus.com.br',
      phone: '11988887777',
      status: PartnerStatus.ACTIVE,
      commissionRate: 10,
      goal: 50,
      goalMonth: 50,
    },
    update: {
      name: 'Parceiro Luxus',
      tradeName: 'Parceiro Luxus',
      email: 'contato@luxus.com.br',
    },
  });
  console.log(`✓ Parceiro: ${partner.name}`);

  const partnerUser = await prisma.user.upsert({
    where: { email: 'parceiro@demotelecom.com.br' },
    create: {
      email: 'parceiro@demotelecom.com.br',
      password: hashedPassword,
      name: 'Usuário Parceiro',
      phone: '11977776666',
      role: UserRole.PARTNER,
      partnerId: partner.id,
      isActive: true,
    },
    update: { partnerId: partner.id },
  });
  console.log(`✓ Usuário parceiro: ${partnerUser.email}`);

  return partner;
}

async function seedBranches(partnerId: string) {
  const branches = [
    {
      name: 'Filial Centro',
      document: '12345678000271',
      address: 'Rua das Flores, 100',
      city: 'São Paulo',
      state: 'SP',
      phone: '11933331111',
      email: 'centro@luxus.com.br',
      status: BranchStatus.ACTIVE,
      parentPartnerId: partnerId,
    },
    {
      name: 'Filial Norte',
      document: '12345678000352',
      address: 'Av. Norte, 500',
      city: 'São Paulo',
      state: 'SP',
      phone: '11933332222',
      email: 'norte@luxus.com.br',
      status: BranchStatus.ACTIVE,
      parentPartnerId: partnerId,
    },
  ];

  for (const branch of branches) {
    const existing = await prisma.branch.findFirst({
      where: { document: branch.document, parentPartnerId: partnerId },
    });

    if (existing) {
      console.log(`  ~ Filial já existe: ${branch.name}`);
    } else {
      const record = await prisma.branch.create({ data: branch });
      console.log(`  ✓ Filial: ${record.name}`);
    }
  }
  console.log(`✓ ${branches.length} filiais`);
}

async function seedSimCards(
  operatorIds: Record<string, string>,
  partnerId: string,
) {
  const simCards = [
    {
      iccid: '89550534000000000001',
      operatorSlug: 'claro',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-001',
    },
    {
      iccid: '89550534000000000002',
      operatorSlug: 'claro',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-001',
    },
    {
      iccid: '89550534000000000003',
      operatorSlug: 'claro',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-001',
    },
    {
      iccid: '89550541000000000001',
      operatorSlug: 'vivo',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-002',
    },
    {
      iccid: '89550541000000000002',
      operatorSlug: 'vivo',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-002',
    },
    {
      iccid: '89550572000000000001',
      operatorSlug: 'tim',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-003',
    },
    {
      iccid: '89550572000000000002',
      operatorSlug: 'tim',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-003',
    },
    {
      iccid: '89550531000000000001',
      operatorSlug: 'oi',
      status: LineStatus.AVAILABLE,
      batchNumber: 'LOTE-2024-004',
    },
  ];

  let count = 0;
  for (const sim of simCards) {
    const { operatorSlug, ...rest } = sim;
    const operatorId = operatorIds[operatorSlug];
    if (!operatorId) continue;

    await prisma.simCard.upsert({
      where: { iccid: sim.iccid },
      create: { ...rest, operatorId, partnerId },
      update: {},
    });
    count++;
  }
  console.log(`✓ ${count} SIM cards`);
}

async function main() {
  console.log('Iniciando seed...\n');

  await seedPermissions();

  const hashedPassword = await bcrypt.hash('Luxus@2024', 10);

  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@luxus.com.br' },
    create: {
      email: 'admin@luxus.com.br',
      password: hashedPassword,
      name: 'Administrador Luxus',
      phone: '11999990000',
      role: UserRole.ADMIN,
      isActive: true,
    },
    update: {},
  });
  console.log(`✓ Admin: ${admin.email}`);

  // Admin luxusparceiros
  const adminLuxus = await prisma.user.upsert({
    where: { email: 'admin@luxusparceiros.com' },
    create: {
      email: 'admin@luxusparceiros.com',
      password: hashedPassword,
      name: 'Administrador',
      phone: '11999990001',
      role: UserRole.ADMIN,
      isActive: true,
    },
    update: {},
  });
  console.log(`✓ Admin: ${adminLuxus.email}`);

  // Operators
  const operatorIds = await seedOperators();

  // Plans
  await seedPlans(operatorIds);

  // Partner and partner user
  const partner = await seedPartnerAndUsers(hashedPassword);

  // Branches
  await seedBranches(partner.id);

  // SIM cards
  await seedSimCards(operatorIds, partner.id);

  console.log('\n✅ Seed concluído com sucesso!');
  console.log('\nCredenciais:');
  console.log('  Admin:    admin@luxusparceiros.com / Luxus@2024');
  console.log('  Admin:    admin@luxus.com.br / Luxus@2024');
  console.log('  Parceiro: parceiro@demotelecom.com.br / Luxus@2024');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

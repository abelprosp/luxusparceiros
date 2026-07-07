import { PrismaClient, UserRole, PartnerStatus } from '@prisma/client';
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

async function main() {
  console.log('Iniciando seed...');

  await seedPermissions();

  const hashedPassword = await bcrypt.hash('Luxus@2024', 10);

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
    update: { password: hashedPassword },
  });
  console.log(`✓ Admin: ${admin.email}`);

  const partner = await prisma.partner.upsert({
    where: { document: '12345678000190' },
    create: {
      name: 'Parceiro Luxus',
      tradeName: 'Parceiro Luxus',
      document: '12345678000190',
      email: 'contato@luxus.com.br',
      phone: '11988887777',
      status: PartnerStatus.ACTIVE,
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
    update: { partnerId: partner.id, password: hashedPassword },
  });
  console.log(`✓ Parceiro: ${partnerUser.email}`);

  console.log('\n✅ Seed concluído (apenas usuários e permissões).');
  console.log('\nCredenciais:');
  console.log('  Admin: admin@luxus.com.br / Luxus@2024');
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

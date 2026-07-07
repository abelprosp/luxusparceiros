import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removendo dados operacionais (mantendo usuários e parceiros)...');

  await prisma.$transaction([
    prisma.document.deleteMany(),
    prisma.ticketMessage.deleteMany(),
    prisma.ticketTimeline.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.requestComment.deleteMany(),
    prisma.requestTimeline.deleteMany(),
    prisma.request.deleteMany(),
    prisma.commission.deleteMany(),
    prisma.sale.deleteMany(),
    prisma.stockMovement.deleteMany(),
    prisma.financialRecord.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.partnerPlan.deleteMany(),
    prisma.line.deleteMany(),
    prisma.simCard.deleteMany(),
    prisma.client.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.commissionRule.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.plan.deleteMany(),
    prisma.operator.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);

  console.log('✅ Dados fake removidos. Usuários e cadastro de parceiros preservados.');
}

main()
  .catch((e) => {
    console.error('Erro na limpeza:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

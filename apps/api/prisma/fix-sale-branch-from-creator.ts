/**
 * Corrige vendas (e clientes vinculados) criadas por usuário de filial
 * mas gravadas sem branchId — apareciam como Matriz no dashboard.
 *
 * Uso:
 *   npx ts-node prisma/fix-sale-branch-from-creator.ts --dry-run
 *   npx ts-node prisma/fix-sale-branch-from-creator.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const orphanSales = await prisma.sale.findMany({
    where: {
      branchId: null,
      createdBy: { branchId: { not: null } },
    },
    select: {
      id: true,
      protocol: true,
      partnerId: true,
      clientId: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          branchId: true,
          partnerId: true,
          branch: { select: { id: true, name: true, parentPartnerId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(
    dryRun
      ? `[dry-run] Encontradas ${orphanSales.length} venda(s) sem filial com criador de filial.`
      : `Corrigindo ${orphanSales.length} venda(s) sem filial com criador de filial.`,
  );

  let salesUpdated = 0;
  let clientsUpdated = 0;
  let skipped = 0;

  for (const sale of orphanSales) {
    const branchId = sale.createdBy.branchId;
    const branch = sale.createdBy.branch;

    if (!branchId || !branch) {
      console.warn(`- ${sale.protocol}: criador sem filial válida, ignorada`);
      skipped += 1;
      continue;
    }

    if (branch.parentPartnerId !== sale.partnerId) {
      console.warn(
        `- ${sale.protocol}: filial "${branch.name}" não pertence ao parceiro da venda, ignorada`,
      );
      skipped += 1;
      continue;
    }

    if (sale.createdBy.partnerId && sale.createdBy.partnerId !== sale.partnerId) {
      console.warn(
        `- ${sale.protocol}: criador de outro parceiro, ignorada`,
      );
      skipped += 1;
      continue;
    }

    console.log(
      `- ${sale.protocol} → ${branch.name} (${branchId}) [criador: ${sale.createdBy.name}]`,
    );

    if (dryRun) {
      salesUpdated += 1;
      const client = await prisma.client.findUnique({
        where: { id: sale.clientId },
        select: { id: true, branchId: true },
      });
      if (client && client.branchId == null) clientsUpdated += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { branchId },
      });
      salesUpdated += 1;

      const client = await tx.client.findUnique({
        where: { id: sale.clientId },
        select: { id: true, branchId: true, partnerId: true },
      });

      if (client && client.branchId == null && client.partnerId === sale.partnerId) {
        await tx.client.update({
          where: { id: client.id },
          data: { branchId },
        });
        clientsUpdated += 1;
      }
    });
  }

  console.log(
    dryRun
      ? `[dry-run] Resumo: ${salesUpdated} venda(s) e ${clientsUpdated} cliente(s) seriam corrigidos; ${skipped} ignorada(s).`
      : `✅ Concluído: ${salesUpdated} venda(s) e ${clientsUpdated} cliente(s) corrigidos; ${skipped} ignorada(s).`,
  );
}

main()
  .catch((error) => {
    console.error('Erro ao corrigir filiais das vendas:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

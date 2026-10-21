import { OutboxStatus, Prisma, PrismaClient } from '@prisma/client';

export const OUTBOX_COMMISSION_FROM_SALE = 'COMMISSION_FROM_SALE';

type OutboxClient = Pick<PrismaClient | Prisma.TransactionClient, 'outboxEvent'>;

/** Registra (ou rearma) um efeito a ser executado depois; use dentro da mesma transação da mudança de estado. */
export function enqueueOutboxEvent(prisma: OutboxClient, type: string, aggregateId: string) {
  return prisma.outboxEvent.upsert({
    where: { type_aggregateId: { type, aggregateId } },
    create: { type, aggregateId },
    update: {
      status: OutboxStatus.PENDING,
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      processedAt: null,
    },
  });
}

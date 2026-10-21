import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxStatus, SaleStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CoordinationService } from '@/common/coordination/coordination.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
import { OUTBOX_COMMISSION_FROM_SALE } from './outbox-events';

const BATCH_SIZE = 20;
const MAX_ATTEMPTS = 10;

/**
 * Executa os efeitos registrados na outbox (hoje: comissão da venda ativada) com retentativa e
 * backoff exponencial. O envio ao telefonia-2 já é uma fila persistida nos campos telefoniaSync* da venda.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: CoordinationService,
    private readonly commissions: CommissionsService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.timer.unref();
    setImmediate(() => void this.tick());
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    try {
      await this.coordination.withLock('outbox', 5 * 60_000, () => this.processDue());
    } catch (error) {
      this.logger.warn(`Falha ao processar a outbox: ${error instanceof Error ? error.message : error}`);
    }
  }

  async processDue() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING, nextAttemptAt: { lte: new Date() } },
      orderBy: { nextAttemptAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const event of events) {
      try {
        await this.handle(event.type, event.aggregateId);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.DONE, processedAt: new Date(), lastError: null },
        });
      } catch (error) {
        const attempts = event.attempts + 1;
        const message = error instanceof Error ? error.message : String(error);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts,
            lastError: message.slice(0, 1000),
            status: attempts >= MAX_ATTEMPTS ? OutboxStatus.FAILED : OutboxStatus.PENDING,
            nextAttemptAt: new Date(Date.now() + this.retryDelayMs(attempts)),
          },
        });
        this.logger.warn(`Evento ${event.type} ${event.aggregateId} falhou (tentativa ${attempts}): ${message}`);
      }
    }
    return events.length;
  }

  private async handle(type: string, aggregateId: string) {
    if (type === OUTBOX_COMMISSION_FROM_SALE) {
      const sale = await this.prisma.sale.findUnique({ where: { id: aggregateId } });
      if (!sale || sale.status !== SaleStatus.ACTIVATED) return;
      await this.commissions.createFromSale(sale, sale.createdById);
      return;
    }
    throw new Error(`Tipo de evento desconhecido: ${type}`);
  }

  private retryDelayMs(attempts: number) {
    return Math.min(60 * 60_000, 30_000 * 2 ** Math.min(attempts, 7));
  }
}

import { BadRequestException } from '@nestjs/common';
import { CommissionStatus, Prisma } from '@prisma/client';

type CommissionClient = Pick<Prisma.TransactionClient, 'commission'>;

/**
 * Cancela a comissão de uma venda que deixou de estar ativada.
 * Comissão já paga bloqueia o cancelamento, a menos que `keepPaid` permita mantê-la.
 */
export async function cancelSaleCommission(
  tx: CommissionClient,
  saleId: string,
  options: { keepPaid?: boolean } = {},
) {
  const commission = await tx.commission.findUnique({
    where: { saleId },
    select: { id: true, status: true },
  });
  if (!commission || commission.status === CommissionStatus.CANCELLED) return null;
  if (commission.status === CommissionStatus.PAID) {
    if (options.keepPaid) return null;
    throw new BadRequestException(
      'A comissão desta venda já foi paga. Estorne o pagamento antes de cancelar ou rejeitar a venda.',
    );
  }
  return tx.commission.update({
    where: { id: commission.id },
    data: { status: CommissionStatus.CANCELLED, approvedAt: null, approvedBy: null },
  });
}

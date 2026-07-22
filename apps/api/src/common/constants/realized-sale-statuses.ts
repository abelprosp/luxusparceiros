import { SaleStatus } from '@prisma/client';

/** Statuses que representam uma venda efetivamente realizada. */
export const REALIZED_SALE_STATUSES: SaleStatus[] = [
  SaleStatus.APPROVED,
  SaleStatus.ACTIVATED,
];

export function realizedSaleStatusFilter(): { in: SaleStatus[] } {
  return { in: [...REALIZED_SALE_STATUSES] };
}

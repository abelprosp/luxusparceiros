import { BadRequestException } from '@nestjs/common';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';

export async function assertBranchBelongsToPartner(
  prisma: PrismaService,
  branchId: string,
  partnerId: string,
): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, parentPartnerId: partnerId },
  });
  if (!branch) {
    throw new BadRequestException('Filial inválida para este parceiro');
  }
}

export function applyBranchFilter(
  user: AuthUser,
  branchId?: string,
): { branchId?: string } | Record<string, never> {
  if (branchId) return { branchId };
  return {};
}

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthUser, UserRole } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { MESSAGES } from '../constants/messages';

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

export function resolveBranchId(user: AuthUser, requestedBranchId?: string): string | undefined {
  // Qualquer usuário vinculado a uma filial fica restrito a ela (não só ATTENDANT).
  if (user.branchId) {
    if (requestedBranchId && requestedBranchId !== user.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return user.branchId;
  }
  if (user.role === UserRole.ATTENDANT) {
    throw new ForbiddenException('Usuário de filial sem vínculo');
  }
  return requestedBranchId;
}

export function applyBranchFilter(
  user: AuthUser,
  branchId?: string,
): { branchId?: string } | Record<string, never> {
  const resolved = resolveBranchId(user, branchId);
  if (resolved) return { branchId: resolved };
  return {};
}

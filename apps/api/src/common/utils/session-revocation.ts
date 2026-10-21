import { Prisma, PrismaClient } from '@prisma/client';

type RefreshTokenClient = Pick<PrismaClient | Prisma.TransactionClient, 'refreshToken'>;

export async function revokeUserSessions(prisma: RefreshTokenClient, userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokePartnerSessions(prisma: RefreshTokenClient, partnerId: string) {
  await prisma.refreshToken.updateMany({
    where: { user: { partnerId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

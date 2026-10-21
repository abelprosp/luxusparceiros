import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { AuthUser, AuthTokens, JwtPayload, ROLE_PERMISSIONS, UserRole } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MailService } from '@/common/mail/mail.service';
import { MESSAGES } from '@/common/constants/messages';
import { JWT_ALGORITHM, jwtAudience, jwtIssuer } from '@/common/utils/jwt-options';
import { hashToken } from '@/common/utils/token-hash';
import { revokePartnerSessions, revokeUserSessions } from '@/common/utils/session-revocation';
import { ForgotPasswordDto, LoginDto } from './dto/auth.dto';
import { LoginThrottleService } from './login-throttle.service';

/** Tempo em que um refresh token recém-trocado ainda é aceito (abas abertas renovando juntas). */
const REFRESH_REUSE_GRACE_MS = 30_000;
const RESET_TOKEN_TTL_MS = 60 * 60_000;
const FORGOT_PASSWORD_MESSAGE = 'Se o e-mail existir, você receberá instruções para redefinir sua senha.';

interface AuthenticatableUser {
  id: string;
  isActive: boolean;
  role: string;
  partnerId: string | null;
  branchId: string | null;
  partner?: { status: string } | null;
  branch?: { parentPartnerId: string; status: string } | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    private loginThrottle: LoginThrottleService,
    private mailService: MailService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthTokens & { user: AuthUser }> {
    const email = dto.email.toLowerCase();
    await this.loginThrottle.assertAllowed(email, ip);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        permissions: { include: { permission: true } },
        partner: true,
        branch: true,
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      await this.loginThrottle.registerFailure(email, ip);
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

    this.assertCanAuthenticate(user);
    await this.loginThrottle.registerSuccess(email, ip);

    const permissions = this.getUserPermissions(user);
    const tokens = await this.generateTokens(user, permissions, { ip, userAgent });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        lastLoginDevice: userAgent,
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      ipAddress: ip,
      userAgent,
    });

    return {
      ...tokens,
      user: this.toAuthUser(user, permissions),
    };
  }

  async refresh(refreshToken: string, ip?: string, userAgent?: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: hashToken(refreshToken) },
      include: {
        user: {
          include: {
            permissions: { include: { permission: true } },
            partner: true,
            branch: true,
          },
        },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
    }

    const familyId = stored.familyId ?? stored.id;
    if (stored.rotatedAt) {
      if (Date.now() - stored.rotatedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
        await this.revokeFamily(familyId);
        await this.auditService.log({
          userId: stored.userId,
          action: 'LOGOUT',
          module: 'auth',
          ipAddress: ip,
          userAgent,
          newData: { reason: 'refresh_token_reuse', familyId },
        });
        throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
      }
      const familyAlive = await this.prisma.refreshToken.count({
        where: { familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      });
      if (!familyAlive) throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
    } else if (stored.revokedAt) {
      throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
    }

    try {
      this.assertCanAuthenticate(stored.user);
    } catch (error) {
      await this.revokeAllForUser(stored.userId);
      throw error;
    }

    if (!stored.rotatedAt) {
      const rotated = await this.prisma.refreshToken.updateMany({
        where: { id: stored.id, rotatedAt: null, revokedAt: null },
        data: { rotatedAt: new Date(), revokedAt: new Date() },
      });
      if (rotated.count !== 1) {
        const current = await this.prisma.refreshToken.findUnique({
          where: { id: stored.id },
          select: { rotatedAt: true },
        });
        const withinGrace = current?.rotatedAt
          && Date.now() - current.rotatedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
        if (!withinGrace) throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
      }
    }

    const permissions = this.getUserPermissions(stored.user);
    return this.generateTokens(stored.user, permissions, { ip, userAgent, familyId });
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const stored = await this.prisma.refreshToken.findFirst({
        where: { token: hashToken(refreshToken), userId },
        select: { id: true, familyId: true },
      });
      if (stored) await this.revokeFamily(stored.familyId ?? stored.id);
    } else {
      await this.revokeAllForUser(userId);
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      module: 'auth',
    });
  }

  async revokeAllForUser(userId: string) {
    await revokeUserSessions(this.prisma, userId);
  }

  async revokeAllForPartner(partnerId: string) {
    await revokePartnerSessions(this.prisma, partnerId);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const appUrl = (this.configService.get<string>('APP_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const link = `${appUrl}/redefinir-senha?token=${encodeURIComponent(token)}`;
    const sent = await this.mailService.send({
      to: user.email,
      subject: 'Redefinição de senha — Luxus Parceiros',
      text: [
        `Olá, ${user.name}.`,
        '',
        'Recebemos um pedido para redefinir a sua senha no Luxus Parceiros.',
        `Para criar uma nova senha, acesse: ${link}`,
        '',
        'O link vale por 1 hora e só pode ser usado uma vez.',
        'Se você não fez esse pedido, ignore este e-mail; sua senha continua a mesma.',
      ].join('\n'),
    }).catch((error) => {
      this.logger.error(`Falha ao enviar e-mail de redefinição: ${error instanceof Error ? error.message : error}`);
      return false;
    });

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    if (!sent && (!isProduction || this.configService.get('MAIL_LOG_LINKS') === 'true')) {
      this.logger.warn(`Link de redefinição (SMTP ausente): ${link}`);
    }
    if (!sent && !isProduction) {
      return { message: FORGOT_PASSWORD_MESSAGE, resetToken: token };
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException(MESSAGES.INVALID_TOKEN);
    }

    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: stored.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new BadRequestException(MESSAGES.INVALID_TOKEN);

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { password: hashed },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.auditService.log({
      userId: stored.userId,
      action: 'UPDATE',
      module: 'auth',
      newData: { passwordReset: true, sessionsRevoked: true },
    });
    return { message: 'Senha redefinida com sucesso' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(newPassword, 10) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Senha alterada com sucesso' };
  }

  async me(userId: string): Promise<AuthUser & { phone?: string; avatar?: string; theme: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: { include: { permission: true } },
        partner: true,
        branch: true,
      },
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.NOT_FOUND);
    }

    const permissions = this.getUserPermissions(user);
    return {
      ...this.toAuthUser(user, permissions),
      phone: user.phone ?? undefined,
      avatar: user.avatar ?? undefined,
      theme: user.theme,
    };
  }

  private assertCanAuthenticate(user: AuthenticatableUser) {
    if (!user.isActive) {
      throw new UnauthorizedException(MESSAGES.USER_INACTIVE);
    }

    if (user.partner?.status === 'SUSPENDED') {
      throw new UnauthorizedException(MESSAGES.PARTNER_SUSPENDED);
    }

    if (user.role === UserRole.ATTENDANT) {
      if (!user.branchId || !user.branch || !user.partnerId) {
        throw new UnauthorizedException('Usuário de filial sem vínculo com o parceiro');
      }
      if (user.branch.parentPartnerId !== user.partnerId) {
        throw new UnauthorizedException('Filial não vinculada ao parceiro mestre');
      }
      if (user.branch.status !== 'ACTIVE') {
        throw new UnauthorizedException('Filial inativa. Contate o parceiro.');
      }
    }
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { OR: [{ familyId }, { id: familyId }], revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private toAuthUser(
    user: {
      id: string;
      email: string;
      name: string;
      avatar: string | null;
      role: string;
      partnerId: string | null;
      branchId: string | null;
      partner?: { name: string } | null;
      branch?: { name: string } | null;
    },
    permissions: string[],
  ): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? undefined,
      role: user.role as AuthUser['role'],
      partnerId: user.partnerId ?? undefined,
      partnerName: user.partner?.name,
      branchId: user.branchId ?? undefined,
      branchName: user.branch?.name,
      permissions,
    };
  }

  private getUserPermissions(user: {
    role: string;
    permissions: { permission: { name: string } }[];
  }): string[] {
    const rolePerms = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? [];
    const customPerms = user.permissions.map((p) => p.permission.name);
    return [...new Set([...rolePerms, ...customPerms])];
  }

  private async generateTokens(
    user: { id: string; email: string; role: string; partnerId: string | null; branchId: string | null },
    permissions: string[],
    context: { ip?: string; userAgent?: string; familyId?: string },
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      partnerId: user.partnerId ?? undefined,
      branchId: user.branchId ?? undefined,
      permissions,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '365d');

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn,
      algorithm: JWT_ALGORITHM,
      issuer: jwtIssuer(this.configService),
      audience: jwtAudience(this.configService),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshMs = this.parseDuration(refreshExpiresIn);
    const id = randomUUID();

    await this.prisma.refreshToken.create({
      data: {
        id,
        token: hashToken(refreshToken),
        familyId: context.familyId ?? id,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshMs),
        ipAddress: context.ip,
        userAgent: context.userAgent?.slice(0, 500),
      },
    });

    const accessMs = this.parseDuration(expiresIn);
    return { accessToken, refreshToken, expiresIn: Math.floor(accessMs / 1000) };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] ?? 60000);
  }
}

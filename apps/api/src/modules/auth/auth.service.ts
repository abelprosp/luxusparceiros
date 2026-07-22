import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuthUser, AuthTokens, JwtPayload, ROLE_PERMISSIONS, UserRole } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { ForgotPasswordDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthTokens & { user: AuthUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        permissions: { include: { permission: true } },
        partner: true,
        branch: true,
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException(MESSAGES.INVALID_CREDENTIALS);
    }

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

    const permissions = this.getUserPermissions(user);
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.partnerId,
      user.branchId,
      permissions,
    );

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

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException(MESSAGES.REFRESH_TOKEN_REVOKED);
    }

    const permissions = this.getUserPermissions(stored.user);
    const tokens = await this.generateTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
      stored.user.partnerId,
      stored.user.branchId,
      permissions,
    );

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return tokens;
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { token: refreshToken, userId },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      module: 'auth',
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string; resetToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      return { message: 'Se o e-mail existir, você receberá instruções para redefinir sua senha.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    this.resetTokens.set(token, { userId: user.id, expiresAt });

    const isDev = this.configService.get('NODE_ENV') !== 'production';
    return {
      message: 'Se o e-mail existir, você receberá instruções para redefinir sua senha.',
      ...(isDev && { resetToken: token }),
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const resetData = this.resetTokens.get(token);
    if (!resetData || resetData.expiresAt < new Date()) {
      throw new BadRequestException(MESSAGES.INVALID_TOKEN);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: resetData.userId },
      data: { password: hashed },
    });

    this.resetTokens.delete(token);
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
    userId: string,
    email: string,
    role: string,
    partnerId: string | null,
    branchId: string | null,
    permissions: string[],
  ): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      role: role as JwtPayload['role'],
      partnerId: partnerId ?? undefined,
      branchId: branchId ?? undefined,
      permissions,
    };

    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      expiresIn,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshMs = this.parseDuration(refreshExpiresIn);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + refreshMs),
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { AuthUser, UserRole } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, resolvePartnerId } from '@/common/utils/partner-scope';
import { revokeUserSessions } from '@/common/utils/session-revocation';
import { canAccessBankData, maskBankData } from '@/common/utils/bank-data';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UpdatePartnerProfileDto, UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(actor: AuthUser, params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    if (actor.partnerId) where.partnerId = actor.partnerId;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          partnerId: true,
          partner: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, actor?: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        partnerId: true,
        partner: { select: { id: true, name: true } },
        theme: true,
        notificationsEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (actor && user.partnerId) assertPartnerAccess(actor, user.partnerId);
    if (actor?.partnerId && !user.partnerId) throw new ForbiddenException(MESSAGES.FORBIDDEN);
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException(MESSAGES.EMAIL_EXISTS);

    if (actor.branchId) {
      throw new ForbiddenException('Usuários de filial não podem cadastrar outros usuários');
    }
    const partnerId = resolvePartnerId(actor, dto.partnerId ?? undefined);
    await this.assertRoleScope(dto.role ?? UserRole.PARTNER, partnerId ?? null);
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashed,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        partnerId,
        isActive: dto.isActive ?? true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        partnerId: true,
        isActive: true,
        createdAt: true,
      },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'CREATE',
      module: 'users',
      entityId: user.id,
      entityType: 'User',
      newData: user as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const existing = await this.findOne(id, actor);
    if (actor.branchId && actor.id !== id) {
      throw new ForbiddenException('Usuários de filial não podem alterar outros usuários');
    }
    const { password, email, partnerId: requestedPartnerId, ...rest } = dto;
    const partnerId = requestedPartnerId === null && !actor.partnerId
      ? null
      : requestedPartnerId
        ? resolvePartnerId(actor, requestedPartnerId) ?? null
        : existing.partnerId;
    const role = (rest.role ?? existing.role) as UserRole;
    const scopeChanged = role !== existing.role || partnerId !== existing.partnerId;
    if (scopeChanged) await this.assertRoleScope(role, partnerId);
    const data: Prisma.UserUncheckedUpdateInput = { ...rest, partnerId };
    if (email) data.email = email.toLowerCase();
    if (password) data.password = await bcrypt.hash(password, 10);
    const revokeSessions = Boolean(password) || scopeChanged || rest.isActive === false;

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          partnerId: true,
          isActive: true,
          updatedAt: true,
        },
      });
      if (revokeSessions) await revokeUserSessions(tx, id);
      return updated;
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'users',
      entityId: id,
      entityType: 'User',
      newData: user as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  async remove(id: string, actor: AuthUser) {
    await this.findOne(id, actor);
    await this.prisma.user.delete({ where: { id } });
    await this.auditService.log({
      userId: actor.id,
      action: 'DELETE',
      module: 'users',
      entityId: id,
      entityType: 'User',
    });
    return { message: 'Usuário removido com sucesso' };
  }

  async getProfile(user: AuthUser) {
    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        partnerId: true,
        branchId: true,
        biometricEnabled: true,
        theme: true,
        notificationsEnabled: true,
        partner: {
          select: {
            id: true,
            name: true,
            tradeName: true,
            document: true,
            email: true,
            phone: true,
            bankName: true,
            bankAgency: true,
            bankAccount: true,
            pixKey: true,
            pixKeyType: true,
          },
        },
      },
    });
    return { ...profile, partner: profile.partner ? maskBankData(profile.partner, user) : null };
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: user.id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        partnerId: true,
        branchId: true,
        biometricEnabled: true,
        theme: true,
        notificationsEnabled: true,
      },
    });
  }

  async updatePartnerProfile(user: AuthUser, dto: UpdatePartnerProfileDto) {
    if (!user.partnerId || user.branchId || !canAccessBankData(user)) {
      throw new ForbiddenException('Somente o usuário da matriz pode alterar os dados bancários');
    }
    const partner = await this.prisma.partner.update({
      where: { id: user.partnerId },
      data: dto,
    });
    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'partner-bank-data',
      entityId: user.partnerId,
      entityType: 'Partner',
      newData: { fields: Object.keys(dto) } as Prisma.InputJsonValue,
    });
    return partner;
  }

  /**
   * PARTNER exige parceiro; ATTENDANT nasce só pelo cadastro de filiais;
   * ADMIN/SUPERVISOR/FINANCIAL podem ser da Luxus (sem parceiro) ou de um parceiro existente.
   */
  private async assertRoleScope(role: UserRole, partnerId: string | null) {
    if (role === UserRole.ATTENDANT) {
      throw new BadRequestException('Usuários de filial são criados na tela de Filiais');
    }
    if (role === UserRole.PARTNER && !partnerId) {
      throw new BadRequestException('Selecione o parceiro do usuário');
    }
    if (partnerId) {
      const partner = await this.prisma.partner.findUnique({
        where: { id: partnerId },
        select: { id: true },
      });
      if (!partner) throw new BadRequestException('Parceiro não encontrado');
    }
  }
}

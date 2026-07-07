import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { BranchStatus, PartnerStatus, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

const branchInclude = {
  parentPartner: { select: { id: true, name: true } },
  users: {
    where: { role: UserRole.ATTENDANT },
    select: { id: true, email: true, isActive: true },
    take: 1,
  },
  _count: { select: { sales: true, clients: true } },
} as const;

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; search?: string; partnerId?: string; status?: BranchStatus },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const where: Prisma.BranchWhereInput = {};
    if (partnerId) where.parentPartnerId = partnerId;
    else if (!isAdminRole(user.role)) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    if (user.branchId) where.id = user.branchId;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { document: { contains: params.search } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: branchInclude,
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: branchInclude,
    });
    if (!branch) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, branch.parentPartnerId);
    if (user.branchId && user.branchId !== id) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return branch;
  }

  async create(partnerId: string, dto: CreateBranchDto, user: AuthUser) {
    const resolvedPartnerId = resolvePartnerId(user, partnerId);
    if (!resolvedPartnerId) throw new ForbiddenException('Parceiro é obrigatório');
    assertPartnerAccess(user, resolvedPartnerId);
    await this.assertPartnerCanManageBranches(resolvedPartnerId);

    const { login, password, ...branchData } = dto;
    if (!login || !password) {
      throw new BadRequestException('Login e senha são obrigatórios para a filial');
    }

    const exists = await this.prisma.branch.findFirst({
      where: { document: dto.document, parentPartnerId: resolvedPartnerId },
    });
    if (exists) throw new ConflictException('Documento já cadastrado para esta filial');

    const loginEmail = login.toLowerCase();
    const emailExists = await this.prisma.user.findUnique({ where: { email: loginEmail } });
    if (emailExists) throw new ConflictException('E-mail de login já cadastrado');

    const branch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: { ...branchData, parentPartnerId: resolvedPartnerId },
      });

      const hashedPassword = await bcrypt.hash(password, 10);
      await tx.user.create({
        data: {
          email: loginEmail,
          password: hashedPassword,
          name: branchData.name,
          phone: branchData.phone,
          role: UserRole.ATTENDANT,
          partnerId: resolvedPartnerId,
          branchId: created.id,
          isActive: true,
        },
      });

      return tx.branch.findUnique({
        where: { id: created.id },
        include: branchInclude,
      });
    });

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'branches',
      entityId: branch!.id,
      entityType: 'Branch',
      newData: branch as unknown as Prisma.InputJsonValue,
    });

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const { login, password, status, ...branchFields } = this.sanitizeUpdateDto(dto, user, existing.status);
    const data: Prisma.BranchUpdateInput = { ...branchFields };

    if (branchFields.document && branchFields.document !== existing.document) {
      const duplicate = await this.prisma.branch.findFirst({
        where: {
          document: branchFields.document,
          parentPartnerId: existing.parentPartnerId,
          id: { not: id },
        },
      });
      if (duplicate) throw new ConflictException('Documento já cadastrado para outra filial');
    }

    if (status !== undefined) {
      data.status = status;
    }

    const branch = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.branch.update({
        where: { id },
        data,
        include: branchInclude,
      });

      await this.syncBranchUser(tx, {
        branchId: id,
        partnerId: existing.parentPartnerId,
        branchName: updated.name,
        branchPhone: updated.phone,
        login,
        password,
        branchStatus: updated.status,
      });

      return tx.branch.findUnique({
        where: { id },
        include: branchInclude,
      });
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'branches',
      entityId: id,
      entityType: 'Branch',
      newData: branch as unknown as Prisma.InputJsonValue,
    });

    return branch;
  }

  async remove(id: string, user: AuthUser) {
    const branch = await this.findOne(id, user);

    if (branch._count.sales > 0 || branch._count.clients > 0) {
      throw new ConflictException(
        'Filial com vendas ou clientes vinculados não pode ser removida. Desative-a em vez disso.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { branchId: id, role: UserRole.ATTENDANT } });
      await tx.branch.delete({ where: { id } });
    });

    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'branches',
      entityId: id,
      entityType: 'Branch',
    });
    return { message: 'Filial removida com sucesso' };
  }

  private async syncBranchUser(
    tx: Prisma.TransactionClient,
    params: {
      branchId: string;
      partnerId: string;
      branchName: string;
      branchPhone: string;
      login?: string;
      password?: string;
      branchStatus: BranchStatus;
    },
  ) {
    const attendant = await tx.user.findFirst({
      where: { branchId: params.branchId, role: UserRole.ATTENDANT },
    });

    const branch = await tx.branch.findUnique({ where: { id: params.branchId } });
    if (!branch || branch.parentPartnerId !== params.partnerId) {
      throw new BadRequestException('Filial deve pertencer ao parceiro mestre');
    }

    if (!attendant) {
      if (!params.login || !params.password) return;
      const loginEmail = params.login.toLowerCase();
      const emailExists = await tx.user.findUnique({ where: { email: loginEmail } });
      if (emailExists) throw new ConflictException('E-mail de login já cadastrado');

      const hashedPassword = await bcrypt.hash(params.password, 10);
      await tx.user.create({
        data: {
          email: loginEmail,
          password: hashedPassword,
          name: params.branchName,
          phone: params.branchPhone,
          role: UserRole.ATTENDANT,
          partnerId: params.partnerId,
          branchId: params.branchId,
          isActive: params.branchStatus === BranchStatus.ACTIVE,
        },
      });
      return;
    }

    const userData: Prisma.UserUpdateInput = {
      name: params.branchName,
      phone: params.branchPhone,
      isActive: params.branchStatus === BranchStatus.ACTIVE,
    };

    if (params.login) {
      const loginEmail = params.login.toLowerCase();
      if (loginEmail !== attendant.email) {
        const emailExists = await tx.user.findUnique({ where: { email: loginEmail } });
        if (emailExists) throw new ConflictException('E-mail de login já cadastrado');
        userData.email = loginEmail;
      }
    }

    if (params.password) {
      userData.password = await bcrypt.hash(params.password, 10);
    }

    await tx.user.update({ where: { id: attendant.id }, data: userData });
  }

  private async assertPartnerCanManageBranches(partnerId: string) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Parceiro não encontrado');
    if (partner.status !== PartnerStatus.ACTIVE) {
      throw new ForbiddenException('Parceiro suspenso ou inativo não pode gerenciar filiais');
    }
  }

  private sanitizeUpdateDto(
    dto: UpdateBranchDto,
    user: AuthUser,
    currentStatus: BranchStatus,
  ): UpdateBranchDto {
    if (isAdminRole(user.role)) return dto;

    const { status, ...rest } = dto;
    const data: UpdateBranchDto = { ...rest };

    if (status !== undefined) {
      if (status === BranchStatus.INACTIVE) {
        data.status = BranchStatus.INACTIVE;
      } else if (status !== currentStatus) {
        throw new ForbiddenException('Apenas administradores podem reativar filiais');
      }
    }

    return data;
  }
}

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BranchStatus, PartnerStatus, Prisma } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

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
        include: {
          parentPartner: { select: { id: true, name: true } },
          _count: { select: { sales: true, clients: true } },
        },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { data, meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) } };
  }

  async findOne(id: string, user: AuthUser) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        parentPartner: { select: { id: true, name: true } },
        _count: { select: { sales: true, clients: true } },
      },
    });
    if (!branch) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, branch.parentPartnerId);
    return branch;
  }

  async create(partnerId: string, dto: CreateBranchDto, user: AuthUser) {
    const resolvedPartnerId = resolvePartnerId(user, partnerId);
    if (!resolvedPartnerId) throw new ForbiddenException('Parceiro é obrigatório');
    assertPartnerAccess(user, resolvedPartnerId);
    await this.assertPartnerCanManageBranches(resolvedPartnerId);

    const exists = await this.prisma.branch.findFirst({
      where: { document: dto.document, parentPartnerId: resolvedPartnerId },
    });
    if (exists) throw new ConflictException('Documento já cadastrado para esta filial');

    const branch = await this.prisma.branch.create({
      data: { ...dto, parentPartnerId: resolvedPartnerId },
      include: {
        parentPartner: { select: { id: true, name: true } },
        _count: { select: { sales: true, clients: true } },
      },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'branches',
      entityId: branch.id,
      entityType: 'Branch',
      newData: branch as unknown as Prisma.InputJsonValue,
    });

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const data = this.sanitizeUpdateDto(dto, user, existing.status);

    if (data.document && data.document !== existing.document) {
      const duplicate = await this.prisma.branch.findFirst({
        where: {
          document: data.document,
          parentPartnerId: existing.parentPartnerId,
          id: { not: id },
        },
      });
      if (duplicate) throw new ConflictException('Documento já cadastrado para outra filial');
    }

    const branch = await this.prisma.branch.update({
      where: { id },
      data,
      include: {
        parentPartner: { select: { id: true, name: true } },
        _count: { select: { sales: true, clients: true } },
      },
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

    await this.prisma.branch.delete({ where: { id } });
    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'branches',
      entityId: id,
      entityType: 'Branch',
    });
    return { message: 'Filial removida com sucesso' };
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

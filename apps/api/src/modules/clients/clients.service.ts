import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommissionStatus, Prisma, SaleStatus, SaleTaskSyncStatus } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { UploadsService } from '@/modules/uploads/uploads.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertBranchBelongsToPartner, resolveBranchId } from '@/common/utils/branch-scope';
import { assertPartnerAccess, resolvePartnerId } from '@/common/utils/partner-scope';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private uploadsService: UploadsService,
  ) {}

  async findAll(
    user: AuthUser,
    params: { page: number; limit: number; search?: string; partnerId?: string; branchId?: string; isActive?: boolean },
  ) {
    const partnerId = resolvePartnerId(user, params.partnerId);
    const branchId = resolveBranchId(user, params.branchId);
    const where: Prisma.ClientWhereInput = {};
    if (partnerId) where.partnerId = partnerId;
    if (branchId) where.branchId = branchId;
    if (typeof params.isActive === 'boolean') where.isActive = params.isActive;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { document: { contains: params.search } },
        { phone: { contains: params.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: { partner: { select: { id: true, name: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { partner: { select: { id: true, name: true } } },
    });
    if (!client) throw new NotFoundException(MESSAGES.NOT_FOUND);
    assertPartnerAccess(user, client.partnerId);
    if (user.branchId && client.branchId !== user.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    return client;
  }

  async create(dto: CreateClientDto, user: AuthUser) {
    const partnerId = resolvePartnerId(user, dto.partnerId);
    if (!partnerId) {
      throw new ForbiddenException('Parceiro é obrigatório para criar cliente');
    }
    const branchId = resolveBranchId(user, dto.branchId);
    if (branchId) await assertBranchBelongsToPartner(this.prisma, branchId, partnerId);

    const client = await this.prisma.client.create({
      data: { ...dto, partnerId, branchId },
      include: { partner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'clients',
      entityId: client.id,
      entityType: 'Client',
      newData: client as unknown as Prisma.InputJsonValue,
    });

    return client;
  }

  async update(id: string, dto: UpdateClientDto, user: AuthUser) {
    const existing = await this.findOne(id, user);
    const partnerId = dto.partnerId ? resolvePartnerId(user, dto.partnerId) ?? existing.partnerId : existing.partnerId;
    const partnerChanged = partnerId !== existing.partnerId;
    if (partnerChanged) {
      const sales = await this.prisma.sale.count({ where: { clientId: id } });
      if (sales > 0) {
        throw new BadRequestException('Cliente com vendas não pode ser transferido para outro parceiro');
      }
    }
    const branchId = dto.branchId !== undefined
      ? resolveBranchId(user, dto.branchId || undefined) ?? null
      : partnerChanged ? null : existing.branchId;
    if (branchId) await assertBranchBelongsToPartner(this.prisma, branchId, partnerId);

    const client = await this.prisma.client.update({
      where: { id },
      data: { ...dto, partnerId, branchId },
      include: { partner: { select: { id: true, name: true } } },
    });

    await this.auditService.log({
      userId: user.id,
      action: 'UPDATE',
      module: 'clients',
      entityId: id,
      entityType: 'Client',
      oldData: existing as unknown as Prisma.InputJsonValue,
      newData: client as unknown as Prisma.InputJsonValue,
    });

    return client;
  }

  async remove(id: string, user: AuthUser) {
    await this.deleteClientSafely(id, user);
    return { message: 'Cliente removido com sucesso' };
  }

  async bulkRemove(ids: string[], user: AuthUser) {
    const uniqueIds = [...new Set(ids)];
    const deleted: string[] = [];
    const failed: Array<{ id: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        await this.deleteClientSafely(id, user);
        deleted.push(id);
      } catch (error) {
        failed.push({
          id,
          reason: this.errorMessage(error),
        });
      }
    }

    return { deleted, failed };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: string | string[] }).message;
        if (Array.isArray(message)) return message.join(', ');
        if (typeof message === 'string') return message;
      }
    }
    return error instanceof Error ? error.message : 'Falha ao excluir';
  }

  private async deleteClientSafely(id: string, user: AuthUser) {
    const client = await this.findOne(id, user);

    const [sales, taskRequests, clientDocuments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { clientId: id },
        include: {
          commission: { select: { status: true } },
          documents: { select: { url: true } },
        },
      }),
      this.prisma.request.count({ where: { clientId: id, taskDemandId: { not: null } } }),
      this.prisma.document.findMany({ where: { clientId: id }, select: { url: true } }),
    ]);

    const activated = sales.filter((sale) => sale.status === SaleStatus.ACTIVATED).length;
    if (activated > 0) {
      throw new BadRequestException(
        `Não é possível excluir: este cliente tem ${activated} venda(s) ativada(s).`,
      );
    }
    const linkedToTask = sales.filter(
      (sale) => sale.taskDemandId || sale.taskSyncStatus !== SaleTaskSyncStatus.NOT_READY,
    ).length;
    if (linkedToTask > 0 || taskRequests > 0) {
      throw new BadRequestException(
        'Não é possível excluir: este cliente tem vendas ou demandas vinculadas ao Luxus Task.',
      );
    }
    const paidSales = sales.filter((sale) => sale.commission?.status === CommissionStatus.PAID);
    if (paidSales.length > 0) {
      throw new BadRequestException(
        `Não é possível excluir: este cliente tem ${paidSales.length} venda(s) com comissão já paga.`,
      );
    }

    const saleIds = sales.map((sale) => sale.id);
    const storedFiles = [...clientDocuments, ...sales.flatMap((sale) => sale.documents)];

    await this.prisma.$transaction(async (tx) => {
      if (saleIds.length > 0) {
        await tx.commission.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.document.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
      }

      await tx.document.deleteMany({ where: { clientId: id } });
      await tx.line.updateMany({ where: { clientId: id }, data: { clientId: null } });
      await tx.request.updateMany({ where: { clientId: id }, data: { clientId: null } });
      await tx.client.delete({ where: { id } });
    });

    await this.removeOrphanFiles(storedFiles);

    await this.auditService.log({
      userId: user.id,
      action: 'DELETE',
      module: 'clients',
      entityId: id,
      entityType: 'Client',
      oldData: {
        name: client.name,
        document: client.document,
        removedSales: saleIds.length,
      },
    });
  }

  /** Apaga do volume só os arquivos que nenhum outro documento ainda referencia. */
  private async removeOrphanFiles(files: Array<{ url: string }>) {
    const urls = [...new Set(files.map((file) => file.url).filter(Boolean))];
    if (!urls.length) return;
    const stillReferenced = await this.prisma.document.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    });
    const referenced = new Set(stillReferenced.map((document) => document.url));
    this.uploadsService.removeStoredFiles(
      urls.filter((url) => !referenced.has(url)).map((url) => ({ url })),
    );
  }
}

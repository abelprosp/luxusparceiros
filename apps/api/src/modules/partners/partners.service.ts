import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CommissionStatus, PartnerStatus, Prisma, UserRole } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess } from '@/common/utils/partner-scope';
import {
  CreatePartnerDto,
  ResetPartnerPasswordDto,
  SetPartnerPlansDto,
  SuspendPartnerDto,
  UpdatePartnerDto,
} from './dto/partner.dto';

type PartnerAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

type PartnerCoordinates = {
  latitude: number;
  longitude: number;
};

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(user: AuthUser, params: { page: number; limit: number; search?: string; status?: PartnerStatus }) {
    const { page, limit, search, status } = params;
    const where: Prisma.PartnerWhereInput = {};
    if (user.partnerId) where.id = user.partnerId;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { document: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.partner.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: { select: { id: true, email: true, name: true, role: true } },
          _count: { select: { branches: true, partnerPlans: true, sales: true } },
        },
      }),
      this.prisma.partner.count({ where }),
    ]);

    return {
      data: await this.attachDocumentShareInfo(data),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, user?: AuthUser) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, email: true, name: true, role: true, isActive: true } },
        branches: { orderBy: { name: 'asc' } },
        partnerPlans: {
          include: {
            plan: {
              select: {
                id: true,
                name: true,
                price: true,
                commissionType: true,
                commissionValue: true,
                operator: { select: { id: true, name: true } },
              },
            },
          },
        },
        _count: { select: { users: true, clients: true, sales: true, branches: true } },
      },
    });
    if (!partner) throw new NotFoundException(MESSAGES.NOT_FOUND);
    if (user) assertPartnerAccess(user, partner.id);
    const [enriched] = await this.attachDocumentShareInfo([partner]);
    return enriched;
  }

  async findByDocument(document: string, excludeId?: string) {
    const cleaned = document.replace(/\D/g, '');
    if (!cleaned) return [];

    const partners = await this.prisma.partner.findMany({
      where: {
        OR: [
          { document: cleaned },
          { document: { contains: cleaned } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true, tradeName: true, document: true, status: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return partners.filter((partner) => partner.document.replace(/\D/g, '') === cleaned);
  }

  async create(dto: CreatePartnerDto, actor: AuthUser) {
    if (actor.partnerId) {
      throw new ForbiddenException('Administradores de parceiro não podem criar outros parceiros');
    }

    const { user: userDto, ...partnerData } = dto;
    const document = dto.document.replace(/\D/g, '');
    const coordinates = await this.geocodeAddress(partnerData);

    if (userDto) {
      const emailExists = await this.prisma.user.findUnique({ where: { email: userDto.email } });
      if (emailExists) throw new ConflictException('E-mail de usuário já cadastrado');
    }

    const partner = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: { ...partnerData, document, ...(coordinates ?? {}) },
      });

      if (userDto) {
        const hashedPassword = await bcrypt.hash(userDto.password, 10);
        await tx.user.create({
          data: {
            email: userDto.email,
            password: hashedPassword,
            name: userDto.name ?? dto.name,
            phone: dto.phone,
            role: UserRole.PARTNER,
            partnerId: created.id,
            isActive: true,
          },
        });
      }

      await this.linkPartnerToActivePlans(created.id, tx);

      return created;
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'CREATE',
      module: 'partners',
      entityId: partner.id,
      entityType: 'Partner',
      newData: partner as unknown as Prisma.InputJsonValue,
    });

    return this.findOne(partner.id);
  }

  async update(id: string, dto: UpdatePartnerDto, actor: AuthUser) {
    const existing = await this.findOne(id, actor);
    const { user: _user, ...partnerData } = dto;
    if (partnerData.document !== undefined) {
      partnerData.document = partnerData.document.replace(/\D/g, '');
    }
    const locationChanged = (['address', 'city', 'state', 'zipCode'] as const).some(
      (field) => partnerData[field] !== undefined && partnerData[field] !== existing[field],
    );
    const shouldGeocode =
      locationChanged ||
      ((!existing.latitude || !existing.longitude) &&
        Boolean(
          partnerData.address ?? existing.address ?? partnerData.city ?? existing.city,
        ));
    const coordinates = shouldGeocode
      ? await this.geocodeAddress({
          address: partnerData.address ?? existing.address,
          city: partnerData.city ?? existing.city,
          state: partnerData.state ?? existing.state,
          zipCode: partnerData.zipCode ?? existing.zipCode,
        })
      : undefined;
    const coordinateData = shouldGeocode
      ? coordinates ?? { latitude: null, longitude: null }
      : {};

    const partner = await this.prisma.partner.update({
      where: { id },
      data: { ...partnerData, ...coordinateData },
    });
    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: partner as unknown as Prisma.InputJsonValue,
    });
    return this.findOne(id);
  }

  private async attachDocumentShareInfo<T extends { id: string; document: string }>(partners: T[]) {
    if (!partners.length) return partners.map((partner) => ({ ...partner, documentSharedWith: [] as string[] }));

    const cleanedDocs = [...new Set(partners.map((partner) => partner.document.replace(/\D/g, '')).filter(Boolean))];
    if (!cleanedDocs.length) {
      return partners.map((partner) => ({ ...partner, documentSharedWith: [] as string[] }));
    }

    const siblings = await this.prisma.partner.findMany({
      where: {
        OR: cleanedDocs.flatMap((doc) => [
          { document: doc },
          { document: { contains: doc } },
        ]),
      },
      select: { id: true, name: true, document: true },
    });

    const byCleanDoc = new Map<string, { id: string; name: string }[]>();
    for (const sibling of siblings) {
      const cleaned = sibling.document.replace(/\D/g, '');
      if (!cleanedDocs.includes(cleaned)) continue;
      const list = byCleanDoc.get(cleaned) ?? [];
      list.push({ id: sibling.id, name: sibling.name });
      byCleanDoc.set(cleaned, list);
    }

    return partners.map((partner) => {
      const cleaned = partner.document.replace(/\D/g, '');
      const others = (byCleanDoc.get(cleaned) ?? [])
        .filter((item) => item.id !== partner.id)
        .map((item) => item.name);
      return { ...partner, documentSharedWith: others };
    });
  }

  private async geocodeAddress(address: PartnerAddress): Promise<PartnerCoordinates | null> {
    const query = [
      address.address,
      address.city,
      address.state,
      address.zipCode,
      'Brasil',
    ]
      .filter(Boolean)
      .join(', ');
    if (!address.city || !address.state || !query) return null;

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'br',
      q: query,
    });

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          'User-Agent': 'LuxusParceiros/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;

      const result = (await response.json()) as { lat?: string; lon?: string }[];
      const latitude = Number(result[0]?.lat);
      const longitude = Number(result[0]?.lon);
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -34 ||
        latitude > 6 ||
        longitude < -74 ||
        longitude > -32
      ) {
        return null;
      }
      return { latitude, longitude };
    } catch {
      return null;
    }
  }

  async resetPassword(id: string, dto: ResetPartnerPasswordDto, actor: AuthUser) {
    const partner = await this.findOne(id, actor);
    const user = partner.users.find((u) => u.role === UserRole.PARTNER);
    if (!user) throw new NotFoundException('Usuário parceiro não encontrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { action: 'password_reset', userId: user.id } as Prisma.InputJsonValue,
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  async getPartnerPlans(partnerId: string, user: AuthUser) {
    await this.findOne(partnerId, user);
    return this.prisma.partnerPlan.findMany({
      where: { partnerId },
      include: {
        plan: {
          include: { operator: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setPartnerPlans(partnerId: string, dto: SetPartnerPlansDto, actor: AuthUser) {
    await this.findOne(partnerId, actor);

    await this.prisma.$transaction(async (tx) => {
      await tx.partnerPlan.deleteMany({ where: { partnerId } });

      if (dto.plans.length > 0) {
        await tx.partnerPlan.createMany({
          data: dto.plans.map((p) => ({
            partnerId,
            planId: p.planId,
            isActive: p.isActive ?? true,
            customCommission: p.customCommission,
          })),
        });
      }
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'partners',
      entityId: partnerId,
      entityType: 'PartnerPlan',
      newData: { plans: dto.plans } as unknown as Prisma.InputJsonValue,
    });

    return this.getPartnerPlans(partnerId, actor);
  }

  async suspend(id: string, dto: SuspendPartnerDto, actor: AuthUser) {
    await this.findOne(id, actor);
    const partner = await this.prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: dto.reason,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { status: 'SUSPENDED', reason: dto.reason } as Prisma.InputJsonValue,
    });
    return partner;
  }

  async activate(id: string, actor: AuthUser) {
    await this.findOne(id, actor);
    const partner = await this.prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    await this.auditService.log({
      userId: actor.id,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { status: 'ACTIVE' } as Prisma.InputJsonValue,
    });
    return partner;
  }

  async remove(id: string, actor: AuthUser) {
    const partner = await this.findOne(id, actor);
    if (actor.partnerId && actor.partnerId === id) {
      throw new ForbiddenException('Você não pode excluir o próprio parceiro vinculado à conta');
    }

    const paidCommissions = await this.prisma.commission.count({
      where: { partnerId: id, status: CommissionStatus.PAID },
    });
    if (paidCommissions > 0) {
      throw new BadRequestException(
        'Não é possível excluir este parceiro: existem comissões já pagas vinculadas.',
      );
    }

    const userIds = (
      await this.prisma.user.findMany({
        where: { partnerId: id },
        select: { id: true },
      })
    ).map((user) => user.id);

    const saleIds = (
      await this.prisma.sale.findMany({
        where: { partnerId: id },
        select: { id: true },
      })
    ).map((sale) => sale.id);

    const requestIds = (
      await this.prisma.request.findMany({
        where: { partnerId: id },
        select: { id: true },
      })
    ).map((request) => request.id);

    const ticketIds = (
      await this.prisma.ticket.findMany({
        where: { partnerId: id },
        select: { id: true },
      })
    ).map((ticket) => ticket.id);

    const clientIds = (
      await this.prisma.client.findMany({
        where: { partnerId: id },
        select: { id: true },
      })
    ).map((client) => client.id);

    const branchIds = (
      await this.prisma.branch.findMany({
        where: { parentPartnerId: id },
        select: { id: true },
      })
    ).map((branch) => branch.id);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (saleIds.length) {
          await tx.commission.deleteMany({ where: { saleId: { in: saleIds } } });
          await tx.document.deleteMany({ where: { saleId: { in: saleIds } } });
          await tx.sale.deleteMany({ where: { id: { in: saleIds } } });
        }

        if (requestIds.length) {
          await tx.document.deleteMany({ where: { requestId: { in: requestIds } } });
          await tx.request.deleteMany({ where: { id: { in: requestIds } } });
        }

        if (ticketIds.length) {
          await tx.document.deleteMany({ where: { ticketId: { in: ticketIds } } });
          await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
        }

        if (clientIds.length) {
          await tx.document.deleteMany({ where: { clientId: { in: clientIds } } });
          await tx.client.deleteMany({ where: { id: { in: clientIds } } });
        }

        await tx.stockMovement.deleteMany({
          where: {
            OR: [
              { partnerId: id },
              ...(branchIds.length ? [{ branchId: { in: branchIds } }] : []),
              ...(userIds.length ? [{ userId: { in: userIds } }] : []),
            ],
          },
        });
        await tx.line.deleteMany({ where: { partnerId: id } });
        await tx.simCard.deleteMany({ where: { partnerId: id } });
        await tx.commissionRule.deleteMany({ where: { partnerId: id } });
        await tx.financialRecord.deleteMany({ where: { partnerId: id } });
        await tx.commission.deleteMany({ where: { partnerId: id } });

        if (userIds.length) {
          await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
          await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
          await tx.session.deleteMany({ where: { userId: { in: userIds } } });
          await tx.userPermission.deleteMany({ where: { userId: { in: userIds } } });
          await tx.auditLog.updateMany({
            where: { userId: { in: userIds } },
            data: { userId: null },
          });
          await tx.user.deleteMany({ where: { id: { in: userIds } } });
        }

        await tx.partner.delete({ where: { id } });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/Foreign key|P2003|constraint/i.test(message)) {
        throw new BadRequestException(
          'Não foi possível excluir o parceiro: ainda há registros vinculados. Remova vendas, usuários ou estoque relacionados e tente novamente.',
        );
      }
      throw error;
    }

    await this.auditService.log({
      userId: actor.id,
      action: 'DELETE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      oldData: {
        name: partner.name,
        document: partner.document,
        sales: saleIds.length,
        users: userIds.length,
      } as Prisma.InputJsonValue,
    });
    return { message: 'Parceiro removido com sucesso' };
  }

  private async linkPartnerToActivePlans(
    partnerId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const plans = await tx.plan.findMany({
      where: { status: true },
      select: { id: true },
    });
    if (!plans.length) return;
    await tx.partnerPlan.createMany({
      data: plans.map((plan) => ({
        partnerId,
        planId: plan.id,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }
}

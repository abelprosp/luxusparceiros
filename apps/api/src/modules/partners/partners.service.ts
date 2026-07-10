import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PartnerStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
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

  async findAll(params: { page: number; limit: number; search?: string; status?: PartnerStatus }) {
    const { page, limit, search, status } = params;
    const where: Prisma.PartnerWhereInput = {};
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

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
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
    return partner;
  }

  async create(dto: CreatePartnerDto, actorId?: string) {
    const exists = await this.prisma.partner.findUnique({ where: { document: dto.document } });
    if (exists) throw new ConflictException(MESSAGES.DOCUMENT_EXISTS);

    const { user: userDto, ...partnerData } = dto;
    const coordinates = await this.geocodeAddress(partnerData);

    if (userDto) {
      const emailExists = await this.prisma.user.findUnique({ where: { email: userDto.email } });
      if (emailExists) throw new ConflictException('E-mail de usuário já cadastrado');
    }

    const partner = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: { ...partnerData, ...(coordinates ?? {}) },
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
      userId: actorId,
      action: 'CREATE',
      module: 'partners',
      entityId: partner.id,
      entityType: 'Partner',
      newData: partner as unknown as Prisma.InputJsonValue,
    });

    return this.findOne(partner.id);
  }

  async update(id: string, dto: UpdatePartnerDto, actorId?: string) {
    const existing = await this.findOne(id);
    const { user: _user, ...partnerData } = dto;
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
      userId: actorId,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: partner as unknown as Prisma.InputJsonValue,
    });
    return this.findOne(id);
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

  async resetPassword(id: string, dto: ResetPartnerPasswordDto, actorId?: string) {
    const partner = await this.findOne(id);
    const user = partner.users.find((u) => u.role === UserRole.PARTNER);
    if (!user) throw new NotFoundException('Usuário parceiro não encontrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { action: 'password_reset', userId: user.id } as Prisma.InputJsonValue,
    });

    return { message: 'Senha redefinida com sucesso' };
  }

  async getPartnerPlans(partnerId: string) {
    await this.findOne(partnerId);
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

  async setPartnerPlans(partnerId: string, dto: SetPartnerPlansDto, actorId?: string) {
    await this.findOne(partnerId);

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
      userId: actorId,
      action: 'UPDATE',
      module: 'partners',
      entityId: partnerId,
      entityType: 'PartnerPlan',
      newData: { plans: dto.plans } as unknown as Prisma.InputJsonValue,
    });

    return this.getPartnerPlans(partnerId);
  }

  async suspend(id: string, dto: SuspendPartnerDto, actorId?: string) {
    await this.findOne(id);
    const partner = await this.prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: dto.reason,
      },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { status: 'SUSPENDED', reason: dto.reason } as Prisma.InputJsonValue,
    });
    return partner;
  }

  async activate(id: string, actorId?: string) {
    await this.findOne(id);
    const partner = await this.prisma.partner.update({
      where: { id },
      data: {
        status: PartnerStatus.ACTIVE,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
      newData: { status: 'ACTIVE' } as Prisma.InputJsonValue,
    });
    return partner;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.partner.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DELETE',
      module: 'partners',
      entityId: id,
      entityType: 'Partner',
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

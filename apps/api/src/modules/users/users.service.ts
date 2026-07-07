import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { MESSAGES } from '@/common/constants/messages';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

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

  async findOne(id: string) {
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
    return user;
  }

  async create(dto: CreateUserDto, actorId?: string) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (exists) throw new ConflictException(MESSAGES.EMAIL_EXISTS);

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashed,
        name: dto.name,
        phone: dto.phone,
        role: dto.role,
        partnerId: dto.partnerId,
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
      userId: actorId,
      action: 'CREATE',
      module: 'users',
      entityId: user.id,
      entityType: 'User',
      newData: user as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    await this.findOne(id);
    const { password, email, ...rest } = dto;
    const data: Prisma.UserUpdateInput = { ...rest };
    if (email) data.email = email.toLowerCase();
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.update({
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

    await this.auditService.log({
      userId: actorId,
      action: 'UPDATE',
      module: 'users',
      entityId: id,
      entityType: 'User',
      newData: user as unknown as Prisma.InputJsonValue,
    });

    return user;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DELETE',
      module: 'users',
      entityId: id,
      entityType: 'User',
    });
    return { message: 'Usuário removido com sucesso' };
  }
}

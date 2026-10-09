import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BranchStatus,
  DocumentType,
  LineStatus,
  PartnerStatus,
  Prisma,
  SaleContractStage,
  SaleReviewStatus,
  SaleStatus,
  SaleTaskSyncStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { calculatePlanCommission, generateProtocol } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { getRequiredDocumentsForSale } from '@/modules/sales/sale-documents.constants';
import { ImportHistoricalSaleDto, RehomeHistoricalSaleDto } from './dto/import-historical-sale.dto';
import { branchDisplayName, classifyHistoricalAttachment, onlyDigits } from './historical-sale.util';

/**
 * Copia uma demanda que já existe no Luxus Task para o Parceiros.
 * Não cria demanda, não envia anexo e não altera status no Task.
 */
@Injectable()
export class HistoricalSalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async importOne(dto: ImportHistoricalSaleDto) {
    const lineNumber = onlyDigits(dto.lineNumber);
    if (lineNumber.length < 10 || lineNumber.length > 13) {
      throw new BadRequestException('Número da linha inválido');
    }
    const soldAt = new Date(dto.soldAt);
    const activatedAt = dto.activatedAt ? new Date(dto.activatedAt) : soldAt;
    const concluded = this.isConcluded(dto.taskStatus);
    if (Number.isNaN(soldAt.getTime()) || Number.isNaN(activatedAt.getTime())) {
      throw new BadRequestException('Data da venda inválida');
    }

    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (!admin) throw new BadRequestException('Não há administrador ativo para registrar a venda');

    const existing = await this.prisma.sale.findFirst({
      where: {
        OR: [{ taskProtocol: dto.taskProtocol }, { taskDemandId: dto.taskDemandId }],
      },
      select: { id: true, protocol: true, partnerId: true, clientId: true },
    });

    let partnerCreated = false;
    let branchCreated = false;
    let clientCreated = false;
    let temporaryPassword: string | undefined;
    let saleId = existing?.id;
    let protocol = existing?.protocol;
    let partnerId = existing?.partnerId;
    let clientId = existing?.clientId;
    let branchName: string | undefined;

    if (!existing) {
      const prepared = await this.prepareRecords(dto, admin.id, lineNumber, soldAt, activatedAt, concluded);
      partnerCreated = prepared.partnerCreated;
      branchCreated = prepared.branchCreated;
      clientCreated = prepared.clientCreated;
      temporaryPassword = prepared.temporaryPassword;
      saleId = prepared.saleId;
      protocol = prepared.protocol;
      partnerId = prepared.partnerId;
      clientId = prepared.clientId;
      branchName = prepared.branchName;
    }

    if (!saleId || !protocol || !partnerId || !clientId) {
      throw new BadRequestException('Não foi possível preparar a venda histórica');
    }

    const attachmentsAdded = await this.storeAttachments(
      dto,
      saleId,
      clientId,
      admin.id,
      soldAt,
    );
    await this.alignDatesWithTask(saleId, clientId, soldAt, activatedAt, concluded, dto.taskResponsibleName);

    await this.audit.log({
      userId: admin.id,
      action: 'CREATE',
      module: 'sales',
      entityId: saleId,
      entityType: 'Sale',
      newData: {
        historical: true,
        taskProtocol: dto.taskProtocol,
        created: !existing,
        partnerCreated,
        branchCreated,
        clientCreated,
        attachmentsAdded,
      },
    });

    return {
      created: !existing,
      saleId,
      protocol,
      partnerId,
      partnerCreated,
      branchCreated,
      branchName,
      clientCreated,
      attachmentsAdded,
      temporaryPassword,
    };
  }

  /**
   * Tira a venda do parceiro errado e entrega para a empresa do título da demanda.
   * Não escreve no Luxus Task.
   */
  async rehome(dto: RehomeHistoricalSaleDto) {
    const sale = await this.prisma.sale.findFirst({
      where: { taskProtocol: dto.taskProtocol },
      select: {
        id: true,
        protocol: true,
        partnerId: true,
        branchId: true,
        clientId: true,
        lineId: true,
        simCardId: true,
        notes: true,
      },
    });
    if (!sale) throw new NotFoundException('Venda histórica não encontrada para essa demanda');

    const admin = await this.prisma.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!admin) throw new BadRequestException('Não há administrador ativo para registrar a correção');

    const partnerResult = await this.findOrCreatePartner({
      partner: dto.partner,
    } as ImportHistoricalSaleDto);
    const branchResult = await this.findOrCreateBranch(
      partnerResult.partner.id,
      dto.branchName,
      partnerResult.partner,
    );

    const note = dto.note?.trim();
    const notes = !note || sale.notes?.includes(note)
      ? sale.notes
      : [sale.notes?.trim(), note].filter(Boolean).join('\n');
    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          partnerId: partnerResult.partner.id,
          branchId: branchResult.branch.id,
          ...(notes ? { notes } : {}),
        },
      });
      await tx.client.update({
        where: { id: sale.clientId },
        data: { partnerId: partnerResult.partner.id, branchId: branchResult.branch.id },
      });
      if (sale.lineId) {
        await tx.line.update({
          where: { id: sale.lineId },
          data: { partnerId: partnerResult.partner.id },
        });
      }
      if (sale.simCardId) {
        await tx.simCard.update({
          where: { id: sale.simCardId },
          data: { partnerId: partnerResult.partner.id },
        });
      }
      await tx.commission.updateMany({
        where: { saleId: sale.id },
        data: { partnerId: partnerResult.partner.id },
      });
    });

    if (sale.branchId && sale.branchId !== branchResult.branch.id) {
      const [remainingSales, branchUsers, remainingClients] = await Promise.all([
        this.prisma.sale.count({ where: { branchId: sale.branchId } }),
        this.prisma.user.count({ where: { branchId: sale.branchId } }),
        this.prisma.client.count({ where: { branchId: sale.branchId } }),
      ]);
      if (remainingSales === 0 && branchUsers === 0 && remainingClients === 0) {
        await this.prisma.branch.delete({ where: { id: sale.branchId } });
      }
    }

    await this.audit.log({
      userId: admin.id,
      action: 'UPDATE',
      module: 'sales',
      entityId: sale.id,
      entityType: 'Sale',
      newData: {
        historicalRehome: true,
        taskProtocol: dto.taskProtocol,
        fromPartnerId: sale.partnerId,
        toPartnerId: partnerResult.partner.id,
        partnerCreated: partnerResult.created,
      },
    });

    return {
      saleId: sale.id,
      protocol: sale.protocol,
      partnerId: partnerResult.partner.id,
      partnerName: partnerResult.partner.name,
      partnerCreated: partnerResult.created,
      branchName: branchResult.branch.name,
      temporaryPassword: partnerResult.temporaryPassword,
    };
  }

  private async prepareRecords(
    dto: ImportHistoricalSaleDto,
    adminId: string,
    lineNumber: string,
    soldAt: Date,
    activatedAt: Date,
    concluded: boolean,
  ) {
    const plan = await this.findPlan(dto.planName, dto.operatorName);
    const partnerResult = await this.findOrCreatePartner(dto);
    const branchResult = await this.findOrCreateBranch(partnerResult.partner.id, dto.branchName, partnerResult.partner);
    const clientResult = await this.findOrCreateClient(partnerResult.partner.id, branchResult.branch.id, dto);
    await this.assertLineAvailable(lineNumber, partnerResult.partner.id);

    const partnerPlan = await this.prisma.partnerPlan.findUnique({
      where: { partnerId_planId: { partnerId: partnerResult.partner.id, planId: plan.id } },
    });
    const commissionType = plan.commissionType;
    let commissionValue = Number(plan.commissionValue ?? plan.commission);
    if (partnerPlan?.customCommission != null) {
      commissionValue = Number(partnerPlan.customCommission);
    }
    const amount = calculatePlanCommission(dto.value, commissionType, commissionValue);
    const commissionRate = commissionType === 'PERCENTAGE' ? commissionValue : 0;
    const requiredDocuments = getRequiredDocumentsForSale();

    const created = await this.prisma.$transaction(async (tx) => {
      const line = await tx.line.upsert({
        where: { number: lineNumber },
        update: {
          operatorId: plan.operatorId,
          planId: plan.id,
          partnerId: partnerResult.partner.id,
          clientId: clientResult.client.id,
          ...(concluded ? { status: LineStatus.ACTIVATED, activatedAt } : {}),
        },
        create: {
          number: lineNumber,
          operatorId: plan.operatorId,
          planId: plan.id,
          partnerId: partnerResult.partner.id,
          clientId: clientResult.client.id,
          status: concluded ? LineStatus.ACTIVATED : LineStatus.RESERVED,
          activatedAt: concluded ? activatedAt : null,
          createdAt: soldAt,
        },
      });

      const sale = await tx.sale.create({
        data: {
          protocol: generateProtocol('VND'),
          partnerId: partnerResult.partner.id,
          branchId: branchResult.branch.id,
          clientId: clientResult.client.id,
          operatorId: plan.operatorId,
          planId: plan.id,
          lineId: line.id,
          createdById: adminId,
          status: concluded ? SaleStatus.ACTIVATED : SaleStatus.IN_ANALYSIS,
          reviewStatus: SaleReviewStatus.APPROVED,
          submittedAt: soldAt,
          reviewedAt: concluded ? activatedAt : soldAt,
          reviewedById: adminId,
          taskDemandId: dto.taskDemandId,
          taskProtocol: dto.taskProtocol,
          taskStatus: concluded ? 'concluido' : (dto.taskStatus || 'em_andamento'),
          taskResponsibleName: dto.taskResponsibleName?.trim() || null,
          taskSyncStatus: SaleTaskSyncStatus.SYNCED,
          taskLastSyncAt: new Date(),
          taskSyncError: null,
          contractStage: concluded ? SaleContractStage.COMPLETED : SaleContractStage.TASK_PROCESSING,
          contractStageUpdatedAt: concluded ? activatedAt : soldAt,
          signedContractSyncStatus: SaleTaskSyncStatus.NOT_READY,
          value: dto.value,
          commissionRate,
          commissionValue: amount,
          isVirginChip: false,
          isUpgrade: Boolean(dto.isUpgrade),
          newNumber: lineNumber,
          notes: [
            `Cópia histórica da demanda ${dto.taskProtocol}. A demanda permanece como está no Luxus Task e não foi reaberta.`,
            dto.extraNote?.trim(),
          ].filter(Boolean).join('\n'),
          requiredDocuments: requiredDocuments as unknown as Prisma.InputJsonValue,
          approvedAt: concluded ? activatedAt : soldAt,
          activatedAt: concluded ? activatedAt : null,
          createdAt: soldAt,
          timeline: {
            create: {
              actorId: adminId,
              actorName: 'Importação histórica',
              action: `Venda copiada do Luxus Task (${dto.taskProtocol}) sem reabrir a demanda`,
              toReviewStatus: SaleReviewStatus.APPROVED,
              details: 'Cadastro somente no Luxus Parceiros. Nenhum dado foi enviado de volta ao Luxus Task.',
              createdAt: soldAt,
            },
          },
        },
      });
      return sale;
    });

    return {
      saleId: created.id,
      protocol: created.protocol,
      partnerId: partnerResult.partner.id,
      clientId: clientResult.client.id,
      partnerCreated: partnerResult.created,
      branchCreated: branchResult.created,
      branchName: branchResult.branch.name,
      clientCreated: clientResult.created,
      temporaryPassword: partnerResult.temporaryPassword,
    };
  }

  private async findPlan(planName: string, operatorName: string) {
    const plans = await this.prisma.plan.findMany({
      where: {
        status: true,
        name: { equals: planName.trim(), mode: 'insensitive' },
        operator: { name: { contains: operatorName.trim(), mode: 'insensitive' } },
      },
      select: {
        id: true,
        operatorId: true,
        commissionType: true,
        commission: true,
        commissionValue: true,
      },
    });
    if (plans.length !== 1) {
      throw new ConflictException(
        plans.length
          ? 'Há mais de um plano com esse nome para a operadora'
          : 'Plano não encontrado para esta operadora',
      );
    }
    return plans[0];
  }

  private async findOrCreatePartner(dto: ImportHistoricalSaleDto) {
    const document = onlyDigits(dto.partner.document);
    const partners = await this.prisma.partner.findMany({
      select: { id: true, name: true, document: true, email: true, phone: true },
    });
    const byDocument = partners.filter((partner) => onlyDigits(partner.document) === document);
    if (byDocument.length > 1) {
      throw new ConflictException('Há mais de um parceiro com esse documento');
    }
    if (byDocument.length === 1) {
      return { partner: byDocument[0], created: false as const, temporaryPassword: undefined };
    }

    const target = dto.partner.name.trim().toLocaleLowerCase('pt-BR');
    const byName = partners.filter((partner) => {
      const current = partner.name.trim().toLocaleLowerCase('pt-BR');
      return current === target || current.includes(target);
    });
    if (byName.length > 1) throw new ConflictException('Há mais de um parceiro com esse nome');
    if (byName.length === 1) {
      return { partner: byName[0], created: false as const, temporaryPassword: undefined };
    }

    const email = dto.partner.email?.trim().toLowerCase();
    const phone = onlyDigits(dto.partner.phone);
    if (!email || phone.length < 8) {
      throw new BadRequestException('E-mail e telefone são obrigatórios para cadastrar um parceiro novo');
    }
    const emailTaken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) throw new ConflictException('E-mail do parceiro já pertence a outro usuário');

    const temporaryPassword = randomBytes(9).toString('base64url');
    const partner = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partner.create({
        data: {
          name: dto.partner.name.trim(),
          document,
          documentType: document.length > 11 ? DocumentType.CNPJ : DocumentType.CPF,
          email,
          phone,
          status: PartnerStatus.ACTIVE,
          notes: 'Parceiro criado na importação histórica. A demanda do Luxus Task não foi alterada.',
        },
        select: { id: true, name: true, document: true, email: true, phone: true },
      });
      await tx.user.create({
        data: {
          email,
          password: await bcrypt.hash(temporaryPassword, 10),
          name: dto.partner.name.trim(),
          phone,
          role: UserRole.PARTNER,
          partnerId: created.id,
          isActive: true,
        },
      });
      const activePlans = await tx.plan.findMany({ where: { status: true }, select: { id: true } });
      if (activePlans.length) {
        await tx.partnerPlan.createMany({
          data: activePlans.map((item) => ({ partnerId: created.id, planId: item.id, isActive: true })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    return { partner, created: true as const, temporaryPassword };
  }

  private async findOrCreateBranch(
    partnerId: string,
    filialName: string,
    partner: { document: string; email: string; phone: string },
  ) {
    const branches = await this.prisma.branch.findMany({
      where: { parentPartnerId: partnerId },
      select: { id: true, name: true, document: true },
    });
    const needle = filialName.trim().toLocaleLowerCase('pt-BR');
    const matches = branches.filter((branch) => branch.name.toLocaleLowerCase('pt-BR').includes(needle));
    if (matches.length > 1) throw new ConflictException('Há mais de uma filial com esse nome');
    if (matches.length === 1) return { branch: matches[0], created: false as const };

    const documentDigits = onlyDigits(partner.document);
    const documentTaken = branches.some((branch) => onlyDigits(branch.document) === documentDigits);
    const branch = await this.prisma.branch.create({
      data: {
        name: branchDisplayName(branches.map((item) => item.name), filialName),
        document: documentTaken ? `${documentDigits}-${needle.toUpperCase()}` : documentDigits,
        phone: partner.phone,
        email: partner.email,
        status: BranchStatus.ACTIVE,
        parentPartnerId: partnerId,
      },
      select: { id: true, name: true, document: true },
    });
    return { branch, created: true as const };
  }

  private async findOrCreateClient(partnerId: string, branchId: string, dto: ImportHistoricalSaleDto) {
    const document = onlyDigits(dto.client.document);
    const candidates = await this.prisma.client.findMany({
      where: { partnerId },
      select: { id: true, document: true },
    });
    const existing = candidates.find((client) => onlyDigits(client.document) === document);
    if (existing) return { client: existing, created: false as const };

    const client = await this.prisma.client.create({
      data: {
        name: dto.client.name.trim(),
        document,
        documentType: DocumentType.CPF,
        rg: dto.client.rg?.trim() || null,
        email: dto.client.email?.trim() || null,
        phone: onlyDigits(dto.client.phone).length >= 8 ? onlyDigits(dto.client.phone) : 'sem telefone',
        address: dto.client.address?.trim() || null,
        partnerId,
        branchId,
        createdAt: new Date(dto.soldAt),
      },
      select: { id: true, document: true },
    });
    return { client, created: true as const };
  }

  private async assertLineAvailable(lineNumber: string, partnerId: string) {
    const line = await this.prisma.line.findUnique({
      where: { number: lineNumber },
      select: { partnerId: true },
    });
    if (line?.partnerId && line.partnerId !== partnerId) {
      throw new ConflictException('Essa linha já está com outro parceiro');
    }
    const sale = await this.prisma.sale.findFirst({
      where: { newNumber: lineNumber, status: { notIn: [SaleStatus.CANCELLED, SaleStatus.REJECTED] } },
      select: { protocol: true },
    });
    if (sale) throw new ConflictException(`Já existe venda para essa linha (${sale.protocol})`);
  }

  private isConcluded(status?: string) {
    const value = (status || 'concluido').trim().toLowerCase();
    return value === 'concluido' || value === 'concluída' || value === 'completed' || value === 'finalizado';
  }

  private async alignDatesWithTask(
    saleId: string,
    clientId: string,
    soldAt: Date,
    activatedAt: Date,
    concluded: boolean,
    responsibleName?: string,
  ) {
    const sale = await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        createdAt: soldAt,
        submittedAt: soldAt,
        reviewedAt: concluded ? activatedAt : soldAt,
        approvedAt: concluded ? activatedAt : soldAt,
        activatedAt: concluded ? activatedAt : null,
        status: concluded ? SaleStatus.ACTIVATED : SaleStatus.IN_ANALYSIS,
        contractStage: concluded ? SaleContractStage.COMPLETED : SaleContractStage.TASK_PROCESSING,
        contractStageUpdatedAt: concluded ? activatedAt : soldAt,
        taskStatus: concluded ? 'concluido' : 'em_andamento',
        ...(responsibleName?.trim() ? { taskResponsibleName: responsibleName.trim() } : {}),
      },
      select: { lineId: true },
    });
    await this.prisma.saleTimeline.updateMany({
      where: { saleId, actorName: 'Importação histórica' },
      data: { createdAt: soldAt },
    });
    await this.prisma.document.updateMany({
      where: { saleId },
      data: { createdAt: soldAt },
    });
    await this.prisma.client.updateMany({
      where: { id: clientId, createdAt: { gt: soldAt } },
      data: { createdAt: soldAt },
    });
    if (sale.lineId) {
      await this.prisma.line.updateMany({
        where: { id: sale.lineId, createdAt: { gt: soldAt } },
        data: concluded ? { createdAt: soldAt, activatedAt } : { createdAt: soldAt },
      });
    }
  }

  private async storeAttachments(
    dto: ImportHistoricalSaleDto,
    saleId: string,
    clientId: string,
    uploadedBy: string,
    soldAt: Date,
  ) {
    const uploadDir =
      this.config.get<string>('UPLOAD_DIR')
      || this.config.get<string>('RAILWAY_VOLUME_MOUNT_PATH')
      || './uploads';
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
    if (!dto.attachments.length) return 0;

    let added = 0;
    const fulfilled = new Set<DocumentType>();
    for (const attachment of dto.attachments) {
      const externalId = `task:${dto.taskDemandId}:${attachment.taskAttachmentId}`;
      const already = await this.prisma.document.findUnique({ where: { externalId }, select: { id: true, type: true } });
      const classified = classifyHistoricalAttachment(attachment.name);
      if (already) {
        fulfilled.add(already.type);
        continue;
      }
      const buffer = Buffer.from(attachment.contentBase64, 'base64');
      if (!buffer.length) throw new BadRequestException(`Anexo vazio: ${attachment.name}`);
      const extension = extname(attachment.name) || (attachment.mimeType === 'image/jpeg' ? '.jpg' : '');
      const filename = `${randomUUID()}${extension}`;
      writeFileSync(join(uploadDir, filename), buffer);
      await this.prisma.document.create({
        data: {
          name: attachment.name,
          type: classified.type,
          purpose: classified.purpose,
          externalId,
          url: `/uploads/${filename}`,
          mimeType: attachment.mimeType,
          size: buffer.length,
          clientId,
          saleId,
          uploadedBy,
          createdAt: soldAt,
        },
      });
      fulfilled.add(classified.type);
      added += 1;
    }

    const requiredDocuments = getRequiredDocumentsForSale().map((document) => ({
      ...document,
      fulfilled: fulfilled.has(document.type),
    }));
    await this.prisma.sale.update({
      where: { id: saleId },
      data: { requiredDocuments: requiredDocuments as unknown as Prisma.InputJsonValue },
    });
    return added;
  }
}

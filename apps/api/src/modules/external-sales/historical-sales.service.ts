import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
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
import { ImportHistoricalSaleDto } from './dto/import-historical-sale.dto';
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
      const prepared = await this.prepareRecords(dto, admin.id, lineNumber, soldAt, activatedAt);
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
    );

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

  private async prepareRecords(
    dto: ImportHistoricalSaleDto,
    adminId: string,
    lineNumber: string,
    soldAt: Date,
    activatedAt: Date,
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
          status: LineStatus.ACTIVATED,
          activatedAt,
        },
        create: {
          number: lineNumber,
          operatorId: plan.operatorId,
          planId: plan.id,
          partnerId: partnerResult.partner.id,
          clientId: clientResult.client.id,
          status: LineStatus.ACTIVATED,
          activatedAt,
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
          status: SaleStatus.ACTIVATED,
          reviewStatus: SaleReviewStatus.APPROVED,
          submittedAt: soldAt,
          reviewedAt: activatedAt,
          reviewedById: adminId,
          taskDemandId: dto.taskDemandId,
          taskProtocol: dto.taskProtocol,
          taskStatus: 'concluido',
          taskSyncStatus: SaleTaskSyncStatus.SYNCED,
          taskLastSyncAt: new Date(),
          taskSyncError: null,
          contractStage: SaleContractStage.COMPLETED,
          contractStageUpdatedAt: activatedAt,
          signedContractSyncStatus: SaleTaskSyncStatus.NOT_READY,
          value: dto.value,
          commissionRate,
          commissionValue: amount,
          isVirginChip: false,
          newNumber: lineNumber,
          notes: `Cópia histórica da demanda ${dto.taskProtocol}. A demanda permanece como está no Luxus Task e não foi reaberta.`,
          requiredDocuments: requiredDocuments as unknown as Prisma.InputJsonValue,
          approvedAt: activatedAt,
          activatedAt,
          createdAt: soldAt,
          timeline: {
            create: {
              actorId: adminId,
              actorName: 'Importação histórica',
              action: `Venda copiada do Luxus Task (${dto.taskProtocol}) sem reabrir a demanda`,
              toReviewStatus: SaleReviewStatus.APPROVED,
              details: 'Cadastro somente no Luxus Parceiros. Nenhum dado foi enviado de volta ao Luxus Task.',
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
        phone: onlyDigits(dto.client.phone),
        address: dto.client.address?.trim() || null,
        partnerId,
        branchId,
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

  private async storeAttachments(
    dto: ImportHistoricalSaleDto,
    saleId: string,
    clientId: string,
    uploadedBy: string,
  ) {
    const uploadDir =
      this.config.get<string>('UPLOAD_DIR')
      || this.config.get<string>('RAILWAY_VOLUME_MOUNT_PATH')
      || './uploads';
    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

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

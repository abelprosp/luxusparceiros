import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  LineStatus,
  Prisma,
  SaleContractStage,
  SaleReviewStatus,
  SaleStatus,
  SaleTaskSyncStatus,
} from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { generateProtocol } from '@luxus/utils';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { CommissionsService } from '@/modules/commissions/commissions.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { isAdminRole, resolvePartnerId } from '@/common/utils/partner-scope';
import { resolveBranchId } from '@/common/utils/branch-scope';
import { SalesService } from './sales.service';
import { getRequiredDocumentsForSale } from './sale-documents.constants';
import { ImportSalesDto } from './dto/import-sales.dto';
import { SalesImportMode, SalesImportRow, normalizeImportRow, text } from './sales-import.parse';

export interface SalesImportRowResult {
  row: number;
  ok: boolean;
  protocol?: string;
  saleId?: string;
  client?: string;
  error?: string;
}

type PartnerRef = { id: string; name: string; tradeName: string | null; document: string };
type NamedRef = { id: string; name: string };
type PlanRef = { id: string; name: string; operatorId: string };

const IMPORT_ACTOR = 'Importação por planilha';
const ACTIVE_SALE: Prisma.SaleWhereInput = {
  status: { notIn: [SaleStatus.CANCELLED, SaleStatus.REJECTED] },
  reviewStatus: { notIn: [SaleReviewStatus.CANCELLED, SaleReviewStatus.REJECTED] },
};

function key(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function formattedDocument(document: string): string {
  if (document.length === 11) return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (document.length === 14) return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return document;
}

function errorMessage(error: unknown): string {
  if (error instanceof BadRequestException || error instanceof ForbiddenException) {
    const response = error.getResponse() as { message?: string | string[] } | string;
    if (typeof response === 'string') return response;
    return Array.isArray(response.message) ? response.message.join('; ') : response.message || error.message;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'Registro duplicado (linha, ICCID ou protocolo já cadastrado)';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Erro inesperado ao importar a linha';
}

@Injectable()
export class SalesImportService {
  constructor(
    private prisma: PrismaService,
    private salesService: SalesService,
    private commissionsService: CommissionsService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  async import(dto: ImportSalesDto, user: AuthUser) {
    const mode: SalesImportMode = dto.mode;
    if (mode === 'concluded' && !isAdminRole(user.role)) {
      throw new ForbiddenException('Somente o administrador importa vendas já concluídas no Luxus Task');
    }

    const [partners, operators, plans] = await Promise.all([
      user.partnerId
        ? Promise.resolve([] as PartnerRef[])
        : this.prisma.partner.findMany({ select: { id: true, name: true, tradeName: true, document: true } }),
      this.prisma.operator.findMany({ where: { status: true }, select: { id: true, name: true } }),
      this.prisma.plan.findMany({ where: { status: true }, select: { id: true, name: true, operatorId: true } }),
    ]);
    const branchCache = new Map<string, NamedRef[]>();
    const seenLines = new Set<string>();
    const seenProtocols = new Set<string>();
    const results: SalesImportRowResult[] = [];

    for (const raw of dto.rows) {
      const rowNumber = Number(raw.row) || results.length + 2;
      const clientLabel = text(raw.clientName) || undefined;
      const { value, errors } = normalizeImportRow(raw, mode);
      if (!value) {
        results.push({ row: rowNumber, ok: false, client: clientLabel, error: errors.join('; ') });
        continue;
      }
      try {
        if (seenLines.has(value.lineNumber)) {
          throw new BadRequestException('Esta linha aparece mais de uma vez na planilha');
        }
        if (value.taskProtocol && seenProtocols.has(value.taskProtocol)) {
          throw new BadRequestException('Este protocolo do Luxus Task aparece mais de uma vez na planilha');
        }
        seenLines.add(value.lineNumber);
        if (value.taskProtocol) seenProtocols.add(value.taskProtocol);

        const partnerId = this.resolvePartner(value, partners, user);
        const branchId = await this.resolveBranch(value, partnerId, user, branchCache);
        const operator = this.findByName(operators, value.operator, 'Operadora');
        const plan = this.findByName(
          plans.filter((item) => item.operatorId === operator.id),
          value.plan,
          `Plano da operadora ${operator.name}`,
        );
        await this.assertLineFree(value);

        const created = mode === 'concluded'
          ? await this.createConcluded(value, partnerId, branchId, operator.id, plan, user)
          : await this.createForReview(value, partnerId, branchId, operator.id, plan, user);
        results.push({ row: rowNumber, ok: true, client: value.clientName, ...created });
      } catch (error) {
        results.push({ row: rowNumber, ok: false, client: value.clientName, error: errorMessage(error) });
      }
    }

    const created = results.filter((result) => result.ok).length;
    await this.auditService.log({
      userId: user.id,
      action: 'CREATE',
      module: 'sales',
      entityType: 'SalesImport',
      newData: { mode, total: results.length, created, failed: results.length - created },
    });
    if (mode === 'new' && created > 0) {
      await this.notificationsService.createForAdminUsers({
        type: 'SYSTEM',
        title: 'Vendas importadas para analisar',
        message: `${created} venda(s) importada(s) por planilha por ${user.name}. Os anexos ainda precisam ser conferidos.`,
        data: { path: '/vendas' },
      });
    }

    return { mode, total: results.length, created, failed: results.length - created, results };
  }

  private resolvePartner(row: SalesImportRow, partners: PartnerRef[], user: AuthUser): string {
    if (user.partnerId) return resolvePartnerId(user)!;
    if (!row.partner) throw new BadRequestException('Informe o parceiro');
    const wanted = key(row.partner);
    const wantedDigits = row.partner.replace(/\D/g, '');
    const matches = partners.filter((partner) =>
      key(partner.name) === wanted
      || key(partner.tradeName) === wanted
      || (wantedDigits.length >= 11 && partner.document.replace(/\D/g, '') === wantedDigits),
    );
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) throw new BadRequestException(`Mais de um parceiro com o nome "${row.partner}". Use o CNPJ.`);
    throw new BadRequestException(`Parceiro "${row.partner}" não encontrado`);
  }

  private async resolveBranch(
    row: SalesImportRow,
    partnerId: string,
    user: AuthUser,
    cache: Map<string, NamedRef[]>,
  ): Promise<string | undefined> {
    if (user.branchId) return resolveBranchId(user);
    const wanted = key(row.branch);
    if (!wanted || wanted === 'matriz') return undefined;
    if (!cache.has(partnerId)) {
      cache.set(partnerId, await this.prisma.branch.findMany({
        where: { parentPartnerId: partnerId },
        select: { id: true, name: true },
      }));
    }
    const matches = cache.get(partnerId)!.filter((branch) => key(branch.name) === wanted);
    if (matches.length === 1) return matches[0].id;
    if (matches.length > 1) throw new BadRequestException(`Mais de uma loja com o nome "${row.branch}"`);
    throw new BadRequestException(`Loja "${row.branch}" não encontrada neste parceiro (deixe em branco para Matriz)`);
  }

  private findByName<T extends NamedRef>(items: T[], name: string, label: string): T {
    const wanted = key(name);
    const exact = items.filter((item) => key(item.name) === wanted);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) throw new BadRequestException(`${label} "${name}" está duplicado no cadastro`);
    const partial = items.filter((item) => key(item.name).includes(wanted));
    if (partial.length === 1) return partial[0];
    if (partial.length > 1) throw new BadRequestException(`${label} "${name}" é ambíguo: escreva o nome completo`);
    throw new BadRequestException(`${label} "${name}" não encontrado`);
  }

  private async assertLineFree(row: SalesImportRow) {
    if (row.taskProtocol) {
      const sameProtocol = await this.prisma.sale.findFirst({
        where: { taskProtocol: { equals: row.taskProtocol, mode: 'insensitive' } },
        select: { protocol: true },
      });
      if (sameProtocol) {
        throw new BadRequestException(`Protocolo ${row.taskProtocol} já está na venda ${sameProtocol.protocol}`);
      }
    }
    const existing = await this.prisma.sale.findFirst({
      where: {
        ...ACTIVE_SALE,
        OR: [{ newNumber: row.lineNumber }, { line: { number: row.lineNumber } }],
      },
      select: { protocol: true },
    });
    if (existing) {
      throw new BadRequestException(`A linha ${row.lineNumber} já tem a venda ${existing.protocol}`);
    }
  }

  private async findClient(row: SalesImportRow, partnerId: string, db: Prisma.TransactionClient = this.prisma) {
    return db.client.findFirst({
      where: {
        partnerId,
        document: { in: [row.clientDocument, formattedDocument(row.clientDocument)] },
      },
      select: { id: true },
    });
  }

  private clientData(row: SalesImportRow) {
    return {
      name: row.clientName,
      document: row.clientDocument,
      documentType: row.clientDocumentType,
      rg: row.clientRg,
      email: row.clientEmail,
      phone: row.clientPhone,
      address: row.address,
      addressNumber: row.addressNumber,
      complement: row.complement,
      neighborhood: row.neighborhood,
      city: row.city,
      state: row.state,
      zipCode: row.zipCode,
    };
  }

  private async updateExistingClient(row: SalesImportRow, partnerId: string, db: Prisma.TransactionClient = this.prisma) {
    const existing = await this.findClient(row, partnerId, db);
    if (!existing) return null;
    const filled = Object.fromEntries(
      Object.entries(this.clientData(row))
        .filter(([field, value]) => value !== undefined && value !== '' && field !== 'document'),
    );
    await db.client.update({ where: { id: existing.id }, data: filled });
    return existing.id;
  }

  private async upsertClient(
    row: SalesImportRow,
    partnerId: string,
    branchId: string | undefined,
    db: Prisma.TransactionClient,
  ) {
    const existingId = await this.updateExistingClient(row, partnerId, db);
    if (existingId) return existingId;
    const data = this.clientData(row);
    const created = await db.client.create({
      data: { ...data, phone: row.clientPhone || 'sem telefone', partnerId, branchId },
      select: { id: true },
    });
    return created.id;
  }

  private async createForReview(
    row: SalesImportRow,
    partnerId: string,
    branchId: string | undefined,
    operatorId: string,
    plan: PlanRef,
    user: AuthUser,
  ) {
    const clientId = await this.updateExistingClient(row, partnerId);
    const sale = await this.salesService.create({
      ...(clientId ? { clientId } : { client: this.clientData(row) }),
      operatorId,
      planId: plan.id,
      partnerId: user.partnerId ? undefined : partnerId,
      branchId: user.branchId ? undefined : branchId,
      value: row.value as number,
      isPortability: row.isPortability,
      portabilityNumber: row.portabilityNumber,
      donorOperator: row.donorOperator,
      newNumber: row.lineNumber,
      simType: row.simType,
      deviceImei: row.deviceImei,
      deviceEid: row.deviceEid,
      devicePlatform: row.devicePlatform,
      chipIccid: row.chipIccid,
      contractFormat: row.contractFormat,
      notes: row.notes,
    }, user);

    await this.prisma.sale.update({
      where: { id: sale.id },
      data: {
        reviewStatus: SaleReviewStatus.AWAITING_REVIEW,
        submittedAt: new Date(),
        timeline: {
          create: {
            actorId: user.id,
            actorName: user.name,
            action: 'Venda importada por planilha e enviada para análise',
            fromReviewStatus: SaleReviewStatus.DRAFT,
            toReviewStatus: SaleReviewStatus.AWAITING_REVIEW,
            details: `Linha ${row.row} da planilha. A planilha não traz anexos: confira e peça os documentos (chip, CPF, RG) se faltarem.`,
          },
        },
      },
    });
    return { protocol: sale.protocol, saleId: sale.id };
  }

  private async createConcluded(
    row: SalesImportRow,
    partnerId: string,
    branchId: string | undefined,
    operatorId: string,
    plan: PlanRef,
    user: AuthUser,
  ) {
    const soldAt = row.soldAt!;
    const concludedAt = row.concludedAt ?? soldAt;
    const planPrice = await this.prisma.plan.findUnique({ where: { id: plan.id }, select: { price: true } });
    const value = row.value ?? Number(planPrice?.price ?? 0);
    const { amount, commissionRate } = await this.salesService.resolveCommission(partnerId, plan.id, value);
    const billedByLuxus = await this.salesService.partnerBilledByLuxus(partnerId);
    const sale = await this.prisma.$transaction(async (tx) => {
      const clientId = await this.upsertClient(row, partnerId, branchId, tx);
      const line = await tx.line.upsert({
        where: { number: row.lineNumber },
        update: {
          operatorId,
          planId: plan.id,
          partnerId,
          clientId,
          status: LineStatus.ACTIVATED,
          activatedAt: concludedAt,
        },
        create: {
          number: row.lineNumber,
          operatorId,
          planId: plan.id,
          partnerId,
          clientId,
          status: LineStatus.ACTIVATED,
          activatedAt: concludedAt,
          createdAt: soldAt,
        },
      });
      const simCard = row.chipIccid
        ? await tx.simCard.findUnique({ where: { iccid: row.chipIccid }, select: { id: true } })
        : null;

      return tx.sale.create({
        data: {
          protocol: generateProtocol('VND'),
          partnerId,
          branchId,
          clientId,
          operatorId,
          planId: plan.id,
          lineId: line.id,
          simCardId: simCard?.id,
          chipIccid: row.chipIccid,
          createdById: user.id,
          status: SaleStatus.ACTIVATED,
          reviewStatus: SaleReviewStatus.APPROVED,
          submittedAt: soldAt,
          reviewedAt: concludedAt,
          reviewedById: user.id,
          approvedAt: concludedAt,
          activatedAt: concludedAt,
          taskProtocol: row.taskProtocol,
          taskStatus: 'concluido',
          taskSyncStatus: SaleTaskSyncStatus.SYNCED,
          taskLastSyncAt: new Date(),
          contractStage: SaleContractStage.COMPLETED,
          contractStageUpdatedAt: concludedAt,
          signedContractSyncStatus: SaleTaskSyncStatus.NOT_READY,
          contractFormat: row.contractFormat,
          billedByLuxus,
          value,
          commissionRate,
          commissionValue: amount,
          isPortability: row.isPortability,
          portabilityNumber: row.portabilityNumber,
          donorOperator: row.donorOperator,
          isVirginChip: false,
          simType: row.simType,
          deviceImei: row.deviceImei,
          deviceEid: row.deviceEid,
          devicePlatform: row.devicePlatform,
          newNumber: row.lineNumber,
          notes: [
            `Venda concluída no Luxus Task (${row.taskProtocol}) importada por planilha. Nada foi enviado ao Luxus Task.`,
            row.notes,
          ].filter(Boolean).join('\n'),
          requiredDocuments: getRequiredDocumentsForSale(row.simType) as unknown as Prisma.InputJsonValue,
          createdAt: soldAt,
          timeline: {
            create: {
              actorId: user.id,
              actorName: IMPORT_ACTOR,
              action: `Venda concluída importada por planilha (${row.taskProtocol})`,
              toReviewStatus: SaleReviewStatus.APPROVED,
              details: `Linha ${row.row} da planilha. Cadastro somente no Luxus Parceiros; a demanda do Luxus Task não foi alterada.`,
              createdAt: soldAt,
            },
          },
        },
        include: { partner: { select: { commissionRate: true } } },
      });
    });

    await this.commissionsService.createFromSale(sale, user.id);
    return { protocol: sale.protocol, saleId: sale.id };
  }
}

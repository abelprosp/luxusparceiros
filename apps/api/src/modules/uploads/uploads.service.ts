import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, Prisma, SaleStatus } from '@prisma/client';
import { AuthUser } from '@luxus/types';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { MESSAGES } from '@/common/constants/messages';
import { assertPartnerAccess, isAdminRole } from '@/common/utils/partner-scope';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly maxSize: number;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.maxSize = this.configService.get<number>('UPLOAD_MAX_SIZE', 10485760);
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    type: DocumentType,
    user: AuthUser,
    relations?: {
      clientId?: string;
      saleId?: string;
      requestId?: string;
      ticketId?: string;
    },
  ) {
    this.validateFile(file);
    await this.validateRelations(type, user, relations);

    const ext = extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const filepath = join(this.uploadDir, filename);

    const { writeFileSync } = await import('fs');
    writeFileSync(filepath, file.buffer);

    const document = await this.prisma.document.create({
      data: {
        name: file.originalname,
        type,
        url: `/uploads/${filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy: user.id,
        clientId: relations?.clientId,
        saleId: relations?.saleId,
        requestId: relations?.requestId,
        ticketId: relations?.ticketId,
      },
    });

    if (relations?.saleId) {
      await this.markSaleDocumentFulfilled(relations.saleId, type);
    }

    return document;
  }

  private async validateRelations(
    type: DocumentType,
    user: AuthUser,
    relations?: {
      clientId?: string;
      saleId?: string;
      requestId?: string;
      ticketId?: string;
    },
  ) {
    if (!relations?.saleId) return;

    const sale = await this.prisma.sale.findUnique({
      where: { id: relations.saleId },
      select: {
        partnerId: true,
        branchId: true,
        clientId: true,
        status: true,
        requiredDocuments: true,
      },
    });
    if (!sale) throw new BadRequestException('Venda não encontrada');

    assertPartnerAccess(user, sale.partnerId);
    if (user.branchId && user.branchId !== sale.branchId) {
      throw new ForbiddenException(MESSAGES.FORBIDDEN);
    }
    if (relations.clientId && relations.clientId !== sale.clientId) {
      throw new BadRequestException('Cliente não pertence à venda informada');
    }
    if (
      !isAdminRole(user.role) &&
      !([SaleStatus.IN_ANALYSIS, SaleStatus.DOCUMENTS_PENDING] as SaleStatus[]).includes(
        sale.status,
      )
    ) {
      throw new BadRequestException('Não é possível anexar documentos neste status da venda');
    }

    if (sale.status === SaleStatus.DOCUMENTS_PENDING) {
      const required = (sale.requiredDocuments ?? []) as Array<{
        type: string;
        fulfilled: boolean;
      }>;
      const requested = required.find((doc) => doc.type === type);
      if (!requested) {
        throw new BadRequestException('Este tipo de documento não foi solicitado para a venda');
      }
      if (requested.fulfilled) {
        throw new BadRequestException('Este documento solicitado já foi enviado');
      }
    }
  }

  private async markSaleDocumentFulfilled(saleId: string, type: DocumentType) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale?.requiredDocuments) return;

    const docs = sale.requiredDocuments as Array<{
      type: string;
      label: string;
      fulfilled: boolean;
    }>;

    const updated = docs.map((doc) =>
      doc.type === type ? { ...doc, fulfilled: true } : doc,
    );

    await this.prisma.sale.update({
      where: { id: saleId },
      data: { requiredDocuments: updated as Prisma.InputJsonValue },
    });
  }

  getFileStream(filename: string) {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filepath = join(this.uploadDir, sanitized);
    if (!existsSync(filepath)) {
      throw new BadRequestException(MESSAGES.NOT_FOUND);
    }
    return createReadStream(filepath);
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório');
    }
    if (file.size > this.maxSize) {
      throw new BadRequestException(MESSAGES.FILE_TOO_LARGE);
    }
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(MESSAGES.FILE_TYPE_INVALID);
    }
  }
}

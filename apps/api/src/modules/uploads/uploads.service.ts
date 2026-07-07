import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentType, Prisma } from '@prisma/client';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { MESSAGES } from '@/common/constants/messages';

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
    userId: string,
    relations?: {
      clientId?: string;
      saleId?: string;
      requestId?: string;
      ticketId?: string;
    },
  ) {
    this.validateFile(file);

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
        uploadedBy: userId,
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

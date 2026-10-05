import {
  Controller,
  Delete,
  Get,
  Head,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthUser } from '@luxus/types';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';
import { UploadFileDto } from './dto/upload.dto';
import { Body } from '@nestjs/common';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  @Post()
  @ApiOperation({ summary: 'Upload de arquivo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string' },
        clientId: { type: 'string' },
        saleId: { type: 'string' },
        requestId: { type: 'string' },
        ticketId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.uploadFile(file, dto.type, user, {
      clientId: dto.clientId,
      saleId: dto.saleId,
      requestId: dto.requestId,
      ticketId: dto.ticketId,
    }, dto.purpose);
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Enviar foto de perfil do usuário autenticado' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.uploadAvatar(file, user);
  }

  @Post(':documentId/replace')
  @ApiOperation({ summary: 'Substituir o arquivo de um documento já anexado' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  replaceDocument(
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.replaceDocument(documentId, file, user);
  }

  @Delete(':documentId')
  @ApiOperation({ summary: 'Excluir um documento já anexado' })
  deleteDocument(
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.deleteDocument(documentId, user);
  }

  @Head(':filename')
  async check(
    @Param('filename') filename: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.uploadsService.getFile(filename, user);
    file.stream.destroy();
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.status(200).end();
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Download de arquivo' })
  async download(
    @Param('filename') filename: string,
    @Query('download') download: string | undefined,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const file = await this.uploadsService.getFile(filename, user);
    const disposition = download === '1' ? 'attachment' : 'inline';
    const fallbackName = file.name.replace(/[^\w.-]/g, '_');

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    );
    res.setHeader('Cache-Control', 'private, max-age=300');
    const stream = file.stream;
    stream.pipe(res);
  }
}

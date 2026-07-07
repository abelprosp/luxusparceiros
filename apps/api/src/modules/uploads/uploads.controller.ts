import {
  Controller,
  Get,
  Param,
  Post,
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
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.uploadFile(file, dto.type, user.id, {
      clientId: dto.clientId,
      saleId: dto.saleId,
      requestId: dto.requestId,
      ticketId: dto.ticketId,
    });
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Download de arquivo' })
  download(@Param('filename') filename: string, @Res() res: Response) {
    const stream = this.uploadsService.getFileStream(filename);
    stream.pipe(res);
  }
}

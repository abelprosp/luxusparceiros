import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { MESSAGES } from '../constants/messages';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = MESSAGES.INTERNAL_ERROR;

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'Registro duplicado';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = MESSAGES.NOT_FOUND;
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Referência inválida';
        break;
    }

    response.status(status).json({
      success: false,
      error: message,
      statusCode: status,
    });
  }
}

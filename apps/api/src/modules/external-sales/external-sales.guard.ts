import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class ExternalSalesGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('EXTERNAL_SALES_API_KEY')?.trim();
    const headers = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>()
      .headers;

    const received = headers['x-api-key'] ?? headers['x-integration-key'];
    const value = Array.isArray(received) ? received[0] : received;

    if (!expected || !value) {
      throw new UnauthorizedException('API não autorizada');
    }

    const expectedBuffer = Buffer.from(expected);
    const valueBuffer = Buffer.from(value);
    if (
      expectedBuffer.length !== valueBuffer.length ||
      !timingSafeEqual(expectedBuffer, valueBuffer)
    ) {
      throw new UnauthorizedException('API não autorizada');
    }

    return true;
  }
}

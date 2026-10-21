import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from '@/prisma/prisma.service';
import { CoordinationService } from '@/common/coordination/coordination.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coordination: CoordinationService,
  ) {}

  /** Liveness: o processo está de pé. */
  @Public()
  @Get()
  check() {
    return { status: 'ok' };
  }

  /**
   * Readiness: sem banco a API não atende (503). Redis fora deixa a API "degraded",
   * porque travas e contadores passam a usar o PostgreSQL.
   */
  @Public()
  @Get('ready')
  async ready() {
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => 'up' as const)
      .catch(() => 'down' as const);
    const redis = await this.coordination.redisHealth();
    if (database !== 'up') {
      throw new ServiceUnavailableException({ status: 'unavailable', database, redis });
    }
    return { status: redis === 'down' ? 'degraded' : 'ok', database, redis };
  }
}

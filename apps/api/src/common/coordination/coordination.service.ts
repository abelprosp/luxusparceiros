import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { PrismaService } from '@/prisma/prisma.service';

export type RedisHealth = 'up' | 'down' | 'not_configured';

const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

/**
 * Travas e contadores compartilhados entre instâncias da API.
 * Usa Redis quando REDIS_URL está definido; caso contrário (ou se o Redis cair), usa a tabela
 * coordination_entries do PostgreSQL, que também é compartilhada entre réplicas.
 */
@Injectable()
export class CoordinationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CoordinationService.name);
  private redis: Redis | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (url) {
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 3_000,
      });
      this.redis.on('error', (error) => this.logger.warn(`Redis indisponível: ${error.message}`));
      this.redis.connect().catch(() => undefined);
    }
    this.cleanupTimer = setInterval(() => void this.cleanupExpired(), 60 * 60_000);
    this.cleanupTimer.unref();
  }

  async onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.redis?.quit().catch(() => undefined);
  }

  async redisHealth(): Promise<RedisHealth> {
    if (!this.redis) return 'not_configured';
    try {
      return (await this.redis.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  /** Executa `work` só se esta instância obtiver a trava; outra instância com a trava faz a vez. */
  async withLock<T>(name: string, ttlMs: number, work: () => Promise<T>): Promise<T | undefined> {
    const token = await this.acquireLock(name, ttlMs);
    if (!token) return undefined;
    try {
      return await work();
    } finally {
      await this.releaseLock(name, token);
    }
  }

  async acquireLock(name: string, ttlMs: number): Promise<string | null> {
    const key = `lock:${name}`;
    const token = randomUUID();
    const viaRedis = await this.tryRedis(async (redis) =>
      (await redis.set(key, token, 'PX', ttlMs, 'NX')) === 'OK',
    );
    if (viaRedis !== undefined) return viaRedis ? token : null;

    const rows = await this.prisma.$queryRaw<Array<{ owner: string }>>`
      INSERT INTO "coordination_entries" ("key", "value", "owner", "expiresAt")
      VALUES (${key}, 0, ${token}, NOW() + (${ttlMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE
        SET "owner" = EXCLUDED."owner", "expiresAt" = EXCLUDED."expiresAt"
        WHERE "coordination_entries"."expiresAt" < NOW()
      RETURNING "owner"`;
    return rows[0]?.owner === token ? token : null;
  }

  async releaseLock(name: string, token: string): Promise<void> {
    const key = `lock:${name}`;
    const viaRedis = await this.tryRedis((redis) => redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token));
    if (viaRedis !== undefined) return;
    await this.prisma.$executeRaw`
      DELETE FROM "coordination_entries" WHERE "key" = ${key} AND "owner" = ${token}`;
  }

  /** Incrementa um contador que zera sozinho depois de `windowMs` a partir do primeiro incremento. */
  async increment(key: string, windowMs: number): Promise<number> {
    const counterKey = `count:${key}`;
    const viaRedis = await this.tryRedis(async (redis) => {
      const value = await redis.incr(counterKey);
      if (value === 1) await redis.pexpire(counterKey, windowMs);
      return value;
    });
    if (viaRedis !== undefined) return viaRedis;

    const rows = await this.prisma.$queryRaw<Array<{ value: number }>>`
      INSERT INTO "coordination_entries" ("key", "value", "expiresAt")
      VALUES (${counterKey}, 1, NOW() + (${windowMs} * INTERVAL '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "value" = CASE WHEN "coordination_entries"."expiresAt" < NOW() THEN 1
                       ELSE "coordination_entries"."value" + 1 END,
        "expiresAt" = CASE WHEN "coordination_entries"."expiresAt" < NOW() THEN EXCLUDED."expiresAt"
                           ELSE "coordination_entries"."expiresAt" END
      RETURNING "value"`;
    return Number(rows[0]?.value ?? 0);
  }

  async getCount(key: string): Promise<number> {
    const counterKey = `count:${key}`;
    const viaRedis = await this.tryRedis(async (redis) => Number((await redis.get(counterKey)) ?? 0));
    if (viaRedis !== undefined) return viaRedis;
    const rows = await this.prisma.$queryRaw<Array<{ value: number }>>`
      SELECT "value" FROM "coordination_entries" WHERE "key" = ${counterKey} AND "expiresAt" > NOW()`;
    return Number(rows[0]?.value ?? 0);
  }

  /** Milissegundos até o contador expirar (0 se não existir). */
  async getTtlMs(key: string): Promise<number> {
    const counterKey = `count:${key}`;
    const viaRedis = await this.tryRedis(async (redis) => Math.max(0, await redis.pttl(counterKey)));
    if (viaRedis !== undefined) return viaRedis;
    const rows = await this.prisma.$queryRaw<Array<{ ms: number }>>`
      SELECT GREATEST(0, EXTRACT(EPOCH FROM ("expiresAt" - NOW())) * 1000)::int AS ms
      FROM "coordination_entries" WHERE "key" = ${counterKey}`;
    return Number(rows[0]?.ms ?? 0);
  }

  async clear(key: string): Promise<void> {
    const counterKey = `count:${key}`;
    const viaRedis = await this.tryRedis((redis) => redis.del(counterKey));
    if (viaRedis !== undefined) return;
    await this.prisma.$executeRaw`DELETE FROM "coordination_entries" WHERE "key" = ${counterKey}`;
  }

  private async tryRedis<T>(work: (redis: Redis) => Promise<T>): Promise<T | undefined> {
    if (!this.redis || this.redis.status !== 'ready') return undefined;
    try {
      return await work(this.redis);
    } catch (error) {
      this.logger.warn(`Redis falhou, usando o banco: ${error instanceof Error ? error.message : error}`);
      return undefined;
    }
  }

  private async cleanupExpired() {
    await this.prisma.$executeRaw`
      DELETE FROM "coordination_entries" WHERE "expiresAt" < NOW() - INTERVAL '1 hour'`
      .catch(() => undefined);
  }
}

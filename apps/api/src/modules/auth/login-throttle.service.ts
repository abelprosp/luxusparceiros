import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CoordinationService } from '@/common/coordination/coordination.service';

const WINDOW_MS = 15 * 60_000;
const MAX_PER_ACCOUNT_AND_IP = 5;
const MAX_PER_ACCOUNT = 20;
const MAX_PER_IP = 50;

/**
 * Bloqueio temporário de login por conta+IP (erro de digitação/força bruta pontual),
 * por conta em qualquer IP (ataque distribuído) e por IP em qualquer conta (varredura).
 */
@Injectable()
export class LoginThrottleService {
  constructor(private readonly coordination: CoordinationService) {}

  async assertAllowed(email: string, ip?: string) {
    const keys = this.keys(email, ip);
    const checks: Array<[string, number]> = [
      [keys.accountIp, MAX_PER_ACCOUNT_AND_IP],
      [keys.account, MAX_PER_ACCOUNT],
      [keys.ip, MAX_PER_IP],
    ];
    for (const [key, limit] of checks) {
      if ((await this.coordination.getCount(key)) >= limit) {
        const minutes = Math.max(1, Math.ceil((await this.coordination.getTtlMs(key)) / 60_000));
        throw new HttpException(
          `Muitas tentativas de login. Tente novamente em ${minutes} minuto(s).`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  async registerFailure(email: string, ip?: string) {
    const keys = this.keys(email, ip);
    await Promise.all([
      this.coordination.increment(keys.accountIp, WINDOW_MS),
      this.coordination.increment(keys.account, WINDOW_MS),
      this.coordination.increment(keys.ip, WINDOW_MS),
    ]);
  }

  async registerSuccess(email: string, ip?: string) {
    const keys = this.keys(email, ip);
    await Promise.all([
      this.coordination.clear(keys.accountIp),
      this.coordination.clear(keys.account),
    ]);
  }

  private keys(email: string, ip?: string) {
    const account = email.trim().toLowerCase();
    const address = ip || 'unknown';
    return {
      accountIp: `login:account-ip:${account}:${address}`,
      account: `login:account:${account}`,
      ip: `login:ip:${address}`,
    };
  }
}

import { BadRequestException } from '@nestjs/common';

const MAX_RANGE_DAYS = 3660;

/** Rejeita intervalos invertidos ou absurdos (datas já validadas como ISO pelo DTO). */
export function assertDateRange(start?: string | Date | null, end?: string | Date | null, label = 'período') {
  if (!start || !end) return;
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new BadRequestException(`Datas do ${label} inválidas`);
  }
  if (from > to) {
    throw new BadRequestException(`A data inicial do ${label} deve ser anterior à final`);
  }
  if (to - from > MAX_RANGE_DAYS * 24 * 60 * 60_000) {
    throw new BadRequestException(`O ${label} informado é longo demais`);
  }
}

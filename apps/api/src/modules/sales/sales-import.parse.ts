import { ContractFormat, DevicePlatform, DonorOperator, DocumentType, SaleSimType } from '@prisma/client';

export const SALES_IMPORT_MAX_ROWS = 300;

export type SalesImportMode = 'new' | 'concluded';

export type SalesImportRawRow = Record<string, unknown>;

export interface SalesImportRow {
  row: number;
  partner: string;
  branch: string;
  clientName: string;
  clientDocument: string;
  clientDocumentType: DocumentType;
  clientRg?: string;
  clientEmail?: string;
  clientPhone: string;
  zipCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  operator: string;
  plan: string;
  value: number | null;
  lineNumber: string;
  simType: SaleSimType;
  chipIccid?: string;
  deviceImei?: string;
  deviceEid?: string;
  devicePlatform?: DevicePlatform;
  isPortability: boolean;
  portabilityNumber?: string;
  donorOperator?: DonorOperator;
  contractFormat: ContractFormat;
  billedByLuxus: boolean;
  notes?: string;
  taskProtocol?: string;
  soldAt?: Date;
  concludedAt?: Date;
}

const VALID_UF = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, ' ').trim();
}

export function digits(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value).toLocaleString('fullwide', { useGrouping: false });
  }
  return text(value).replace(/\D/g, '');
}

function plain(value: unknown): string {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function yesNo(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const normalized = plain(value);
  if (!normalized) return null;
  if (['sim', 's', 'yes', 'y', 'x', 'true', '1', 'verdadeiro'].includes(normalized)) return true;
  if (['nao', 'n', 'no', 'false', '0', 'falso'].includes(normalized)) return false;
  return null;
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  let raw = text(value).replace(/r\$/i, '').replace(/\s/g, '');
  if (!raw) return null;
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function noonInBrazil(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day, 15, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** Aceita yyyy-mm-dd, dd/mm/aaaa, dd/mm/aa e o número de série de data do Excel. */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return noonInBrazil(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    const epoch = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return noonInBrazil(epoch.getUTCFullYear(), epoch.getUTCMonth() + 1, epoch.getUTCDate());
  }
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return noonInBrazil(Number(match[1]), Number(match[2]), Number(match[3]));
  match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return noonInBrazil(year, Number(match[2]), Number(match[1]));
  }
  return null;
}

function simTypeOf(value: unknown): SaleSimType | null {
  const normalized = plain(value).replace(/[\s-]/g, '');
  if (!normalized || normalized.startsWith('chip') || normalized === 'fisico') return SaleSimType.CHIP;
  if (normalized === 'esim') return SaleSimType.ESIM;
  return null;
}

function platformOf(value: unknown): DevicePlatform | null {
  const normalized = plain(value);
  if (!normalized) return null;
  if (normalized === 'ios' || normalized.includes('iphone') || normalized.includes('apple')) return DevicePlatform.IOS;
  if (normalized.includes('android')) return DevicePlatform.ANDROID;
  return null;
}

function donorOf(value: unknown): DonorOperator | null {
  const normalized = plain(value);
  if (!normalized) return null;
  if (normalized.includes('vivo')) return DonorOperator.VIVO;
  if (normalized.includes('tim')) return DonorOperator.TIM;
  if (normalized.includes('claro')) return DonorOperator.CLARO;
  if (normalized.includes('surf')) return DonorOperator.SURF;
  if (normalized.startsWith('outr') || normalized === 'other') return DonorOperator.OTHER;
  return null;
}

function contractFormatOf(value: unknown): ContractFormat | null {
  const normalized = plain(value).replace(/\s/g, '');
  if (!normalized) return null;
  if (normalized.startsWith('impress') || normalized.startsWith('imprim') || normalized === 'papel' || normalized === 'print') {
    return ContractFormat.PRINT;
  }
  if (normalized.includes('zapsign') || normalized === 'digital') return ContractFormat.ZAPSIGN;
  return null;
}

function optional(value: unknown): string | undefined {
  return text(value) || undefined;
}

/** O Excel guarda número com no máximo 15 dígitos: ICCID e EID digitados como número chegam cortados. */
function longDigits(value: unknown, label: string, errors: string[]): string | undefined {
  if (typeof value === 'number' && Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    errors.push(`${label} foi digitado como número e o Excel cortou os dígitos. Formate a coluna como Texto e digite de novo`);
    return undefined;
  }
  return digits(value) || undefined;
}

/** CPF digitado como número perde o zero da frente. */
function documentDigits(value: unknown): string {
  const raw = digits(value);
  if (typeof value !== 'number' || !raw) return raw;
  return raw.padStart(raw.length <= 11 ? 11 : 14, '0');
}

export function normalizeImportRow(
  raw: SalesImportRawRow,
  mode: SalesImportMode,
  today: Date = new Date(),
): { value?: SalesImportRow; errors: string[] } {
  const errors: string[] = [];
  const isConcluded = mode === 'concluded';
  const row = Number(raw.row) || 0;

  const clientName = text(raw.clientName);
  if (!clientName) errors.push('Informe o nome do cliente');

  const clientDocument = documentDigits(raw.clientDocument);
  if (clientDocument.length !== 11 && clientDocument.length !== 14) {
    errors.push('CPF/CNPJ do cliente deve ter 11 ou 14 dígitos');
  }

  const clientPhone = digits(raw.clientPhone);
  if (clientPhone && (clientPhone.length < 10 || clientPhone.length > 13)) {
    errors.push('Telefone de contato deve ter DDD + número');
  } else if (!clientPhone && !isConcluded) {
    errors.push('Informe o telefone de contato do cliente');
  }

  const clientEmail = optional(raw.clientEmail);
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) errors.push('E-mail do cliente inválido');

  const state = text(raw.state).toUpperCase() || undefined;
  if (state && !VALID_UF.has(state)) errors.push('UF deve ter a sigla do estado (ex.: RS)');

  const operator = text(raw.operator);
  if (!operator) errors.push('Informe a operadora');
  const plan = text(raw.plan);
  if (!plan) errors.push('Informe o plano');

  const valueRaw = text(raw.value);
  const value = valueRaw ? parseMoney(raw.value) : null;
  if (valueRaw && (value === null || value < 0)) errors.push('Valor da venda inválido');

  const isPortability = yesNo(raw.isPortability) ?? false;
  if (text(raw.isPortability) && yesNo(raw.isPortability) === null) errors.push('Portabilidade deve ser Sim ou Não');
  const portabilityNumber = digits(raw.portabilityNumber) || undefined;
  const donorOperator = donorOf(raw.donorOperator) ?? undefined;
  if (isPortability) {
    if (!portabilityNumber) errors.push('Informe o número portado');
    if (!donorOperator) errors.push('Operadora doadora deve ser Vivo, TIM, Claro, Surf ou Outra');
  }

  const lineNumber = digits(raw.lineNumber) || (isPortability ? portabilityNumber ?? '' : '');
  if (!lineNumber) {
    errors.push('Informe o número da linha vendida');
  } else if (lineNumber.length < 10 || lineNumber.length > 13) {
    errors.push('Número da linha deve ter DDD + número');
  } else if (clientPhone && lineNumber === clientPhone) {
    errors.push('Telefone de contato deve ser diferente da linha vendida');
  }

  const simType = simTypeOf(raw.simType);
  if (!simType) errors.push('Tipo de chip deve ser Chip ou eSIM');
  const chipIccid = longDigits(raw.chipIccid, 'ICCID', errors);
  if (chipIccid && (chipIccid.length < 19 || chipIccid.length > 22)) errors.push('ICCID deve ter de 19 a 22 dígitos');
  const deviceImei = digits(raw.deviceImei) || undefined;
  const deviceEid = longDigits(raw.deviceEid, 'EID', errors);
  const devicePlatform = platformOf(raw.devicePlatform) ?? undefined;
  if (deviceImei && deviceImei.length !== 15) errors.push('IMEI deve ter 15 dígitos');
  if (deviceEid && deviceEid.length !== 32) errors.push('EID deve ter 32 dígitos');
  if (text(raw.devicePlatform) && !devicePlatform) errors.push('Sistema do aparelho deve ser iOS ou Android');
  if (simType === SaleSimType.ESIM && !isConcluded) {
    if (!deviceImei) errors.push('eSIM: informe o IMEI do aparelho');
    if (!deviceEid) errors.push('eSIM: informe o EID do aparelho');
    if (!devicePlatform) errors.push('eSIM: informe se o aparelho é iOS ou Android');
  }

  const contractFormat = contractFormatOf(raw.contractFormat) ?? (isConcluded && !text(raw.contractFormat) ? ContractFormat.PRINT : null);
  if (!contractFormat) errors.push('Formato do contrato deve ser Impressão ou ZapSign');

  const billedByLuxus = yesNo(raw.billedByLuxus);
  if (billedByLuxus === null) errors.push('Cobrança pela Luxus deve ser Sim ou Não');

  let taskProtocol: string | undefined;
  let soldAt: Date | undefined;
  let concludedAt: Date | undefined;
  if (isConcluded) {
    taskProtocol = text(raw.taskProtocol).toUpperCase() || undefined;
    if (!taskProtocol) errors.push('Informe o protocolo da demanda no Luxus Task');
    const sold = parseDate(raw.soldAt);
    if (!sold) errors.push('Data da venda inválida (use dd/mm/aaaa)');
    const concludedRaw = text(raw.concludedAt);
    const concluded = concludedRaw ? parseDate(raw.concludedAt) : sold;
    if (concludedRaw && !concluded) errors.push('Data de conclusão inválida (use dd/mm/aaaa)');
    const limit = today.getTime() + 86_400_000;
    if (sold && sold.getTime() > limit) errors.push('Data da venda não pode ser no futuro');
    if (concluded && concluded.getTime() > limit) errors.push('Data de conclusão não pode ser no futuro');
    if (sold && concluded && concluded.getTime() < sold.getTime()) {
      errors.push('Data de conclusão não pode ser antes da data da venda');
    }
    soldAt = sold ?? undefined;
    concludedAt = concluded ?? undefined;
  }

  if (errors.length) return { errors };

  return {
    errors,
    value: {
      row,
      partner: text(raw.partner),
      branch: text(raw.branch),
      clientName,
      clientDocument,
      clientDocumentType: clientDocument.length === 14 ? DocumentType.CNPJ : DocumentType.CPF,
      clientRg: optional(raw.clientRg),
      clientEmail,
      clientPhone,
      zipCode: digits(raw.zipCode) || undefined,
      address: optional(raw.address),
      addressNumber: optional(raw.addressNumber),
      complement: optional(raw.complement),
      neighborhood: optional(raw.neighborhood),
      city: optional(raw.city),
      state,
      operator,
      plan,
      value,
      lineNumber,
      simType: simType!,
      chipIccid,
      deviceImei,
      deviceEid,
      devicePlatform,
      isPortability,
      portabilityNumber,
      donorOperator,
      contractFormat: contractFormat!,
      billedByLuxus: billedByLuxus!,
      notes: optional(raw.notes),
      taskProtocol,
      soldAt,
      concludedAt,
    },
  };
}

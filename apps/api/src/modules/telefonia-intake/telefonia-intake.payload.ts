const INTAKE_PATH = '/v1/intake/customers';
const PREVIOUS_INTAKE_PATH = '/v1/integrations/luxus-parceiros/sales';

export function telefoniaIntakeUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(INTAKE_PATH)) return trimmed;
  const base = trimmed.endsWith(PREVIOUS_INTAKE_PATH)
    ? trimmed.slice(0, -PREVIOUS_INTAKE_PATH.length)
    : trimmed;
  return `${base}${INTAKE_PATH}`;
}

export function moneyAmount(value: { toString(): string } | number | null | undefined) {
  if (value == null || value === '') return 0;
  const amount = Number(value.toString());
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

export type TelefoniaSaleSource = {
  id: string;
  protocol: string;
  taskProtocol?: string | null;
  createdAt?: Date | string | null;
  activatedAt?: Date | string | null;
  value?: { toString(): string } | number | null;
  commissionValue?: { toString(): string } | number | null;
  newNumber?: string | null;
  simType?: string | null;
  isVirginChip?: boolean | null;
  chipIccid?: string | null;
  deviceImei?: string | null;
  deviceEid?: string | null;
  devicePlatform?: string | null;
  isPortability?: boolean | null;
  portabilityNumber?: string | null;
  donorOperator?: string | null;
  isUpgrade?: boolean | null;
  contractFormat?: string | null;
  notes?: string | null;
  partner?: { name?: string | null } | null;
  branch?: { name?: string | null } | null;
  operator?: { name?: string | null } | null;
  plan?: { name?: string | null } | null;
  line?: { number?: string | null } | null;
  simCard?: { iccid?: string | null } | null;
  upgradeOfSale?: { protocol?: string | null } | null;
  client: {
    name?: string | null;
    document?: string | null;
    documentType?: string | null;
    rg?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
};

export type TelefoniaAttachmentSource = {
  id: string;
  type?: string | null;
  name?: string | null;
  mimeType?: string | null;
  contentBase64: string;
};

const VALID_UF = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);
const ACCEPTED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function iso(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function digits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function phoneOrBlank(value: string | null | undefined) {
  const normalized = digits(value);
  return normalized.length >= 10 && normalized.length <= 15 ? normalized : '';
}

function emailOrBlank(value: string | null | undefined) {
  const email = (value ?? '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function clip(value: string | null | undefined, max: number) {
  return [...(value ?? '').trim()].slice(0, max).join('');
}

function identityDocument(document: string | null | undefined, documentType: string | null | undefined) {
  const normalized = digits(document);
  const declared = (documentType ?? '').trim().toUpperCase();
  if (normalized.length === 11) return { document: normalized, documentType: 'CPF' };
  if (normalized.length === 14) return { document: normalized, documentType: 'CNPJ' };
  if (declared === 'CPF' || declared === 'CNPJ') return { document: normalized, documentType: declared };
  return { document: normalized, documentType: declared };
}

export function buildTelefoniaSalePayload(
  sale: TelefoniaSaleSource,
  attachments: TelefoniaAttachmentSource[],
  extraNotes: string[] = [],
) {
  const preserved: string[] = [];
  const phone = phoneOrBlank(sale.client.phone);
  if ((sale.client.phone ?? '').trim() && !phone) preserved.push(`Telefone de origem: ${sale.client.phone?.trim()}`);
  const email = emailOrBlank(sale.client.email);
  if ((sale.client.email ?? '').trim() && !email) preserved.push(`E-mail de origem: ${sale.client.email?.trim()}`);
  const zipCode = digits(sale.client.zipCode);
  const state = (sale.client.state ?? '').trim().toUpperCase();
  const clientDocument = identityDocument(sale.client.document, sale.client.documentType);
  const lineNumber = phoneOrBlank(sale.newNumber?.trim() || sale.line?.number);
  const portabilityNumber = phoneOrBlank(sale.portabilityNumber);
  const iccid = digits(sale.chipIccid?.trim() || sale.simCard?.iccid);
  const imei = digits(sale.deviceImei);
  const eid = digits(sale.deviceEid);
  const soldAt = iso(sale.createdAt) || iso(sale.activatedAt) || new Date().toISOString();
  let concludedAt = iso(sale.activatedAt);
  if (concludedAt && concludedAt < soldAt) concludedAt = soldAt;
  const notes = [sale.notes?.trim(), ...extraNotes.map((note) => note.trim()), ...preserved]
    .filter(Boolean)
    .join('\n');
  return {
    sourceSystem: 'luxus-parceiros',
    sale: {
      id: sale.id,
      protocol: sale.protocol,
      taskProtocol: sale.taskProtocol ?? '',
      soldAt,
      concludedAt: concludedAt || undefined,
      value: moneyAmount(sale.value),
      commissionValue: moneyAmount(sale.commissionValue),
      operatorName: clip(sale.operator?.name, 256),
      planName: clip(sale.plan?.name, 256),
      lineNumber,
      simType: sale.simType ?? '',
      isVirginChip: Boolean(sale.isVirginChip),
      iccid: iccid.length >= 19 && iccid.length <= 22 ? iccid : '',
      deviceImei: imei.length === 15 ? imei : '',
      deviceEid: eid.length === 32 ? eid : '',
      devicePlatform: sale.devicePlatform ?? '',
      isPortability: Boolean(sale.isPortability) && Boolean(portabilityNumber) && Boolean(sale.donorOperator?.trim()),
      portabilityNumber,
      donorOperator: sale.donorOperator ?? '',
      isUpgrade: Boolean(sale.isUpgrade) && Boolean(sale.upgradeOfSale?.protocol?.trim()),
      upgradeOfProtocol: sale.upgradeOfSale?.protocol ?? '',
      contractFormat: sale.contractFormat ?? '',
      partnerName: clip(sale.partner?.name, 256),
      branchName: clip(sale.branch?.name, 256),
      notes: clip(notes, 4000),
    },
    client: {
      name: clip(sale.client.name, 256),
      document: clientDocument.document,
      documentType: clientDocument.documentType,
      ...(clientDocument.documentType === 'CNPJ' ? { legalName: clip(sale.client.name, 256) } : {}),
      rg: clientDocument.documentType === 'CPF' ? clip(sale.client.rg, 256) : '',
      email,
      phone,
      address: clip(sale.client.address, 256),
      addressNumber: clip(sale.client.addressNumber, 16),
      complement: clip(sale.client.complement, 128),
      neighborhood: clip(sale.client.neighborhood, 128),
      city: clip(sale.client.city, 128),
      state: VALID_UF.has(state) ? state : '',
      zipCode: zipCode.length === 8 ? zipCode : '',
    },
    attachments: attachments
      .filter((attachment) => ACCEPTED_MIME.has((attachment.mimeType || '').toLowerCase()))
      .slice(0, 10)
      .map((attachment) => ({
        id: attachment.id,
        type: clip(attachment.type || 'OTHER', 64),
        name: clip((attachment.name || attachment.id).replace(/[\\/\r\n]/g, '-'), 256),
        mimeType: (attachment.mimeType || '').toLowerCase(),
        contentBase64: attachment.contentBase64,
      })),
  };
}

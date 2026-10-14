const INTAKE_PATH = '/v1/integrations/luxus-parceiros/sales';

export function telefoniaIntakeUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.endsWith(INTAKE_PATH)) return trimmed;
  return `${trimmed}${INTAKE_PATH}`;
}

export function moneyAmount(value: { toString(): string } | number | null | undefined) {
  if (value == null || value === '') return null;
  const amount = Number(value.toString());
  return Number.isFinite(amount) ? amount : null;
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

function iso(value: Date | string | null | undefined) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function buildTelefoniaSalePayload(
  sale: TelefoniaSaleSource,
  attachments: TelefoniaAttachmentSource[],
  extraNotes: string[] = [],
) {
  const notes = [sale.notes?.trim(), ...extraNotes.map((note) => note.trim())].filter(Boolean).join('\n');
  return {
    sale: {
      id: sale.id,
      protocol: sale.protocol,
      taskProtocol: sale.taskProtocol ?? '',
      soldAt: iso(sale.createdAt),
      concludedAt: iso(sale.activatedAt),
      value: moneyAmount(sale.value),
      commissionValue: moneyAmount(sale.commissionValue),
      operatorName: sale.operator?.name ?? '',
      planName: sale.plan?.name ?? '',
      lineNumber: sale.newNumber?.trim() || sale.line?.number?.trim() || '',
      simType: sale.simType ?? '',
      isVirginChip: Boolean(sale.isVirginChip),
      iccid: sale.chipIccid?.trim() || sale.simCard?.iccid?.trim() || '',
      deviceImei: sale.deviceImei ?? '',
      deviceEid: sale.deviceEid ?? '',
      devicePlatform: sale.devicePlatform ?? '',
      isPortability: Boolean(sale.isPortability),
      portabilityNumber: sale.portabilityNumber ?? '',
      donorOperator: sale.donorOperator ?? '',
      isUpgrade: Boolean(sale.isUpgrade),
      upgradeOfProtocol: sale.upgradeOfSale?.protocol ?? '',
      contractFormat: sale.contractFormat ?? '',
      partnerName: sale.partner?.name ?? '',
      branchName: sale.branch?.name ?? '',
      notes,
    },
    client: {
      name: sale.client.name ?? '',
      document: sale.client.document ?? '',
      documentType: sale.client.documentType ?? '',
      rg: sale.client.rg ?? '',
      email: sale.client.email ?? '',
      phone: sale.client.phone ?? '',
      address: sale.client.address ?? '',
      addressNumber: sale.client.addressNumber ?? '',
      complement: sale.client.complement ?? '',
      neighborhood: sale.client.neighborhood ?? '',
      city: sale.client.city ?? '',
      state: sale.client.state ?? '',
      zipCode: sale.client.zipCode ?? '',
    },
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      type: attachment.type || 'OTHER',
      name: attachment.name || attachment.id,
      mimeType: attachment.mimeType || 'application/octet-stream',
      contentBase64: attachment.contentBase64,
    })),
  };
}

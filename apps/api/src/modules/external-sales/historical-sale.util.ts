import { DocumentPurpose, DocumentType } from '@prisma/client';

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function branchDisplayName(existingNames: string[], filialName: string): string {
  const filial = filialName.trim().toLocaleUpperCase('pt-BR');
  const prefixes = existingNames
    .map((name) => name.trim().split(/\s+/))
    .filter((parts) => parts.length > 1)
    .map((parts) => parts.slice(0, -1).join(' '));
  const prefix = prefixes[0];
  if (prefix && prefixes.every((item) => item === prefix)) {
    return `${prefix} ${filial}`;
  }
  return filial;
}

export function classifyHistoricalAttachment(filename: string): {
  type: DocumentType;
  purpose: DocumentPurpose;
} {
  const name = filename.toLocaleLowerCase('pt-BR');
  if (name.includes('contrato')) {
    return { type: DocumentType.CONTRACT, purpose: DocumentPurpose.SIGNED_CONTRACT };
  }
  if (name.includes('cnh') || /(^|[^a-z])rg([^a-z]|$)/.test(name)) {
    return { type: DocumentType.RG, purpose: DocumentPurpose.GENERAL };
  }
  if (name.includes('cpf')) {
    return { type: DocumentType.CPF, purpose: DocumentPurpose.GENERAL };
  }
  if (name.includes('assin') || /(^|[^a-z])ass([^a-z]|$)/.test(name)) {
    return { type: DocumentType.SIGNATURE, purpose: DocumentPurpose.GENERAL };
  }
  if (name.includes('chip')) {
    return { type: DocumentType.CHIP_PHOTO, purpose: DocumentPurpose.GENERAL };
  }
  return { type: DocumentType.OTHER, purpose: DocumentPurpose.GENERAL };
}

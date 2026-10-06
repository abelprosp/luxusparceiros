import { DocumentType, SaleSimType } from '@prisma/client';

export type SaleRequiredDocumentItem = {
  type: DocumentType;
  label: string;
  fulfilled: boolean;
};

const SHARED_SALE_DOCUMENTS: SaleRequiredDocumentItem[] = [
  { type: DocumentType.CPF, label: 'Foto do CPF', fulfilled: false },
  { type: DocumentType.RG, label: 'Foto do RG', fulfilled: false },
];

export const DEFAULT_SALE_REQUIRED_DOCUMENTS: SaleRequiredDocumentItem[] = [
  { type: DocumentType.CHIP_PHOTO, label: 'Foto do chip', fulfilled: false },
  ...SHARED_SALE_DOCUMENTS,
];

export function getRequiredDocumentsForSale(simType: SaleSimType = SaleSimType.CHIP): SaleRequiredDocumentItem[] {
  const activation = simType === SaleSimType.ESIM
    ? { type: DocumentType.DEVICE_SCREEN, label: 'Foto da tela do aparelho', fulfilled: false }
    : { type: DocumentType.CHIP_PHOTO, label: 'Foto do chip', fulfilled: false };
  return [activation, ...SHARED_SALE_DOCUMENTS.map((document) => ({ ...document }))];
}

export function requiredSaleDocumentTypes(simType: SaleSimType = SaleSimType.CHIP): DocumentType[] {
  return getRequiredDocumentsForSale(simType).map((document) => document.type);
}

export function hasSignedContract(
  documents: Array<{ type: DocumentType | string }>,
): boolean {
  return documents.some((document) => document.type === DocumentType.CONTRACT);
}

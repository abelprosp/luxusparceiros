import { DocumentType } from '@prisma/client';

export type SaleRequiredDocumentItem = {
  type: DocumentType;
  label: string;
  fulfilled: boolean;
};

export const DEFAULT_SALE_REQUIRED_DOCUMENTS: SaleRequiredDocumentItem[] = [
  { type: DocumentType.CHIP_PHOTO, label: 'Foto do chip', fulfilled: false },
  { type: DocumentType.CPF, label: 'Foto do CPF', fulfilled: false },
  { type: DocumentType.RG, label: 'Foto do RG', fulfilled: false },
  { type: DocumentType.CONTRACT, label: 'Contrato', fulfilled: false },
];

export function getRequiredDocumentsForSale(isPortability: boolean): SaleRequiredDocumentItem[] {
  return DEFAULT_SALE_REQUIRED_DOCUMENTS.filter(
    (document) => !isPortability || document.type !== DocumentType.CONTRACT,
  ).map((document) => ({ ...document }));
}

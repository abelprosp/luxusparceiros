const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { DocumentType, SaleStatus } = require('@prisma/client');
const { UserRole } = require('@luxus/types');
const { SalesService } = require('../dist/src/modules/sales/sales.service');
const {
  DEFAULT_SALE_REQUIRED_DOCUMENTS,
  getRequiredDocumentsForSale,
  hasSignedContract,
} = require('../dist/src/modules/sales/sale-documents.constants');

describe('documentos obrigatorios da venda', () => {
  it('deixa a assinatura para o Luxus Task e exige somente os documentos cadastrais', () => {
    const documents = getRequiredDocumentsForSale();

    assert.equal(documents.length, 3);
    assert.equal(documents.some((document) => document.type === DocumentType.CONTRACT), false);
  });

  it('reconhece o arquivo de contrato exigido na aprovacao', () => {
    assert.equal(hasSignedContract([]), false);
    assert.equal(hasSignedContract([{ type: DocumentType.CPF }]), false);
    assert.equal(hasSignedContract([{ type: DocumentType.CONTRACT }]), true);
  });

  it('bloqueia a aprovacao direta e obriga completar o envio ao Luxus Task', async () => {
    const service = new SalesService({}, {}, {}, {}, {}, {});
    service.findOne = async () => ({
      id: 'sale-1',
      status: SaleStatus.IN_ANALYSIS,
      documents: [],
      requiredDocuments: [
        { type: DocumentType.CONTRACT, label: 'Contrato', fulfilled: false },
      ],
    });

    await assert.rejects(
      service.updateStatus(
        'sale-1',
        { status: SaleStatus.APPROVED },
        { id: 'admin-1', role: UserRole.ADMIN },
      ),
      /Use a aprovação para o Luxus Task/,
    );
  });

  it('devolve uma copia para evitar mutacao da regra global', () => {
    const documents = getRequiredDocumentsForSale();
    documents[0].fulfilled = true;

    assert.equal(DEFAULT_SALE_REQUIRED_DOCUMENTS[0].fulfilled, false);
  });
});

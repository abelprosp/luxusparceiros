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
  it('mantem o contrato pendente sem bloquear o cadastro inicial', () => {
    const documents = getRequiredDocumentsForSale();

    assert.equal(documents.length, 4);
    assert.ok(documents.some((document) => document.type === DocumentType.CONTRACT));
    assert.equal(
      documents.find((document) => document.type === DocumentType.CONTRACT).fulfilled,
      false,
    );
  });

  it('reconhece o arquivo de contrato exigido na aprovacao', () => {
    assert.equal(hasSignedContract([]), false);
    assert.equal(hasSignedContract([{ type: DocumentType.CPF }]), false);
    assert.equal(hasSignedContract([{ type: DocumentType.CONTRACT }]), true);
  });

  it('bloqueia a aprovacao quando o arquivo de contrato nao existe', async () => {
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
      /Anexe o contrato assinado antes de aprovar a venda/,
    );
  });

  it('devolve uma copia para evitar mutacao da regra global', () => {
    const documents = getRequiredDocumentsForSale();
    documents[0].fulfilled = true;

    assert.equal(DEFAULT_SALE_REQUIRED_DOCUMENTS[0].fulfilled, false);
  });
});

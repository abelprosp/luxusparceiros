const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { DocumentType } = require('@prisma/client');
const {
  DEFAULT_SALE_REQUIRED_DOCUMENTS,
  getRequiredDocumentsForSale,
} = require('../dist/src/modules/sales/sale-documents.constants');

describe('documentos obrigatorios da venda', () => {
  it('exige contrato na venda comum', () => {
    const documents = getRequiredDocumentsForSale(false);

    assert.equal(documents.length, 4);
    assert.ok(documents.some((document) => document.type === DocumentType.CONTRACT));
  });

  it('nao bloqueia o cadastro inicial da portabilidade pelo contrato', () => {
    const documents = getRequiredDocumentsForSale(true);

    assert.equal(documents.length, 3);
    assert.ok(!documents.some((document) => document.type === DocumentType.CONTRACT));
    assert.deepEqual(
      documents.map((document) => document.type),
      [DocumentType.CHIP_PHOTO, DocumentType.CPF, DocumentType.RG],
    );
  });

  it('devolve uma copia para evitar mutacao da regra global', () => {
    const documents = getRequiredDocumentsForSale(false);
    documents[0].fulfilled = true;

    assert.equal(DEFAULT_SALE_REQUIRED_DOCUMENTS[0].fulfilled, false);
  });
});

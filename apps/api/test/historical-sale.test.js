const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  branchDisplayName,
  classifyHistoricalAttachment,
} = require('../dist/src/modules/external-sales/historical-sale.util');

test('filial nova segue o prefixo das filiais que já existem', () => {
  assert.equal(
    branchDisplayName(['META CELL CRUZEIRO', 'META CELL HÍPICA'], 'Lami'),
    'META CELL LAMI',
  );
  assert.equal(branchDisplayName([], 'Lami'), 'LAMI');
});

test('anexos da demanda histórica entram no tipo certo', () => {
  assert.equal(classifyHistoricalAttachment('cnh amanda.jpg').type, 'RG');
  assert.equal(classifyHistoricalAttachment('amanda 2 ass.jpg').type, 'SIGNATURE');
  assert.equal(classifyHistoricalAttachment('contrato 1 amanda.jpg').type, 'CONTRACT');
  assert.equal(classifyHistoricalAttachment('contrato 1 amanda.jpg').purpose, 'SIGNED_CONTRACT');
});

test('a cópia histórica não chama o Luxus Task', () => {
  const source = readFileSync(
    join(__dirname, '../src/modules/external-sales/historical-sales.service.ts'),
    'utf8',
  );
  assert.equal(source.includes('taskIntegration'), false);
  assert.equal(source.includes('createDemand'), false);
  assert.equal(source.includes('pushSaleDocument'), false);
});

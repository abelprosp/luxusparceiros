const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { SaleStatus } = require('@prisma/client');
const { UserRole } = require('@luxus/types');
const { SalesService } = require('../dist/src/modules/sales/sales.service');

function existingSale() {
  return {
    id: 'sale-1',
    status: SaleStatus.IN_ANALYSIS,
    partnerId: 'partner-1',
    branchId: null,
    clientId: 'client-1',
    operatorId: 'operator-1',
    planId: 'plan-1',
    value: 99,
    newNumber: '51999999999',
    client: {
      id: 'client-1',
      name: 'Cliente',
      document: '12345678900',
      phone: '51988888888',
    },
  };
}

describe('edicao da venda', () => {
  it('atualiza os dados do cliente da propria venda', async () => {
    let clientUpdate;
    const prisma = {
      plan: {
        findUnique: async () => ({ id: 'plan-1', operatorId: 'operator-1' }),
      },
      client: {
        update: async (input) => {
          clientUpdate = input;
          return input;
        },
      },
      sale: {
        update: async () => ({ id: 'sale-1' }),
      },
    };
    const audit = { log: async () => undefined };
    const service = new SalesService(prisma, audit, {}, {}, {}, {});
    service.findOne = async () => existingSale();

    await service.update(
      'sale-1',
      {
        client: {
          name: 'Cliente corrigido',
          document: '12345678900',
          phone: '51977777777',
        },
      },
      { id: 'admin-1', role: UserRole.ADMIN },
    );

    assert.equal(clientUpdate.where.id, 'client-1');
    assert.equal(clientUpdate.data.name, 'Cliente corrigido');
    assert.equal(clientUpdate.data.phone, '51977777777');
  });

  it('impede trocar o cliente por um identificador de outra venda', async () => {
    const service = new SalesService({}, {}, {}, {}, {}, {});
    service.findOne = async () => existingSale();

    await assert.rejects(
      service.update(
        'sale-1',
        { clientId: 'client-2' },
        { id: 'admin-1', role: UserRole.ADMIN },
      ),
      /Não é permitido trocar o cliente da venda/,
    );
  });

  it('mantem contato diferente da linha vendida durante a edicao', async () => {
    const service = new SalesService({}, {}, {}, {}, {}, {});
    service.findOne = async () => existingSale();

    await assert.rejects(
      service.update(
        'sale-1',
        {
          client: {
            name: 'Cliente',
            document: '12345678900',
            phone: '(51) 99999-9999',
          },
        },
        { id: 'admin-1', role: UserRole.ADMIN },
      ),
      /Telefone de contato deve ser diferente da linha vendida/,
    );
  });
});

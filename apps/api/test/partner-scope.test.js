const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { ForbiddenException } = require('@nestjs/common');
const { UserRole } = require('@luxus/types');
const {
  assertPartnerAccess,
  isPlatformAdmin,
  resolvePartnerId,
} = require('../dist/src/common/utils/partner-scope');

function user(role, partnerId) {
  return { id: 'user-1', name: 'Teste', email: 'teste@local', role, partnerId };
}

describe('isolamento por parceiro', () => {
  it('mantem administrador vinculado limitado ao proprio parceiro', () => {
    const linkedAdmin = user(UserRole.ADMIN, 'partner-a');

    assert.equal(isPlatformAdmin(linkedAdmin), false);
    assert.equal(resolvePartnerId(linkedAdmin), 'partner-a');
    assert.throws(
      () => resolvePartnerId(linkedAdmin, 'partner-b'),
      ForbiddenException,
    );
    assert.throws(
      () => assertPartnerAccess(linkedAdmin, 'partner-b'),
      ForbiddenException,
    );
  });

  it('permite visao global somente ao administrador sem parceiro', () => {
    const platformAdmin = user(UserRole.ADMIN);

    assert.equal(isPlatformAdmin(platformAdmin), true);
    assert.equal(resolvePartnerId(platformAdmin), undefined);
    assert.equal(resolvePartnerId(platformAdmin, 'partner-b'), 'partner-b');
    assert.doesNotThrow(() => assertPartnerAccess(platformAdmin, 'partner-b'));
  });

  it('impede parceiro comum de consultar outro parceiro', () => {
    const partner = user(UserRole.PARTNER, 'partner-a');

    assert.equal(resolvePartnerId(partner), 'partner-a');
    assert.throws(() => resolvePartnerId(partner, 'partner-b'), ForbiddenException);
  });

  it('permite filtro global ao financeiro sem vinculo comercial', () => {
    const financial = user(UserRole.FINANCIAL);

    assert.equal(resolvePartnerId(financial), undefined);
    assert.equal(resolvePartnerId(financial, 'partner-a'), 'partner-a');
    assert.doesNotThrow(() => assertPartnerAccess(financial, 'partner-a'));
  });
});

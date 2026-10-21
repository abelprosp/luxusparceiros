const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { AuthService } = require('../dist/src/modules/auth/auth.service');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function harness(stored) {
  const calls = { revokedFamilies: [], revokedUsers: 0, audits: [], lookups: [] };
  const prisma = {
    refreshToken: {
      findUnique: async ({ where }) => {
        calls.lookups.push(where.token);
        return stored;
      },
      updateMany: async ({ where }) => {
        const familyId = where.familyId ?? where.OR?.find((item) => item.familyId)?.familyId;
        if (familyId) calls.revokedFamilies.push(familyId);
        if (where.userId) calls.revokedUsers += 1;
        return { count: 1 };
      },
      count: async () => 1,
    },
  };
  const service = new AuthService(
    prisma,
    { sign: () => 'jwt' },
    { get: () => undefined, getOrThrow: () => 'segredo' },
    { log: async (entry) => calls.audits.push(entry) },
    {},
    {},
  );
  return { service, calls };
}

const activeUser = { id: 'user-1', isActive: true, role: 'PARTNER', partnerId: 'p-1', branchId: null, partner: { status: 'ACTIVE' } };

test('refresh procura o token pelo hash, nunca pelo valor puro', async () => {
  const { service, calls } = harness(null);
  await assert.rejects(service.refresh('token-original'));
  assert.deepEqual(calls.lookups, [sha256('token-original')]);
});

test('reuso de refresh token já trocado revoga a família inteira', async () => {
  const { service, calls } = harness({
    id: 'rt-1',
    familyId: 'family-1',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 60_000),
    rotatedAt: new Date(Date.now() - 5 * 60_000),
    revokedAt: new Date(Date.now() - 5 * 60_000),
    user: activeUser,
  });
  await assert.rejects(service.refresh('token-roubado'));
  assert.deepEqual(calls.revokedFamilies, ['family-1']);
  assert.equal(calls.audits[0].newData.reason, 'refresh_token_reuse');
});

test('usuário desativado perde todas as sessões ao tentar renovar', async () => {
  const { service, calls } = harness({
    id: 'rt-2',
    familyId: 'family-2',
    userId: 'user-1',
    expiresAt: new Date(Date.now() + 60_000),
    rotatedAt: null,
    revokedAt: null,
    user: { ...activeUser, isActive: false },
  });
  await assert.rejects(service.refresh('token-valido'));
  assert.equal(calls.revokedUsers, 1);
});

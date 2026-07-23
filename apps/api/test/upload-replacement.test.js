const assert = require('node:assert/strict');
const { afterEach, beforeEach, describe, it } = require('node:test');
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, join } = require('node:path');
const { UserRole } = require('@luxus/types');
const { UploadsService } = require('../dist/src/modules/uploads/uploads.service');

describe('recuperacao de arquivo perdido', () => {
  let directory;
  let updated;
  let document;
  let service;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'luxus-upload-replacement-'));
    updated = null;
    document = {
      id: 'doc-1',
      url: '/uploads/arquivo-perdido.pdf',
      sale: { partnerId: 'partner-1', branchId: 'branch-1' },
      client: null,
      request: null,
      ticket: null,
    };
    const config = {
      get(key) {
        if (key === 'UPLOAD_DIR') return directory;
        if (key === 'UPLOAD_MAX_SIZE') return 10485760;
        return undefined;
      },
    };
    const prisma = {
      document: {
        findUnique: async () => document,
        update: async ({ data }) => {
          updated = data;
          return { ...document, ...data };
        },
      },
    };
    service = new UploadsService(config, prisma);
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  const file = () => ({
    originalname: 'contrato-recuperado.pdf',
    mimetype: 'application/pdf',
    size: 8,
    buffer: Buffer.from('%PDF-1.4'),
  });

  const user = (overrides = {}) => ({
    id: 'user-1',
    role: UserRole.PARTNER,
    partnerId: 'partner-1',
    branchId: 'branch-1',
    permissions: [],
    ...overrides,
  });

  it('mantem o registro e grava um novo arquivo quando o original foi perdido', async () => {
    const result = await service.replaceDocument('doc-1', file(), user());
    const savedFilename = basename(result.url);

    assert.equal(result.id, 'doc-1');
    assert.equal(updated.name, 'contrato-recuperado.pdf');
    assert.equal(updated.mimeType, 'application/pdf');
    assert.equal(updated.uploadedBy, 'user-1');
    assert.equal(existsSync(join(directory, savedFilename)), true);
  });

  it('impede substituir um arquivo que ainda existe', async () => {
    writeFileSync(join(directory, 'arquivo-perdido.pdf'), 'original');

    await assert.rejects(
      service.replaceDocument('doc-1', file(), user()),
      /arquivo original ainda está disponível/,
    );
    assert.equal(updated, null);
  });

  it('impede que outro parceiro recupere o documento', async () => {
    await assert.rejects(
      service.replaceDocument(
        'doc-1',
        file(),
        user({ partnerId: 'partner-2', branchId: undefined }),
      ),
      /Acesso negado/,
    );
    assert.equal(updated, null);
  });
});

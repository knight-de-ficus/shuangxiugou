import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { enforceRollbackState, SCHEMA, signManifest, verifyManifest } from './manifest.mjs';
import { getBrandMark } from '../../src/utils/brand.js';

const keys = generateKeyPairSync('ed25519');
const payload = (sequence = 1) => ({
  schema: SCHEMA,
  siteId: 'shuangxiugou',
  sequence,
  issuedAt: '2026-09-19T00:00:00.000Z',
  expiresAt: '2030-09-19T00:00:00.000Z',
  content: { cid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', entrypoint: 'index.html' },
  previous: null,
  retrieval: { gateways: ['https://edge.example'] },
});

test('品牌标识只保留最后两个有效字符', () => {
  assert.equal(getBrandMark('迪卡侬'), '卡侬');
  assert.equal(getBrandMark('HUAWEI'), 'EI');
  assert.equal(getBrandMark('P.T.G.'), 'TG');
  assert.equal(getBrandMark('蜂花'), '蜂花');
});

test('签名可验证且篡改会被拒绝', () => {
  const document = signManifest(payload(), keys.privateKey);
  assert.equal(verifyManifest(document, keys.publicKey).sequence, 1);
  document.payload.content.entrypoint = 'tampered.html';
  assert.throws(() => verifyManifest(document, keys.publicKey), /签名无效/);
});

test('过期、回滚与同序列分叉会被拒绝', async () => {
  const expired = payload();
  expired.expiresAt = '2026-09-19T00:00:01.000Z';
  const expiredDocument = signManifest(expired, keys.privateKey);
  assert.throws(() => verifyManifest(expiredDocument, keys.publicKey, { now: new Date('2026-09-20T00:00:00.000Z') }), /过期/);

  const directory = await mkdtemp(join(tmpdir(), 'shuangxiugou-resweb-'));
  const state = join(directory, 'state.json');
  const second = signManifest(payload(2), keys.privateKey);
  await enforceRollbackState(second, state);
  await assert.rejects(enforceRollbackState(signManifest(payload(1), keys.privateKey), state), /回滚/);

  const conflict = payload(2);
  conflict.content.entrypoint = 'other.html';
  await assert.rejects(enforceRollbackState(signManifest(conflict, keys.privateKey), state), /分叉/);
});

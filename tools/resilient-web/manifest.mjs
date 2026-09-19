import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import canonicalize from 'canonicalize';

export const SCHEMA = 'urn:shuangxiugou:manifest:v1';
const SIGNING_CONTEXT = 'shuangxiugou-resilient-web-manifest:v1\n';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} 包含未知字段: ${unknown.join(', ')}`);
}

export function validatePayload(payload, { now = new Date(), allowExpired = false } = {}) {
  if (!isObject(payload)) throw new Error('manifest payload 必须是对象');
  exactKeys(payload, ['schema', 'siteId', 'sequence', 'issuedAt', 'expiresAt', 'content', 'previous', 'retrieval'], 'payload');
  if (payload.schema !== SCHEMA) throw new Error(`不支持的 schema: ${payload.schema}`);
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(payload.siteId ?? '')) throw new Error('siteId 非法');
  if (!Number.isSafeInteger(payload.sequence) || payload.sequence < 1) throw new Error('sequence 必须是正安全整数');

  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  if (!Number.isFinite(issued) || new Date(issued).toISOString() !== payload.issuedAt) throw new Error('issuedAt 必须是规范 UTC 时间');
  if (!Number.isFinite(expires) || new Date(expires).toISOString() !== payload.expiresAt) throw new Error('expiresAt 必须是规范 UTC 时间');
  if (expires <= issued) throw new Error('expiresAt 必须晚于 issuedAt');
  if (!allowExpired && now.getTime() > expires) throw new Error('manifest 已过期');

  if (!isObject(payload.content)) throw new Error('content 必须是对象');
  exactKeys(payload.content, ['cid', 'entrypoint'], 'content');
  if (!/^[a-z0-9]{20,128}$/.test(payload.content.cid ?? '')) throw new Error('CID 非法');
  if (typeof payload.content.entrypoint !== 'string' || payload.content.entrypoint.startsWith('/') || payload.content.entrypoint.includes('..') || /[?#\\]/.test(payload.content.entrypoint)) {
    throw new Error('entrypoint 必须是安全相对路径');
  }
  if (payload.previous !== null && payload.previous !== undefined && !/^[a-z0-9]{20,128}$/.test(payload.previous)) {
    throw new Error('previous 必须为空或 manifest CID');
  }
  if (!isObject(payload.retrieval)) throw new Error('retrieval 必须是对象');
  exactKeys(payload.retrieval, ['gateways'], 'retrieval');
  if (!Array.isArray(payload.retrieval.gateways) || payload.retrieval.gateways.length > 16) throw new Error('gateways 最多 16 个');
  for (const raw of payload.retrieval.gateways) {
    const url = new URL(raw);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !local) throw new Error('生产 Gateway 必须使用 HTTPS');
  }
  return payload;
}

function signingBytes(payload) {
  validatePayload(payload, { allowExpired: true });
  const normalized = canonicalize(payload);
  if (normalized === undefined) throw new Error('payload 无法规范化');
  return Buffer.from(SIGNING_CONTEXT + normalized, 'utf8');
}

export function keyId(key) {
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  const der = publicKey.export({ type: 'spki', format: 'der' });
  return `sha256:${createHash('sha256').update(der).digest('base64url')}`;
}

export function signManifest(payload, key) {
  const privateKey = key?.type === 'private' ? key : createPrivateKey(key);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('发布密钥必须是 Ed25519');
  const publicKey = createPublicKey(privateKey);
  return {
    payload,
    signature: {
      alg: 'Ed25519',
      keyId: keyId(publicKey),
      value: cryptoSign(null, signingBytes(payload), privateKey).toString('base64url'),
    },
  };
}

export function verifyManifest(document, key, options = {}) {
  if (!isObject(document)) throw new Error('signed manifest 必须是对象');
  exactKeys(document, ['payload', 'signature'], 'signed manifest');
  validatePayload(document.payload, options);
  if (!isObject(document.signature)) throw new Error('signature 必须是对象');
  exactKeys(document.signature, ['alg', 'keyId', 'value'], 'signature');
  const publicKey = key?.type === 'public' ? key : createPublicKey(key);
  if (publicKey.asymmetricKeyType !== 'ed25519' || document.signature.alg !== 'Ed25519') throw new Error('不支持的签名算法');
  if (document.signature.keyId !== keyId(publicKey)) throw new Error('keyId 与受信公钥不匹配');
  const signature = Buffer.from(document.signature.value ?? '', 'base64url');
  if (signature.length !== 64 || !cryptoVerify(null, signingBytes(document.payload), publicKey, signature)) throw new Error('manifest 签名无效');
  return document.payload;
}

export function manifestDigest(document) {
  return createHash('sha256').update(canonicalize(document)).digest('hex');
}

export async function enforceRollbackState(document, statePath) {
  const { siteId, sequence, issuedAt } = document.payload;
  const digest = manifestDigest(document);
  let state = { sites: {} };
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!isObject(state) || !isObject(state.sites)) throw new Error('回滚状态文件非法');
  const previous = state.sites[siteId];
  if (previous?.sequence > sequence) throw new Error(`检测到回滚: ${sequence} < ${previous.sequence}`);
  if (previous?.sequence === sequence && previous.digest !== digest) throw new Error(`检测到同序列分叉: ${sequence}`);
  if (!previous || sequence > previous.sequence) {
    state.sites[siteId] = { sequence, issuedAt, digest, acceptedAt: new Date().toISOString() };
    await atomicJsonWrite(statePath, state);
  }
  return state.sites[siteId];
}

export async function generateKeyFiles(privatePath, publicPath) {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  await mkdir(dirname(privatePath), { recursive: true });
  await mkdir(dirname(publicPath), { recursive: true });
  await writeFile(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  await writeFile(publicPath, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644, flag: 'wx' });
  if (process.platform !== 'win32') await chmod(privatePath, 0o600);
  return keyId(publicKey);
}

export async function atomicJsonWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

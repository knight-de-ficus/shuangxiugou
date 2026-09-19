#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { atomicJsonWrite, enforceRollbackState, generateKeyFiles, manifestDigest, SCHEMA, signManifest, verifyManifest } from './manifest.mjs';
import { addBytes, addDirectory, pinCid } from './kubo.mjs';

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const [token, inline] = values[index].split('=', 2);
    if (!token.startsWith('--')) throw new Error(`无法识别的参数: ${token}`);
    const name = token.slice(2);
    result[name] = inline ?? values[++index];
  }
  return result;
}

function required(args, name) {
  if (!args[name]) throw new Error(`缺少 --${name}`);
  return args[name];
}

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

async function keygen(args) {
  const privatePath = resolve(args.private ?? 'deploy/resilient/secrets/publisher.private.pem');
  const publicPath = resolve(args.public ?? 'deploy/resilient/secrets/publisher.pub.pem');
  const generatedKeyId = await generateKeyFiles(privatePath, publicPath);
  print({ privatePath, publicPath, keyId: generatedKeyId, warning: '私钥只用于发布端；请离线备份，绝不复制到 Gateway。' });
}

async function publish(args) {
  const directory = resolve(args.site ?? 'dist');
  await access(directory);
  const api = args['kubo-api'] ?? 'http://127.0.0.1:5001';
  const privateKey = await readFile(resolve(args['private-key'] ?? 'deploy/resilient/secrets/publisher.private.pem'), 'utf8');
  const sequence = Number(required(args, 'sequence'));
  const lifetimeHours = Number(args['lifetime-hours'] ?? 720);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('--sequence 必须是正整数');
  if (!Number.isFinite(lifetimeHours) || lifetimeHours <= 0) throw new Error('--lifetime-hours 必须为正数');

  const now = new Date();
  const contentCid = await addDirectory(api, directory);
  const payload = {
    schema: SCHEMA,
    siteId: args['site-id'] ?? 'shuangxiugou',
    sequence,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetimeHours * 3_600_000).toISOString(),
    content: { cid: contentCid, entrypoint: args.entrypoint ?? 'index.html' },
    previous: args.previous ?? null,
    retrieval: { gateways: (args.gateways ?? '').split(',').map((value) => value.trim()).filter(Boolean) },
  };
  const document = signManifest(payload, privateKey);
  const output = resolve(args.output ?? 'deploy/resilient/runtime/current.manifest.json');
  await atomicJsonWrite(output, document);
  const manifestCid = await addBytes(api, await readFile(output));
  print({ output, contentCid, manifestCid, sequence, expiresAt: payload.expiresAt });
}

async function verify(args) {
  const manifestPath = resolve(args.manifest ?? 'deploy/resilient/runtime/current.manifest.json');
  const publicKeyPath = resolve(args['public-key'] ?? 'deploy/resilient/secrets/publisher.pub.pem');
  const document = await readJson(manifestPath);
  const payload = verifyManifest(document, await readFile(publicKeyPath, 'utf8'), { allowExpired: args['allow-expired'] === 'true' });
  if (args.state) await enforceRollbackState(document, resolve(args.state));
  print({ valid: true, siteId: payload.siteId, sequence: payload.sequence, contentCid: payload.content.cid, expiresAt: payload.expiresAt });
}

async function sync(args) {
  const sources = required(args, 'sources').split(',').map((value) => value.trim()).filter(Boolean);
  const publicKey = await readFile(resolve(args['public-key'] ?? 'deploy/resilient/secrets/publisher.pub.pem'), 'utf8');
  const candidates = [];
  const errors = [];
  await Promise.all(sources.map(async (source) => {
    try {
      const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(Number(args['timeout-ms'] ?? 10_000)) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 65_536) throw new Error('manifest 超过 64 KiB');
      const text = await response.text();
      if (Buffer.byteLength(text) > 65_536) throw new Error('manifest 超过 64 KiB');
      const document = JSON.parse(text);
      candidates.push({ source, document, payload: verifyManifest(document, publicKey) });
    } catch (error) {
      errors.push({ source, error: error.message });
    }
  }));
  candidates.sort((a, b) => b.payload.sequence - a.payload.sequence || b.payload.issuedAt.localeCompare(a.payload.issuedAt));
  if (!candidates.length) throw new Error(`没有有效 manifest: ${JSON.stringify(errors)}`);
  const selected = candidates[0];
  const topDigests = new Set(candidates.filter((item) => item.payload.sequence === selected.payload.sequence).map((item) => manifestDigest(item.document)));
  if (topDigests.size > 1) throw new Error(`多个来源在序列 ${selected.payload.sequence} 发生分叉`);

  await pinCid(args['kubo-api'] ?? 'http://127.0.0.1:5001', selected.payload.content.cid);
  const statePath = resolve(args.state ?? 'deploy/resilient/runtime/verification-state.json');
  await enforceRollbackState(selected.document, statePath);
  const output = resolve(args.output ?? 'deploy/resilient/runtime/current.manifest.json');
  await atomicJsonWrite(output, selected.document);
  print({ selected: selected.source, output, sequence: selected.payload.sequence, contentCid: selected.payload.content.cid, sourceErrors: errors });
}

function help() {
  process.stdout.write(`双休购弹性发布工具\n\n` +
    `keygen  [--private PATH] [--public PATH]\n` +
    `publish --sequence N [--site dist] [--previous CID] [--gateways URL,URL]\n` +
    `verify  [--manifest PATH] [--public-key PATH] [--state PATH]\n` +
    `sync    --sources URL,URL [--public-key PATH] [--state PATH] [--output PATH]\n`);
}

const command = process.argv[2];
try {
  const args = parseArgs(process.argv.slice(3));
  if (command === 'keygen') await keygen(args);
  else if (command === 'publish') await publish(args);
  else if (command === 'verify') await verify(args);
  else if (command === 'sync') await sync(args);
  else help();
} catch (error) {
  process.stderr.write(`${JSON.stringify({ level: 'error', command, message: error.message })}\n`);
  process.exitCode = 1;
}

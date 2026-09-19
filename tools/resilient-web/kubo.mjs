import { readFile, readdir } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

async function filesUnder(root, directory = root) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(root, fullPath));
    else if (entry.isFile()) result.push({ fullPath, name: relative(root, fullPath).split(sep).join('/') });
  }
  return result;
}

async function rpc(api, method, params = {}, body) {
  const url = new URL(`/api/v0/${method}`, api);
  for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, String(value));
  const response = await fetch(url, { method: 'POST', body, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Kubo ${method} 失败: HTTP ${response.status} ${await response.text()}`);
  return response;
}

export async function addDirectory(api, directory) {
  const files = await filesUnder(directory);
  if (!files.length) throw new Error('发布目录为空');
  const form = new FormData();
  for (const file of files) form.append('file', new Blob([await readFile(file.fullPath)]), file.name);
  const response = await rpc(api, 'add', { recursive: true, 'wrap-with-directory': true, pin: true, 'cid-version': 1, 'raw-leaves': true }, form);
  const records = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));
  const cid = records.at(-1)?.Hash;
  if (!cid) throw new Error('Kubo 未返回根 CID');
  return cid;
}

export async function addBytes(api, bytes, filename = 'manifest.json') {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: 'application/json' }), basename(filename));
  const response = await rpc(api, 'add', { pin: true, 'cid-version': 1, 'raw-leaves': true }, form);
  const cid = JSON.parse((await response.text()).trim().split('\n').at(-1))?.Hash;
  if (!cid) throw new Error('Kubo 未返回 manifest CID');
  return cid;
}

export async function pinCid(api, cid) {
  await rpc(api, 'pin/add', { arg: cid, recursive: true, progress: false });
}

export async function hasCid(gateway, cid) {
  const response = await fetch(new URL(`/ipfs/${cid}/`, gateway), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8_000) });
  return response.ok || (response.status >= 300 && response.status < 400);
}

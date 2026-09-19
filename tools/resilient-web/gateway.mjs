import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { enforceRollbackState, verifyManifest } from './manifest.mjs';
import { hasCid } from './kubo.mjs';

const config = {
  manifestPath: process.env.MANIFEST_PATH ?? 'deploy/resilient/runtime/current.manifest.json',
  publicKeyPath: process.env.PUBLIC_KEY_PATH ?? 'deploy/resilient/secrets/publisher.pub.pem',
  statePath: process.env.STATE_PATH ?? 'deploy/resilient/runtime/verification-state.json',
  kuboGateway: process.env.KUBO_GATEWAY_URL ?? 'http://127.0.0.1:8080',
  port: Number(process.env.PORT ?? 8787),
};

let current = null;
let lastLoadError = null;
let readiness = { checkedAt: 0, value: false };
const log = (level, event, fields = {}) => process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, event, ...fields })}\n`);

async function loadManifest() {
  try {
    const [raw, publicKey] = await Promise.all([readFile(config.manifestPath, 'utf8'), readFile(config.publicKeyPath, 'utf8')]);
    if (Buffer.byteLength(raw) > 65_536) throw new Error('manifest 超过 64 KiB');
    const document = JSON.parse(raw);
    const payload = verifyManifest(document, publicKey);
    await enforceRollbackState(document, config.statePath);
    if (!current || current.payload.sequence !== payload.sequence) log('info', 'manifest_accepted', { sequence: payload.sequence, cid: payload.content.cid });
    current = { document, payload };
    lastLoadError = null;
    readiness.checkedAt = 0;
  } catch (error) {
    lastLoadError = error.message;
    log('error', 'manifest_rejected', { error: error.message });
  }
}

const manifestFresh = () => current && Date.now() <= Date.parse(current.payload.expiresAt);

async function ready() {
  if (!manifestFresh()) return false;
  if (Date.now() - readiness.checkedAt < 5_000) return readiness.value;
  try { readiness.value = await hasCid(config.kuboGateway, current.payload.content.cid); }
  catch { readiness.value = false; }
  readiness.checkedAt = Date.now();
  return readiness.value;
}

const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);

async function proxy(request, response) {
  if (!manifestFresh()) {
    response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ error: '没有新鲜且已验证的 manifest', detail: lastLoadError }));
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { allow: 'GET, HEAD' });
    response.end();
    return;
  }
  const incoming = new URL(request.url, 'http://gateway.invalid');
  const pathname = incoming.pathname === '/' ? `/${current.payload.content.entrypoint}` : incoming.pathname;
  const upstreamUrl = new URL(`/ipfs/${current.payload.content.cid}${pathname}${incoming.search}`, config.kuboGateway);
  const headers = {};
  for (const name of ['accept', 'accept-encoding', 'if-none-match', 'if-modified-since', 'range']) if (request.headers[name]) headers[name] = request.headers[name];
  try {
    const upstream = await fetch(upstreamUrl, { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const outgoing = {};
    for (const [name, value] of upstream.headers) if (!hopByHop.has(name.toLowerCase())) outgoing[name] = value;
    outgoing['x-resilient-content-cid'] = current.payload.content.cid;
    outgoing['x-resilient-manifest-sequence'] = String(current.payload.sequence);
    outgoing['x-content-type-options'] = 'nosniff';
    response.writeHead(upstream.status, outgoing);
    if (request.method === 'HEAD' || !upstream.body) response.end();
    else Readable.fromWeb(upstream.body).pipe(response);
  } catch (error) {
    log('warn', 'kubo_upstream_failure', { error: error.message, path: incoming.pathname });
    response.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ error: '已验证内容暂时不可用' }));
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/_resilient/healthz') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ live: true }));
  } else if (request.url === '/_resilient/readyz') {
    const value = await ready();
    response.writeHead(value ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ready: value, manifestFresh: Boolean(manifestFresh()), lastLoadError }));
  } else if (request.url === '/_resilient/manifest') {
    response.writeHead(current ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(current?.document ?? { error: '没有已验证 manifest' }));
  } else await proxy(request, response);
});

await loadManifest();
setInterval(loadManifest, 5_000).unref();
server.listen(config.port, '0.0.0.0', () => log('info', 'gateway_listening', { port: config.port }));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));

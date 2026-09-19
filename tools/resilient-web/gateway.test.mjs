import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { SCHEMA, signManifest } from './manifest.mjs';

const listen = (server) => new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => done(server.address().port));
});

function waitForLine(stream, pattern, timeout = 5_000) {
  return new Promise((done, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error(`等待 ${pattern} 超时: ${output}`)), timeout);
    stream.on('data', (chunk) => {
      output += chunk.toString();
      if (pattern.test(output)) {
        clearTimeout(timer);
        done();
      }
    });
  });
}

test('Gateway 只代理签名 manifest 选定的 CID', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'shuangxiugou-gateway-'));
  const keys = generateKeyPairSync('ed25519');
  const cid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
  const document = signManifest({
    schema: SCHEMA,
    siteId: 'shuangxiugou',
    sequence: 7,
    issuedAt: '2026-09-19T00:00:00.000Z',
    expiresAt: '2030-09-19T00:00:00.000Z',
    content: { cid, entrypoint: 'index.html' },
    previous: null,
    retrieval: { gateways: [] },
  }, keys.privateKey);
  const manifestPath = join(directory, 'manifest.json');
  const publicKeyPath = join(directory, 'public.pem');
  await writeFile(manifestPath, JSON.stringify(document));
  await writeFile(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }));

  const seen = [];
  const kubo = http.createServer((request, response) => {
    seen.push(request.url);
    response.writeHead(200, { 'content-type': 'text/html' });
    if (request.method === 'HEAD') response.end();
    else response.end('<h1>verified</h1>');
  });
  const kuboPort = await listen(kubo);
  context.after(() => kubo.close());

  const reservation = http.createServer();
  const gatewayPort = await listen(reservation);
  await new Promise((done) => reservation.close(done));
  const child = spawn(process.execPath, [resolve('tools/resilient-web/gateway.mjs')], {
    env: {
      ...process.env,
      MANIFEST_PATH: manifestPath,
      PUBLIC_KEY_PATH: publicKeyPath,
      STATE_PATH: join(directory, 'state.json'),
      KUBO_GATEWAY_URL: `http://127.0.0.1:${kuboPort}`,
      PORT: String(gatewayPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  context.after(() => child.kill());
  await waitForLine(child.stdout, /gateway_listening/);

  const page = await fetch(`http://127.0.0.1:${gatewayPort}/`);
  assert.equal(page.status, 200);
  assert.equal(await page.text(), '<h1>verified</h1>');
  assert.equal(page.headers.get('x-resilient-content-cid'), cid);
  assert.deepEqual(seen, [`/ipfs/${cid}/index.html`]);

  const post = await fetch(`http://127.0.0.1:${gatewayPort}/submit`, { method: 'POST' });
  assert.equal(post.status, 405);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { request } from 'node:https';
import { publishRelease } from '../scripts/publish.mjs';
import { createUpdateServer } from '../scripts/server.mjs';

async function packageFixture(root, version, data = Buffer.from('fixture-not-an-executable')) {
  const source = path.join(root, 'incoming', version);
  await mkdir(source, { recursive: true });
  const name = `AcessaWorkspace-${version}-Setup.exe`;
  const sha512 = createHash('sha512').update(data).digest('base64');
  await writeFile(path.join(source, name), data);
  await writeFile(path.join(source, name + '.blockmap'), 'fixture');
  await writeFile(path.join(source, 'latest.yml'), `version: ${version}\nfiles:\n  - url: ${name}\n    sha512: ${sha512}\n`);
  return { source, name };
}
test('publicação é imutável, rejeita downgrade/checksum inválido e preserva o manifesto anterior', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'updates-publish-'));
  try {
    const a = await packageFixture(root, '0.5.1');
    await publishRelease(a.source, 'pilot', root);
    const latest = path.join(root, 'public/windows/pilot/latest.yml');
    const original = await readFile(latest, 'utf8');
    await publishRelease(a.source, 'pilot', root);
    await writeFile(path.join(a.source, a.name), 'changed');
    await assert.rejects(publishRelease(a.source, 'pilot', root));
    const older = await packageFixture(root, '0.5.0');
    await assert.rejects(publishRelease(older.source, 'pilot', root), /Downgrade/);
    const b = await packageFixture(root, '0.5.2');
    await writeFile(path.join(b.source, b.name), 'wrong checksum');
    await assert.rejects(publishRelease(b.source, 'pilot', root), /Checksum/);
    assert.equal(await readFile(latest, 'utf8'), original);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('HTTPS atende instalador e Range sem expor incoming, fontes ou listagem', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'updates-https-'));
  let server;
  try {
    const cert = path.join(root, 'cert.pem'), key = path.join(root, 'key.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-keyout', key, '-out', cert], { stdio: 'ignore' });
    const fixture = await packageFixture(root, '0.5.1', Buffer.alloc(500000, 65));
    await publishRelease(fixture.source, 'stable', root);
    server = createUpdateServer({ root: path.join(root, 'public'), cert: await readFile(cert), key: await readFile(key) });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const ca = await readFile(cert);
    const get = (pathname, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
      const actual = request({ hostname: '127.0.0.1', servername: 'localhost', port: server.address().port, path: pathname, ca, headers, method }, (res) => {
        const chunks = []; res.on('data', (chunk) => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      actual.on('error', reject); actual.end();
    });
    const full = await get(`/windows/stable/${fixture.name}`);
    assert.equal(full.status, 200); assert.equal(full.body.length, 500000);
    const partial = await get(`/windows/stable/${fixture.name}`, { Range: 'bytes=10-19' });
    assert.equal(partial.status, 206); assert.equal(partial.body.length, 10);
    assert.equal((await get('/windows/stable/latest.yml')).headers['cache-control'], 'no-store');
    for (const name of ['/', '/incoming/', '/scripts/server.mjs', '/windows/stable/.incoming-secret', '/../package.json']) assert.equal((await get(name)).status, 404);
    assert.equal((await get('/windows/stable/latest.yml', {}, 'POST')).status, 405);
  } finally { if (server) await new Promise((resolve) => server.close(resolve)); await rm(root, { recursive: true, force: true }); }
});

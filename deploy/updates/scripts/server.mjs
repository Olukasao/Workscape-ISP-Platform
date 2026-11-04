import https from 'node:https';
import { readFileSync, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
export function createUpdateServer({ root = defaultRoot, cert, key }) {
const server = https.createServer({ cert, key, minVersion: 'TLSv1.2' }, async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  let url;
  try { url = new URL(req.url, 'https://updates.local'); } catch { res.writeHead(400); res.end(); return; }
  if (!/^\/windows\/(stable|pilot)\/(latest\.yml|AcessaWorkspace-\d+\.\d+\.\d+-Setup\.exe(?:\.blockmap)?)$/.test(url.pathname)) { res.writeHead(404); res.end(); return; }
  const file = path.join(root, url.pathname);
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not file');
    res.setHeader('Cache-Control', file.endsWith('latest.yml') ? 'no-store' : 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', file.endsWith('.yml') ? 'application/yaml' : 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    let start = 0, end = info.size - 1;
    if (req.headers.range) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (!range || (start = Number(range[1])) >= info.size || (end = range[2] ? Number(range[2]) : end) < start || end >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return;
      }
      res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => res.destroy()); stream.pipe(res);
    res.on('close', () => stream.destroy());
  } catch { res.writeHead(404); res.end(); }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { UPDATES_TLS_CERT, UPDATES_TLS_KEY, UPDATES_BIND = '127.0.0.1', UPDATES_PORT = '8643' } = process.env;
  if (!UPDATES_TLS_CERT || !UPDATES_TLS_KEY) throw new Error('Configure UPDATES_TLS_CERT e UPDATES_TLS_KEY. HTTP não é habilitado.');
  const server = createUpdateServer({ cert: readFileSync(UPDATES_TLS_CERT), key: readFileSync(UPDATES_TLS_KEY) });
  server.listen(Number(UPDATES_PORT), UPDATES_BIND, () => console.log(`Atualizações HTTPS em ${UPDATES_BIND}:${UPDATES_PORT}; apenas public/windows é servido.`));
}

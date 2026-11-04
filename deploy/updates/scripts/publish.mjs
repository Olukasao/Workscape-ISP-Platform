import { readFile, mkdir, open, copyFile, link, unlink, rename, stat } from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function publishRelease(sourceArg, channel = 'pilot', root = defaultRoot) {
if (!sourceArg || !['pilot', 'stable'].includes(channel)) throw new Error('Uso: node scripts/publish.mjs /pasta/com/latest.yml [pilot|stable]');
const source = path.resolve(sourceArg), destination = path.join(root, 'public', 'windows', channel);
await mkdir(destination, { recursive: true });
const lockPath = path.join(root, '.publish.lock');
const lock = await open(lockPath, 'wx', 0o600);
const temporary = [];
async function digest(file) {
  const hash = createHash('sha512');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('base64');
}
function versionParts(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Somente versões estáveis são aceitas.');
  return version.split('.').map(BigInt);
}
try {
  const text = await readFile(path.join(source, 'latest.yml'), 'utf8');
  const info = yaml.load(text), candidate = versionParts(info?.version);
  if (!Array.isArray(info.files) || info.files.length !== 1 || info.packages) throw new Error('Manifesto inválido: esperado um instalador NSIS completo.');
  let previous;
  try { previous = yaml.load(await readFile(path.join(destination, 'latest.yml'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous) {
    const before = versionParts(previous.version);
    const differing = candidate.findIndex((part, i) => part !== before[i]);
    if (differing >= 0 && candidate[differing] < before[differing]) throw new Error('Downgrade do canal recusado.');
    if (differing < 0 && JSON.stringify(previous.files) !== JSON.stringify(info.files)) throw new Error('Não substitua uma versão já publicada. Incremente a versão.');
  }
  const file = info.files[0], expectedName = `AcessaWorkspace-${info.version}-Setup.exe`;
  if (file.url !== expectedName || !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)) throw new Error('Nome ou checksum do instalador inválido.');
  async function publishFile(name, expectedHash) {
    const target = path.join(destination, name);
    try {
      await stat(target);
      const original = await digest(path.join(source, name));
      if (await digest(target) !== original || (expectedHash && original !== expectedHash)) throw new Error(`Arquivo imutável divergente: ${name}`);
      return;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temp = path.join(destination, `.incoming-${randomUUID()}`); temporary.push(temp);
    await copyFile(path.join(source, name), temp, constants.COPYFILE_EXCL);
    if (expectedHash && await digest(temp) !== expectedHash) throw new Error('Checksum do instalador não confere.');
    await link(temp, target);
  }
  await publishFile(expectedName, file.sha512);
  await publishFile(`${expectedName}.blockmap`);
  const tempManifest = path.join(destination, `.manifest-${randomUUID()}`); temporary.push(tempManifest);
  const handle = await open(tempManifest, 'wx', 0o644);
  try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
  await rename(tempManifest, path.join(destination, 'latest.yml'));
  console.log(`Versão ${info.version} publicada no canal ${channel}. O manifesto foi atualizado por último.`);
} finally {
  await Promise.all(temporary.map((file) => unlink(file).catch(() => {})));
  await lock.close(); await unlink(lockPath);
}

}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await publishRelease(process.argv[2], process.argv[3]);
}

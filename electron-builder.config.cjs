const fs = require('node:fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync(require('node:path').join(__dirname, 'electron-builder.yml'), 'utf8'));
const feed = process.env.WORKSPACE_UPDATE_URL;
const publisher = process.env.WORKSPACE_UPDATE_PUBLISHER;
const release = process.env.WORKSPACE_RELEASE === '1';
// Sem publicador, o canal é o servidor interno cujo certificado está fixado no app (electron/updateDeployment.ts).
const pinnedOrigin = /updateOrigin = "([^"]+)"/.exec(fs.readFileSync(require('node:path').join(__dirname, 'electron/updateDeployment.ts'), 'utf8'))[1];
if (publisher && !feed) throw new Error('WORKSPACE_UPDATE_PUBLISHER exige WORKSPACE_UPDATE_URL.');
const signed = Boolean(publisher);
if (release && !feed) throw new Error('Release exige WORKSPACE_UPDATE_URL.');
if (release && signed && !(process.env.CSC_LINK || process.env.WIN_CSC_LINK))
  throw new Error('Release assinada exige credenciais de assinatura no ambiente.');
config.publish = null;
config.afterPack = require('node:path').join(__dirname, 'scripts/after-pack-icon.cjs');
if (feed) {
  const url = new URL(feed);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('O canal de atualização exige HTTPS sem credenciais na URL.');
  if (!signed && url.origin !== pinnedOrigin)
    throw new Error('Sem assinatura, o canal deve ser ' + pinnedOrigin + '.');
  config.publish = [{ provider: 'generic', useMultipleRangeRequest: false, url: url.href.endsWith('/') ? url.href : url.href + '/' }];
  if (signed) {
    config.win.signtoolOptions = { publisherName: publisher };
    config.win.verifyUpdateCodeSignature = true;
    // Um build assinado nunca pode criar uma entrega sem assinatura.
    config.forceCodeSigning = true;
  }
}
module.exports = config;

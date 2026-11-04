// Builds locais Linux: usa o leitor oficial do electron-builder para extrair
// o desinstalador gerado pelo template padrão, sem executar um PE via Wine.
// A entrega oficial Windows continua usando o fluxo nativo da ferramenta.
const path = require('node:path');
const { UninstallerReader } = require('app-builder-lib/out/targets/nsis/nsisUtil.js');
const file = path.resolve(process.argv[2] || '');
const root = path.resolve(process.env.WORKSPACE_NSIS_EXTRACT_ROOT || 'release');
if (!file.startsWith(root + path.sep) || !file.endsWith('-Setup.exe')) {
  throw new Error('O extrator só aceita o stub NSIS de setup dentro da pasta de build.');
}
const output = path.join(path.dirname(file), `${path.basename(file, 'exe')}__uninstaller.exe`);
UninstallerReader.exec(file, output).catch((error) => { console.error(error.message); process.exitCode = 1; });

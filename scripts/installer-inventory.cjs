const fs = require('node:fs/promises');
const path = require('node:path');
// O helper verifica arquivos antes de o NSIS padrão desinstalar a versão antiga.
module.exports = async (context) => {
  if (context.electronPlatformName !== 'win32') return;
  const files = [];
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else files.push(path.relative(context.appOutDir, file).split(path.sep).join('\\'));
    }
  }
  await walk(context.appOutDir);
  const buildDir = path.join(context.packager.projectDir, 'build');
  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(path.join(buildDir, 'update-files.json'), JSON.stringify(files));
};

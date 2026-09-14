const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }
  const target = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'sqlite3',
    'build',
    'Release',
    'node_sqlite3.node'
  );
  const source = path.join(
    __dirname,
    '..',
    'electron',
    'assets',
    'win',
    'node_sqlite3.node'
  );
  if (!fs.existsSync(source)) {
    throw new Error(`[afterPack] Prebuild Windows introuvable : ${source}`);
  }
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.copyFile(source, target);
  console.log(`[afterPack] sqlite3 remplacé par la version Windows (win32-x64)`);
};
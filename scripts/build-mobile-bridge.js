const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { version } = require('../package.json');

function buildBridge(outfile) {
  fs.mkdirSync(path.dirname(outfile), { recursive: true });
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, '..', 'mobile', 'bridge', 'entry.js')],
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    outfile,
    define: { __APP_VERSION__: JSON.stringify(version) },
    minify: true,
    legalComments: 'none'
  });
  return outfile;
}

if (require.main === module) {
  const out = path.join(__dirname, '..', 'mobile-web', 'english-anki-web.js');
  buildBridge(out);
  console.log(`bridge 构建完成: ${out}`);
}

module.exports = { buildBridge };
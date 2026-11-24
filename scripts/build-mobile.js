const fs = require('node:fs');
const path = require('node:path');
const { buildBridge } = require('./build-mobile-bridge');

const ROOT = path.join(__dirname, '..');
const RENDERER = path.join(ROOT, 'renderer');
const OUT = path.join(ROOT, 'mobile-web');
const SCENES_CACHE = path.join(ROOT, 'build', 'mobile-scenes');
const SCENES_SRC = path.join(RENDERER, 'assets', 'memory-scenes');

const FORCE_FILES = ['app.js', 'styles.css', 'aurora-theme.css', 'home-refinement.css'];

function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : fs.statSync(full).size;
  }
  return total;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function copyDir(src, dest, { force = false } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to, { force });
    } else if (force || !fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
}

function main() {
  const startedAt = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  for (const file of FORCE_FILES) {
    fs.copyFileSync(path.join(RENDERER, file), path.join(OUT, file));
  }
  fs.copyFileSync(path.join(ROOT, 'mobile', 'mobile.css'), path.join(OUT, 'mobile.css'));
  fs.copyFileSync(path.join(ROOT, 'mobile', 'mobile-enhance.js'), path.join(OUT, 'mobile-enhance.js'));
  fs.copyFileSync(path.join(ROOT, 'mobile', 'ipa-subset.woff2'), path.join(OUT, 'ipa-subset.woff2'));

  let sourceHtml = fs.readFileSync(path.join(RENDERER, 'index.html'), 'utf8');
  sourceHtml = sourceHtml.replace(
    'content="width=device-width, initial-scale=1.0"',
    'content="width=device-width, initial-scale=1.0, viewport-fit=cover"'
  );
  sourceHtml = sourceHtml.replace(
    '    <link rel="stylesheet" href="home-refinement.css" />',
    '    <link rel="stylesheet" href="home-refinement.css" />\n    <link rel="stylesheet" href="mobile.css" />'
  );
  sourceHtml = sourceHtml.replace(
    '    <script src="data/word-audio-index.js"></script>',
    '    <script src="mobile-enhance.js"></script>\n    <script src="data/word-audio-index.js"></script>'
  );
  if (!sourceHtml.includes('english-anki-web.js')) {
    const marker = '    <script src="mobile-enhance.js"></script>\n    <script src="data/word-audio-index.js"></script>';
    if (!sourceHtml.includes(marker)) throw new Error('index.html 中未找到注入点');
    sourceHtml = sourceHtml.replace(marker, `    <script src="english-anki-web.js"></script>\n${marker}`);
  }
  fs.writeFileSync(path.join(OUT, 'index.html'), sourceHtml);

  copyDir(path.join(RENDERER, 'data'), path.join(OUT, 'data'), { force: true });

  const scenesSource = fs.existsSync(SCENES_CACHE) && fs.readdirSync(SCENES_CACHE).length ? SCENES_CACHE : SCENES_SRC;
  if (scenesSource === SCENES_SRC) {
    console.warn('未找到压缩场景图缓存，本次使用原图（体积很大）。请先运行 npm run mobile:scenes');
  }
  copyDir(scenesSource, path.join(OUT, 'assets', 'memory-scenes'));

  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const file of ['theme-dark.jpg', 'app-icon.svg']) {
    fs.copyFileSync(path.join(RENDERER, 'assets', file), path.join(OUT, 'assets', file));
  }

  copyDir(path.join(RENDERER, 'audio'), path.join(OUT, 'audio'));

  buildBridge(path.join(OUT, 'english-anki-web.js'));

  const total = dirSize(OUT);
  console.log(`webDir 组装完成: ${OUT}`);
  console.log(`  总大小 ${mb(total)}（assets ${mb(dirSize(path.join(OUT, 'assets')))}，audio ${mb(dirSize(path.join(OUT, 'audio')))}），耗时 ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
}

main();
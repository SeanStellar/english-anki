const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'renderer', 'assets', 'memory-scenes');
const DEST = path.join(__dirname, '..', 'build', 'mobile-scenes');
const MAX_WIDTH = 720;
const QUALITY = 62;
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length - 2));
const force = process.argv.includes('--force');

function dirSize(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir)) {
    const stat = fs.statSync(path.join(dir, entry));
    if (stat.isFile()) total += stat.size;
  }
  return total;
}

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const sharp = require('sharp');
  if (!fs.existsSync(SRC)) throw new Error(`场景图目录不存在: ${SRC}`);
  fs.mkdirSync(DEST, { recursive: true });

  const files = fs.readdirSync(SRC).filter(name => /\.webp$/i.test(name));
  const pending = force ? files : files.filter(name => !fs.existsSync(path.join(DEST, name)));
  console.log(`场景图共 ${files.length} 张，本次待处理 ${pending.length} 张（输出 ${DEST}）`);

  if (pending.length) {
    const sample = await sharp(path.join(SRC, files[0])).metadata();
    console.log(`样例尺寸: ${sample.width}x${sample.height}，目标宽度 <= ${MAX_WIDTH}px，质量 ${QUALITY}`);
  }

  const queue = [...pending];
  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  async function worker() {
    while (queue.length) {
      const name = queue.shift();
      const src = path.join(SRC, name);
      const dest = path.join(DEST, name);
      try {
        await sharp(src)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .webp({ quality: QUALITY, effort: 4 })
          .toFile(dest);
      } catch (error) {
        failed += 1;
        try {
          fs.copyFileSync(src, dest);
        } catch {}
        console.warn(`处理失败，已复制原图: ${name} (${error.message})`);
      }
      done += 1;
      if (done % 500 === 0 || done === pending.length) {
        console.log(`进度 ${done}/${pending.length}（${((Date.now() - startedAt) / 1000).toFixed(0)}s）`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const before = dirSize(SRC);
  const after = dirSize(DEST);
  console.log(`完成：${mb(before)} -> ${mb(after)}（${((after / before) * 100).toFixed(0)}%），失败 ${failed}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
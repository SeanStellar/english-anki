const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'renderer', 'assets', 'memory-scenes');
const width = 800;
const height = 600;
const quality = 84;
const concurrency = Math.max(1, Math.min(8, Number(process.env.IMAGE_CONCURRENCY) || 4));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function renameWithRetry(from, to) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      if (attempt === 7) throw error;
      await sleep(100 + attempt * 100);
    }
  }
}

async function optimize(file) {
  const full = path.join(dir, file);
  const before = fs.statSync(full).size;
  const metadata = await sharp(full).metadata();
  if (metadata.width <= width && metadata.height <= height) return { skipped: true, before, after: before };
  const temp = `${full}.tmp.webp`;
  await sharp(full, { failOn: 'none' })
    .resize(width, height, { fit: 'cover' })
    .webp({ quality, effort: 5 })
    .toFile(temp);
  const after = fs.statSync(temp).size;
  if (!after) throw new Error(`empty output: ${file}`);
  await renameWithRetry(temp, full);
  return { skipped: false, before, after };
}

(async () => {
  const files = fs.readdirSync(dir).filter(file => /\.webp$/i.test(file)).sort();
  if (!files.length) throw new Error('no images found');
  let before = 0;
  let after = 0;
  let optimized = 0;
  let skipped = 0;
  const failures = [];
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      try {
        const result = await optimize(file);
        before += result.before;
        after += result.after;
        if (result.skipped) skipped += 1;
        else optimized += 1;
        if (optimized && optimized % 250 === 0) console.log(`optimized ${optimized}/${files.length}`);
      } catch (error) {
        failures.push(`${file}: ${error.message}`);
      }
    }
  });
  await Promise.all(workers);
  console.log(`images: ${files.length}, optimized: ${optimized}, skipped: ${skipped}, failed: ${failures.length}`);
  console.log(`bytes: ${before} -> ${after} (${(100 - after / before * 100).toFixed(1)}% smaller)`);
  if (failures.length) {
    console.error(failures.slice(0, 10).join('\n'));
    process.exitCode = 1;
  }
})();

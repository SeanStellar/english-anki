const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const dir = path.join(__dirname, '..', 'renderer', 'assets', 'memory-scenes');
const files = fs.readdirSync(dir).filter(file => file.endsWith('.webp')).sort();
const hashes = new Map();
const bad = [];
let smallest = null;
let largest = null;

(async () => {
  const concurrency = 8;
  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++];
      const full = path.join(dir, file);
      const size = fs.statSync(full).size;
      const metadata = await sharp(full).metadata();
      if (metadata.width !== 800 || metadata.height !== 600) bad.push({ file, width: metadata.width, height: metadata.height });
      const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
      if (!hashes.has(hash)) hashes.set(hash, []);
      hashes.get(hash).push(file);
      if (!smallest || size < smallest.size) smallest = { file, size };
      if (!largest || size > largest.size) largest = { file, size };
    }
  });
  await Promise.all(workers);
  const duplicateGroups = [...hashes.values()].filter(group => group.length > 1);
  console.log(JSON.stringify({
    images: files.length,
    badDimensions: bad.length,
    badSample: bad.slice(0, 10),
    duplicateGroups: duplicateGroups.length,
    duplicateSample: duplicateGroups.slice(0, 5),
    smallest,
    largest
  }, null, 2));
})();

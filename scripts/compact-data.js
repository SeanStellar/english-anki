const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'renderer', 'data');
const overridesFile = path.join(dataDir, 'memory-stories-v3-overrides.json');
const compactFiles = [
  path.join(dataDir, 'hebei-3000.json'),
  path.join(dataDir, 'memory-stories.json')
];

function compactStory(story) {
  const result = {};
  ['id', 'word', 'anchor', 'anchorMeaning', 'sentence', 'storyKey'].forEach(key => {
    if (story[key] !== undefined) result[key] = story[key];
  });
  if (story.scene && Array.isArray(story.scene.props)) result.scene = { props: story.scene.props };
  if (story.review && story.review.reason !== undefined) result.review = { reason: story.review.reason };
  if (story.illustration && story.illustration.file) result.illustration = { file: story.illustration.file };
  return result;
}

function assertSame(label, left, right) {
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error(`Data mismatch: ${label}`);
}

const originalBytes = fs.statSync(overridesFile).size;
const payload = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
const cards = (payload.cards || []).map(compactStory);
const byId = new Map(cards.map(card => [card.id, card]));
for (const source of payload.cards || []) {
  const next = byId.get(source.id);
  if (!next) throw new Error(`Missing story: ${source.id}`);
  ['id', 'word', 'anchor', 'anchorMeaning', 'sentence', 'storyKey'].forEach(key => assertSame(`${source.id}.${key}`, source[key], next[key]));
  assertSame(`${source.id}.scene.props`, source.scene?.props, next.scene?.props);
  assertSame(`${source.id}.review.reason`, source.review?.reason, next.review?.reason);
  assertSame(`${source.id}.illustration.file`, source.illustration?.file, next.illustration?.file);
}
const output = { ...payload, cards };
fs.writeFileSync(overridesFile, JSON.stringify(output));

for (const file of compactFiles) {
  const source = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = fs.statSync(file).size;
  fs.writeFileSync(file, JSON.stringify(source));
  console.log(`${path.basename(file)}: ${before} -> ${fs.statSync(file).size} bytes`);
}
const finalBytes = fs.statSync(overridesFile).size;
console.log(`memory-stories-v3-overrides.json: ${originalBytes} -> ${finalBytes} bytes (${(100 - finalBytes / originalBytes * 100).toFixed(0)}% smaller)`);

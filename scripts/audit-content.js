const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'renderer', 'data');
const words = JSON.parse(fs.readFileSync(path.join(dataDir, 'zhuanshengben-3000.json'), 'utf8'));
const base = new Map((JSON.parse(fs.readFileSync(path.join(dataDir, 'memory-stories.json'), 'utf8')).cards || []).map(card => [card.id, card]));
const overrides = new Map((JSON.parse(fs.readFileSync(path.join(dataDir, 'memory-stories-v3-overrides.json'), 'utf8')).cards || []).map(card => [card.id, card]));

const buckets = Array.from({ length: 6 }, (_, index) => ({ range: `${index * 500 + 1}-${(index + 1) * 500}`, total: 0, short24: 0, short20: 0 }));
const missing = { sentence: [], anchor: [], target: [], image: [] };
const duplicateSentences = new Map();
const suspicious = [];

words.forEach((word, index) => {
  const storyBase = base.get(word.id) || {};
  const story = overrides.get(word.id) || {};
  const sentence = String(story.sentence || storyBase.sentence || '');
  const anchor = story.anchor || storyBase.anchor || '';
  const target = story.word || storyBase.word || word.word;
  const length = [...sentence.replace(/\s/g, '')].length;
  const bucket = buckets[Math.min(buckets.length - 1, Math.floor(index / 500))];
  bucket.total += 1;
  if (length < 24) bucket.short24 += 1;
  if (length < 20) bucket.short20 += 1;
  if (!sentence) missing.sentence.push(word.id);
  if (!anchor) missing.anchor.push(word.id);
  if (!target) missing.target.push(word.id);
  const image = path.join(__dirname, '..', 'renderer', 'assets', 'memory-scenes', `${word.id}.webp`);
  if (!fs.existsSync(image)) missing.image.push(word.id);
  if (sentence) duplicateSentences.set(sentence, (duplicateSentences.get(sentence) || 0) + 1);
  if (length < 22 && /^[a-zA-Z]+\s/.test(sentence)) suspicious.push({ id: word.id, word: word.word, sentence });
});

const duplicates = [...duplicateSentences.entries()].filter(([, count]) => count > 1).map(([sentence, count]) => ({ sentence, count }));
console.log(JSON.stringify({
  cards: words.length,
  buckets,
  missing: Object.fromEntries(Object.entries(missing).map(([key, value]) => [key, value.length])),
  duplicateSentences: duplicates.length,
  suspicious: suspicious.length,
  suspiciousSample: suspicious.slice(0, 20)
}, null, 2));

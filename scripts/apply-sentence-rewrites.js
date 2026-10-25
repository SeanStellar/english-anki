const fs = require('node:fs');
const path = require('node:path');

const mappingFile = process.argv[2];
if (!mappingFile) throw new Error('usage: node scripts/apply-sentence-rewrites.js <mapping.json>');
const dataFile = path.join(__dirname, '..', 'renderer', 'data', 'memory-stories-v3-overrides.json');
const mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
const payload = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const cards = new Map((payload.cards || []).map(card => [card.id, card]));
let applied = 0;
for (const [id, sentence] of Object.entries(mapping)) {
  const card = cards.get(id);
  if (!card) throw new Error(`missing card ${id}`);
  if (typeof sentence !== 'string' || sentence.length < 24) throw new Error(`invalid sentence ${id}`);
  card.sentence = sentence;
  applied += 1;
}
fs.writeFileSync(dataFile, JSON.stringify(payload));
console.log(`applied ${applied} sentence rewrites`);

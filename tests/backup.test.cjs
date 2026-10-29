const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isLearningData, createBackupEnvelope, inspectBackupPayload } = require('../backup-utils');
const { loadFunctions } = require('./load-renderer-functions.cjs');
const renderer = loadFunctions(['isPlainObject', 'validImportedLearningData']);
const valid = () => ({ version: 4, settings: {}, cards: { a: { reps: 1, due: '2026-10-28T00:00:00Z' } }, logs: [{ wordId: 'a', date: '2026-10-28' }], customWords: [], customDecks: [] });
test('backup round-trip preserves all learning data and verifies checksum', () => {
  const data=valid(),backup=createBackupEnvelope(data);const result=inspectBackupPayload(backup);
  assert.equal(result.valid,true);assert.equal(result.integrity,'verified');assert.deepEqual(result.data,data);assert.equal(result.meta.learned,1);
});
test('tampered backup is rejected', () => {
  const backup=createBackupEnvelope(valid());backup.data.cards.a.reps=3;assert.equal(inspectBackupPayload(backup).valid,false);
});
test('supported unwrapped legacy versions remain readable', () => {
  for(const version of [1,2,3,4]){let data={...valid(),version};assert.equal(inspectBackupPayload(data).valid,true);assert.equal(inspectBackupPayload(data).integrity,'legacy');}
});
test('renderer import and main process reject malformed records consistently', () => {
  const examples=[null,{}, {...valid(),version:99}, {...valid(),settings:[]}, {...valid(),cards:null}, {...valid(),cards:[]}, {...valid(),cards:{a:null}}, {...valid(),cards:{a:{reps:1,due:'not a date'}}}, {...valid(),logs:[null]}, {...valid(),customWords:[null]}, {...valid(),cardFlags:[]}];
  for(const data of examples){assert.equal(isLearningData(data),false,JSON.stringify(data));assert.equal(renderer.validImportedLearningData(data),false,JSON.stringify(data));assert.equal(inspectBackupPayload(data).valid,false);}
  assert.equal(isLearningData(valid()),true);assert.equal(renderer.validImportedLearningData(valid()),true);
});

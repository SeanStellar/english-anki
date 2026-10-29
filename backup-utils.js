const crypto = require('node:crypto');

const BACKUP_FORMAT = 'english-anki-backup-v2';

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Versions 1–4 are supported by the renderer's migration path. Validate before
// accepting a backup or sync payload so normalization cannot silently erase it.
function isLearningData(data) {
  if (!isPlainRecord(data) || ![1, 2, 3, 4].includes(data.version)
      || !isPlainRecord(data.settings) || !isPlainRecord(data.cards)
      || !Array.isArray(data.logs) || !data.logs.every(isPlainRecord)) return false;
  for (const card of Object.values(data.cards)) {
    if (!isPlainRecord(card)) return false;
    if (card.reps !== undefined && (!Number.isFinite(Number(card.reps)) || Number(card.reps) < 0)) return false;
    if (Number(card.reps) > 0 && (card.due == null || card.due === '' || !Number.isFinite(new Date(card.due).getTime()))) return false;
  }
  for (const key of ['customWords', 'customDecks', 'cardIssues']) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || !data[key].every(isPlainRecord))) return false;
  }
  for (const key of ['wordOverrides', 'cardFlags', 'keywordStats', 'keywordProfile', 'fsrsProfile']) {
    if (data[key] !== undefined && !isPlainRecord(data[key])) return false;
  }
  return true;
}

function checksumFor(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function createBackupEnvelope(data, createdAt = new Date().toISOString()) {
  if (!isLearningData(data)) throw new Error('Invalid learning data');
  return {
    format: BACKUP_FORMAT,
    createdAt,
    checksum: checksumFor(data),
    data
  };
}

function inspectBackupPayload(payload) {
  const wrapped = payload?.format === BACKUP_FORMAT;
  const data = wrapped ? payload.data : payload;
  const schemaValid = isLearningData(data);
  const checksumValid = wrapped && schemaValid && payload.checksum === checksumFor(data);
  const valid = schemaValid && (!wrapped || checksumValid);
  const learned = valid ? Object.values(data.cards || {}).filter(card => card?.reps).length : 0;
  return {
    valid,
    integrity: wrapped ? (checksumValid ? 'verified' : 'failed') : (schemaValid ? 'legacy' : 'failed'),
    data: valid ? data : null,
    meta: {
      version: valid ? Number(data.version) || 0 : 0,
      learned,
      reviews: valid ? data.logs.length : 0,
      customWords: valid ? (data.customWords || []).length : 0,
      createdAt: wrapped ? payload.createdAt || '' : ''
    }
  };
}

module.exports = { BACKUP_FORMAT, createBackupEnvelope, inspectBackupPayload, checksumFor, isLearningData };

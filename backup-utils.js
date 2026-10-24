const crypto = require('node:crypto');

const BACKUP_FORMAT = 'english-anki-backup-v2';

function isLearningData(data) {
  return !!data && typeof data === 'object' && !!data.settings && typeof data.cards === 'object' && Array.isArray(data.logs);
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

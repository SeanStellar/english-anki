const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createBackupEnvelope, inspectBackupPayload, checksumFor } = require('../backup-utils');
const { compareVersions, syncStateFor } = require('../integration-utils');

function learningData(overrides = {}) {
  return {
    version: 4,
    settings: { theme: 'light' },
    cards: { a: { reps: 2 } },
    logs: [{ wordId: 'a', rating: 'good' }],
    customWords: [],
    ...overrides
  };
}

test('backup envelope verifies and rejects tampered payloads', () => {
  const data = learningData();
  const envelope = createBackupEnvelope(data, '2026-10-24T00:00:00.000Z');
  const valid = inspectBackupPayload(envelope);
  assert.equal(valid.valid, true);
  assert.equal(valid.integrity, 'verified');
  assert.equal(valid.meta.learned, 1);
  assert.equal(valid.meta.reviews, 1);

  const tampered = { ...envelope, data: { ...data, cards: {} } };
  assert.equal(inspectBackupPayload(tampered).valid, false);
  assert.equal(inspectBackupPayload(tampered).integrity, 'failed');
  assert.equal(checksumFor(data), envelope.checksum);
});

test('legacy plain learning data is accepted but marked legacy', () => {
  const result = inspectBackupPayload(learningData());
  assert.equal(result.valid, true);
  assert.equal(result.integrity, 'legacy');
});

test('sync state handles a fresh device with cloud data', () => {
  assert.equal(syncStateFor({
    configured: true,
    remoteExists: true,
    remoteValid: true,
    localExists: false,
    localChecksum: '',
    remoteChecksum: 'remote',
    lastSyncChecksum: ''
  }), 'remote-newer');
});

test('sync state keeps conflict protection for changed local and remote data', () => {
  const common = { configured: true, remoteExists: true, remoteValid: true, localExists: true };
  assert.equal(syncStateFor({ ...common, localChecksum: 'old', remoteChecksum: 'new', lastSyncChecksum: 'old' }), 'remote-newer');
  assert.equal(syncStateFor({ ...common, localChecksum: 'new', remoteChecksum: 'old', lastSyncChecksum: 'old' }), 'local-newer');
  assert.equal(syncStateFor({ ...common, localChecksum: 'local', remoteChecksum: 'remote', lastSyncChecksum: 'old' }), 'conflict');
  assert.equal(syncStateFor({ ...common, localChecksum: 'same', remoteChecksum: 'same', lastSyncChecksum: 'old' }), 'synced');
});

test('version comparison follows numeric components', () => {
  assert.equal(compareVersions('4.0.1', '4.0.0'), 1);
  assert.equal(compareVersions('v4.0.1', '4.0.1'), 0);
  assert.equal(compareVersions('3.9.9', '4.0.0'), -1);
});

test('shipped story overrides keep fields used by the renderer', () => {
  const file = path.join(__dirname, '..', 'renderer', 'data', 'memory-stories-v3-overrides.json');
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(payload.cards.length, 3000);
  for (const card of payload.cards) {
    assert.ok(card.id);
    if (card.sentence) assert.equal(typeof card.sentence, 'string');
    if (card.scene) assert.ok(Array.isArray(card.scene.props));
    if (card.review) assert.equal(typeof card.review.reason, 'string');
  }
});

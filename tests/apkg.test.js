const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const JSZip = require('jszip');
const initSqlJs = require('sql.js');
const { MODEL_FIELDS, MODEL_NAME, buildApkg, mediaFileName } = require('../apkg-export');

const root = path.join(__dirname, '..');

test('buildApkg creates an Anki package with fields, cards and media', async () => {
  const mediaDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'english-anki-apkg-'));
  const imageSource = path.join(root, 'renderer', 'assets', 'memory-scenes', 'hb-0001-a.webp');
  fs.copyFileSync(imageSource, path.join(mediaDirectory, 'hb-0001-a.webp'));
  try {
    const exported = await buildApkg({
      deckName: '测试词库',
      mediaDirectory,
      cards: [
        {
          id: 'hb-0001-a',
          word: 'a',
          phonetic: '/ə, eɪ/',
          pos: 'art.',
          meaning: '一（个）',
          anchor: 'bag',
          anchorMeaning: '袋子',
          story: '售货员从 bag 里只拿出一支铅笔。',
          memory: 'bag 含字母 a。',
          imageId: 'hb-0001-a'
        },
        { id: 'hb-0002', word: 'test', meaning: '测试', imageId: 'missing-image' }
      ]
    });
    assert.equal(exported.noteCount, 2);
    assert.equal(exported.mediaCount, 1);
    assert.equal(exported.missingMedia, 1);
    assert.ok(Buffer.isBuffer(exported.buffer));

    const zip = await JSZip.loadAsync(exported.buffer);
    assert.ok(zip.file('collection.anki2'));
    assert.ok(zip.file('media'));
    assert.ok(zip.file('0'));
    const manifest = JSON.parse(await zip.file('media').async('string'));
    assert.deepEqual(Object.values(manifest), ['englishanki-hb-0001-a.webp']);
    const mediaBytes = await zip.file('0').async('nodebuffer');
    assert.deepEqual(mediaBytes, fs.readFileSync(imageSource));

    const SQL = await initSqlJs({
      wasmBinary: fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
    });
    const db = new SQL.Database(await zip.file('collection.anki2').async('uint8array'));
    try {
      const notes = db.exec('SELECT flds, tags FROM notes ORDER BY rowid')[0].values;
      assert.equal(notes.length, 2);
      const firstFields = notes[0][0].split('\u001f');
      assert.equal(firstFields.length, MODEL_FIELDS.length);
      assert.equal(firstFields[0], 'a');
      assert.equal(firstFields[3], '一（个）');
      assert.match(firstFields[10], /englishanki-hb-0001-a\.webp/);
      assert.match(notes[0][1], /英语Anki/);
      assert.equal(notes[1][0].split('\u001f')[10], '');
      assert.equal(db.exec('SELECT COUNT(*) FROM cards')[0].values[0][0], 2);

      const models = JSON.parse(db.exec('SELECT models FROM col')[0].values[0][0]);
      const model = Object.values(models)[0];
      assert.equal(model.name, MODEL_NAME);
      assert.deepEqual(model.flds.map(field => field.name), MODEL_FIELDS);
      assert.equal(model.tmpls.length, 1);
      assert.match(model.tmpls[0].qfmt, /\{\{单词\}\}/);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(mediaDirectory, { recursive: true, force: true });
  }
});

test('buildApkg rejects empty decks and path-like image IDs', async () => {
  await assert.rejects(() => buildApkg({ deckName: '空词库', cards: [] }), /没有单词/);
  await assert.rejects(() => buildApkg({ deckName: '坏词库', cards: [{ id: 'x', word: '' }] }), /缺少单词/);
  assert.equal(mediaFileName('../x'), '');
  assert.equal(mediaFileName('hb-0001-a'), 'englishanki-hb-0001-a.webp');
});

const fs = require('node:fs');
const path = require('node:path');
const { AnkiExport } = require('anki-apkg-export');

const MODEL_ID = 1867520311;
const MODEL_NAME = '英语 Anki 记忆卡';
const MODEL_FIELDS = ['单词', '音标', '词性', '释义', '熟词', '熟词释义', '联想句', '例句', '例句翻译', '记忆提示', '插图'];

const MODEL_CSS = `
.card {
  margin: 0;
  padding: 0;
  background: #f4f4ee;
  color: #14231e;
  font-family: "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif;
  text-align: left;
}
.ea-card {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 30px 26px;
  background: #fffefa;
  border: 1px solid rgba(18, 43, 34, 0.12);
  border-radius: 20px;
}
.ea-kicker {
  color: #1da779;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
}
.ea-word {
  margin: 12px 0 4px;
  color: #0b5b44;
  font-size: 44px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -1.5px;
}
.ea-sub {
  color: #78847e;
  font-size: 14px;
}
.ea-pos {
  display: inline-block;
  margin-left: 6px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #dcf1e6;
  color: #0b5b44;
  font-size: 11px;
}
.ea-art {
  margin: 18px 0;
  overflow: hidden;
  border-radius: 14px;
  background: #e9ece5;
}
.ea-art img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: cover;
}
.ea-prompt {
  margin-top: 18px;
  color: #78847e;
  font-size: 11px;
  text-align: center;
}
hr#answer {
  max-width: 720px;
  margin: 18px auto;
  border: 0;
  border-top: 1px solid rgba(18, 43, 34, 0.12);
}
.ea-back {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 4px;
  color: #14231e;
  font-family: "Segoe UI", "Microsoft YaHei UI", system-ui, sans-serif;
}
.ea-meaning {
  margin: 4px 0 16px;
  color: #0b5b44;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
}
.ea-block {
  margin: 12px 0;
  padding: 13px 15px;
  border-left: 3px solid #1da779;
  border-radius: 0 10px 10px 0;
  background: #f4f8f3;
}
.ea-label {
  display: block;
  margin-bottom: 5px;
  color: #1da779;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
}
.ea-block p {
  margin: 3px 0;
  font-size: 15px;
  line-height: 1.65;
}
.ea-block .ea-translation {
  color: #78847e;
  font-size: 13px;
}
.ea-anchor {
  color: #0b5b44;
  font-size: 16px;
  font-weight: 600;
}
.ea-anchor span {
  color: #78847e;
  font-size: 13px;
  font-weight: 400;
}
.ea-foot {
  margin-top: 20px;
  color: #9aa49f;
  font-size: 10px;
  text-align: center;
}
.nightMode .card, .night_mode .card {
  background: #07110e;
  color: #edf8f3;
}
.nightMode .ea-card, .night_mode .ea-card {
  background: #101d19;
  border-color: rgba(224, 247, 236, 0.12);
}
.nightMode .ea-word, .night_mode .ea-word,
.nightMode .ea-meaning, .night_mode .ea-meaning,
.nightMode .ea-anchor, .night_mode .ea-anchor {
  color: #82dbb8;
}
.nightMode .ea-block, .night_mode .ea-block {
  background: #16362b;
}
.nightMode .ea-pos, .night_mode .ea-pos {
  background: #16362b;
  color: #82dbb8;
}
`;

const FRONT_TEMPLATE = `
<div class="ea-card ea-front">
  <div class="ea-kicker">英语 ANKI · 记忆卡</div>
  <div class="ea-word">{{单词}}</div>
  <div class="ea-sub">{{音标}}<span class="ea-pos">{{词性}}</span></div>
  {{#插图}}<div class="ea-art">{{插图}}</div>{{/插图}}
  <div class="ea-prompt">先回想词义，再翻到背面</div>
</div>
`;

const BACK_TEMPLATE = `
{{FrontSide}}
<hr id="answer">
<div class="ea-back">
  <div class="ea-meaning">{{释义}}</div>
  {{#例句}}<div class="ea-block"><span class="ea-label">例句</span><p>{{例句}}</p>{{#例句翻译}}<p class="ea-translation">{{例句翻译}}</p>{{/例句翻译}}</div>{{/例句}}
  {{#联想句}}<div class="ea-block"><span class="ea-label">熟词联想</span><p>{{联想句}}</p></div>{{/联想句}}
  {{#熟词}}<div class="ea-block"><span class="ea-label">熟词锚点</span><div class="ea-anchor">{{熟词}}{{#熟词释义}}<span>（{{熟词释义}}）</span>{{/熟词释义}}</div></div>{{/熟词}}
  {{#记忆提示}}<div class="ea-block"><span class="ea-label">记忆提示</span><p>{{记忆提示}}</p></div>{{/记忆提示}}
  <div class="ea-foot">英语 Anki · 熟词锚点记忆</div>
</div>
`;

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, 20000)
    .trim();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function fieldHtml(value) {
  return escapeHtml(normalizeText(value)).replace(/\n/g, '<br>');
}

function mediaFileName(imageId) {
  if (typeof imageId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(imageId)) return '';
  return `englishanki-${imageId}.webp`;
}

function validateCards(cards) {
  if (!Array.isArray(cards) || !cards.length) throw new Error('导出的词库没有单词');
  if (cards.length > 30000) throw new Error('单次最多导出 30000 张卡片');
  cards.forEach((card, index) => {
    if (!card || typeof card !== 'object' || typeof card.id !== 'string' || !normalizeText(card.word)) {
      throw new Error(`第 ${index + 1} 张卡片缺少单词或 ID`);
    }
  });
}

async function buildApkg({ deckName, cards, mediaDirectory = '' }) {
  const name = normalizeText(deckName);
  if (!name) throw new Error('词库名称不能为空');
  validateCards(cards);

  const apkg = await AnkiExport.create(name, {
    model: {
      id: MODEL_ID,
      name: MODEL_NAME,
      type: 'basic',
      fields: MODEL_FIELDS,
      sortField: '单词',
      templates: [{
        name: '单词 → 释义',
        questionFormat: FRONT_TEMPLATE,
        answerFormat: BACK_TEMPLATE,
        requiredFields: ['单词']
      }],
      css: MODEL_CSS
    }
  });

  try {
    const imageNames = new Set();
    let missingMedia = 0;
    const notes = cards.map(card => {
      const word = normalizeText(card.word);
      let imageField = '';
      const imageName = mediaFileName(card.imageId);
      if (imageName && mediaDirectory) {
        const imagePath = path.join(mediaDirectory, `${card.imageId}.webp`);
        let exists = false;
        try { exists = fs.statSync(imagePath).isFile(); } catch {}
        if (exists) {
          if (!imageNames.has(imageName)) {
            apkg.addMedia(imageName, fs.readFileSync(imagePath));
            imageNames.add(imageName);
          }
          imageField = `<img src="${imageName}" alt="${escapeHtml(word)}">`;
        } else {
          missingMedia += 1;
        }
      }
      return {
        fields: [
          escapeHtml(word),
          fieldHtml(card.phonetic),
          fieldHtml(card.pos),
          fieldHtml(card.meaning),
          fieldHtml(card.anchor),
          fieldHtml(card.anchorMeaning),
          fieldHtml(card.story),
          fieldHtml(card.example),
          fieldHtml(card.translation),
          fieldHtml(card.memory),
          imageField
        ],
        noteId: card.id,
        tags: ['英语Anki']
      };
    });

    apkg.addNotes(notes);
    const buffer = await apkg.save({ type: 'nodebuffer', compression: 'STORE' });
    return { buffer, noteCount: notes.length, mediaCount: imageNames.size, missingMedia };
  } finally {
    apkg.close();
  }
}

module.exports = { MODEL_FIELDS, MODEL_NAME, buildApkg, mediaFileName };

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');

const OUT = path.join(__dirname, '..', '.verification');
const URL = 'http://localhost:4173';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function assertNoOverflow(page, label) {
  const metrics = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('.main-content *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > vw + 1) {
        const style = getComputedStyle(el);
        if (style.position === 'fixed') continue;
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, offenders: offenders.slice(0, 6) };
  });
  check(`${label} 无横向溢出`, metrics.scrollWidth <= metrics.innerWidth + 1, JSON.stringify(metrics));
}

async function readStore(page) {
  return page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('english-anki', 1);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) return resolve(null);
      const get = db.transaction('kv', 'readonly').objectStore('kv').get('learning-data');
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  }));
}

async function revealAll(page) {
  for (let step = 0; step < 3; step += 1) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(420);
  }
  await page.waitForTimeout(250);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const context = await chromium.launchPersistentContext(path.join(OUT, 'pw-profile'), {
    channel: 'msedge',
    headless: true,
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = context.pages()[0] || await context.newPage();
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1000);

  const bridgeInfo = await page.evaluate(() => ({
    hasBridge: !!window.englishAnki,
    hasSchedule: typeof window.englishAnki?.schedule === 'function',
    deckCards: document.querySelectorAll('.deck-card').length,
    dueBadge: document.querySelector('#dueBadge')?.textContent
  }));
  check('桥接层接管', bridgeInfo.hasBridge && bridgeInfo.hasSchedule, JSON.stringify(bridgeInfo));
  await assertNoOverflow(page, '首页');
  await shot(page, 'flow-01-home');

  await page.click('.nav-item[data-route="study"]');
  await page.waitForTimeout(600);
  await shot(page, 'flow-02-study-select');
  await assertNoOverflow(page, '选择词单');

  await page.click('#studyDeckChoices button');
  await page.waitForTimeout(900);
  check('进入学习模式', await page.evaluate(() => document.body.classList.contains('study-mode')));

  const word = await page.textContent('#wordText').catch(() => '');
  await revealAll(page);
  await shot(page, 'flow-03-portrait-revealed');
  const enabled = await page.evaluate(() => document.querySelector('#reviewActions')?.classList.contains('enabled'));
  check('竖屏揭示后评分可用', enabled, `单词: ${word}`);

  await page.click('.rating-button[data-rating="good"]');
  await page.waitForTimeout(1200);
  const afterFirst = await readStore(page);
  check('IndexedDB 数据写入', !!afterFirst, afterFirst ? `logs=${afterFirst.logs?.length}, cards=${Object.keys(afterFirst.cards || {}).length}` : '无数据');

  const wordBefore = await page.textContent('#wordText').catch(() => '');
  check('评分后切换下一张', wordBefore !== word, `下一张: ${wordBefore}`);

  await page.setViewportSize({ width: 915, height: 412 });
  await page.waitForTimeout(800);
  await shot(page, 'flow-04-landscape-study');
  await assertNoOverflow(page, '横屏学习页');
  const landscape = await page.evaluate(() => {
    const card = document.querySelector('#wordCard')?.getBoundingClientRect();
    const buttons = [...document.querySelectorAll('.rating-button')].map(button => {
      const rect = button.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
    });
    return {
      cardLeft: card && Math.round(card.left),
      cardRight: card && Math.round(card.right),
      cardBottom: card && Math.round(card.bottom),
      vh: window.innerHeight,
      buttons
    };
  });
  check('横屏评分按钮分列两侧', landscape.buttons.length === 4
    && landscape.buttons[0].right <= landscape.cardLeft + 1
    && landscape.buttons[1].right <= landscape.cardLeft + 1
    && landscape.buttons[2].left >= landscape.cardRight - 1
    && landscape.buttons[3].left >= landscape.cardRight - 1, JSON.stringify(landscape));
  check('横屏卡片在视口内', landscape.cardBottom <= landscape.vh + 1, `cardBottom=${landscape.cardBottom}, vh=${landscape.vh}`);
  await revealAll(page);
  const landscapeEnabled = await page.evaluate(() => document.querySelector('#reviewActions')?.classList.contains('enabled'));
  check('横屏揭示后评分可用', landscapeEnabled);
  await shot(page, 'flow-05-landscape-revealed');

  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForTimeout(500);
  await page.click('#exitStudyBtn');
  await page.waitForTimeout(800);

  await page.click('#settingsBtn');
  await page.waitForTimeout(600);
  const settingsOpen = await page.evaluate(() => document.querySelector('#settingsModal')?.classList.contains('open'));
  if (settingsOpen) {
    await shot(page, 'flow-06-settings');
    await assertNoOverflow(page, '设置弹窗');
    await page.click('#settingsModal .modal-close');
    await page.waitForTimeout(300);
  }

  await page.click('.nav-item[data-route="library"]');
  await page.waitForTimeout(800);
  await shot(page, 'flow-07-library');
  await assertNoOverflow(page, '词库页');

  await page.click('.nav-item[data-route="stats"]');
  await page.waitForTimeout(900);
  await shot(page, 'flow-08-stats');
  await assertNoOverflow(page, '统计页');

  const beforeReload = await page.evaluate(() => document.querySelector('#planNewDone')?.textContent);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const stored = await readStore(page);
  const afterReload = await page.evaluate(() => ({
    planNewDone: document.querySelector('#planNewDone')?.textContent,
    dueBadge: document.querySelector('#dueBadge')?.textContent
  }));
  check('重载后学习数据保留', !!stored && stored.logs?.length >= 1, JSON.stringify({ beforeReload, afterReload, logs: stored?.logs?.length }));
  await shot(page, 'flow-09-reload-home');

  check('无 console 错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  await context.close();
  const failed = results.filter(entry => !entry.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const root = path.join(__dirname, '..');
const electron = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const profile = path.join(os.tmpdir(), `english-anki-e2e-${Date.now()}`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

function waitForCdp(port, timeout = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`http://127.0.0.1:${port}/json/version`, response => {
        response.resume();
        if (response.statusCode === 200) resolve();
      }).on('error', () => {});
      if (Date.now() - start > timeout) reject(new Error('Timed out waiting for CDP'));
      else setTimeout(tick, 250);
    };
    tick();
  });
}

function launch(args) {
  return spawn(electron, ['.', `--user-data-dir=${profile}`, ...args], {
    cwd: root,
    env,
    stdio: ['ignore', 'ignore', 'pipe']
  });
}

(async () => {
  if (!fs.existsSync(path.join(root, 'preload.bundle.js'))) execFileSync(process.execPath, [path.join(root, 'scripts', 'build-preload.js')]);
  fs.rmSync(profile, { recursive: true, force: true });
  const child = launch(['--remote-debugging-port=0']);
  let browser;
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('DevTools port not announced')), 20000);
      child.stderr.on('data', data => {
        const match = String(data).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
    });
    await waitForCdp(port);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    const page = context.pages().find(item => item.url().includes('index.html')) || await context.waitForEvent('page');
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    await page.waitForSelector('#homeDecks .deck-card', { timeout: 30000 });
    await page.waitForTimeout(300);
    const home = await page.evaluate(() => ({
      due: document.querySelector('#dueBadge')?.textContent,
      decks: document.querySelectorAll('#homeDecks .deck-card').length
    }));
    assert.equal(home.due, '20');
    assert.ok(home.decks >= 4);

    await page.click('[data-route="library"]');
    await page.waitForSelector('#exportApkgBtn');
    const library = await page.evaluate(() => ({
      hasApkgButton: !!document.querySelector('#exportApkgBtn'),
      apkgEnabled: !document.querySelector('#exportApkgBtn')?.disabled,
      csvDisabledForBuiltin: !!document.querySelector('#exportDeckBtn')?.disabled
    }));
    assert.equal(library.hasApkgButton, true);
    assert.equal(library.apkgEnabled, true);
    assert.equal(library.csvDisabledForBuiltin, true);
    await page.click('[data-route="home"]');
    await page.waitForTimeout(200);

    await page.click('#startStudyBtn');
    await page.waitForSelector('#studyView.active');
    await page.waitForTimeout(300);
    for (const id of ['scenePanel', 'keywordLinkPanel', 'keywordScenePanel']) await page.click(`#${id}`);
    await page.waitForTimeout(500);
    const study = await page.evaluate(() => ({
      word: document.querySelector('#wordText')?.textContent,
      ratingEnabled: document.querySelector('#reviewActions')?.classList.contains('enabled'),
      imageLoaded: (() => { const image = document.querySelector('#memoryScene .story-illustration'); return !!image && image.complete && image.naturalWidth > 0; })(),
      revealButtonRemoved: !document.querySelector('#revealBtn')
    }));
    assert.ok(study.word);
    assert.equal(study.ratingEnabled, true);
    assert.equal(study.imageLoaded, true);
    assert.equal(study.revealButtonRemoved, true);

    const progressBefore = await page.evaluate(() => document.querySelector('#studyProgressText')?.textContent);
    await page.click('#cardToolsBtn');
    await page.waitForSelector('#cardActionsModal.open');
    await page.keyboard.press('1');
    await page.waitForTimeout(400);
    const progressDuringModal = await page.evaluate(() => document.querySelector('#studyProgressText')?.textContent);
    assert.equal(progressDuringModal, progressBefore);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    await page.click('[data-rating="good"]');
    await page.waitForTimeout(600);
    assert.notEqual(await page.evaluate(() => document.querySelector('#studyProgressText')?.textContent), progressBefore);
    await page.click('#undoRatingBtn');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => document.querySelector('#studyProgressText')?.textContent), progressBefore);

    const backup = await page.evaluate(async () => {
      const ok = await window.englishAnki.backupData();
      const list = await window.englishAnki.listBackups();
      const inspect = list[0] ? await window.englishAnki.inspectBackup(list[0].name) : null;
      return { ok, list, inspect };
    });
    assert.equal(backup.ok, true);
    assert.match(backup.list[0].name, /\.json\.gz$/);
    assert.equal(backup.inspect.valid, true);

    const second = launch([]);
    const secondExit = await Promise.race([
      new Promise(resolve => second.once('exit', code => resolve({ exited: true, code }))),
      new Promise(resolve => setTimeout(() => resolve({ exited: false }), 4000))
    ]);
    if (!secondExit.exited) second.kill();
    assert.equal(secondExit.exited, true);

    await page.click('[data-route="library"]');
    await page.waitForSelector('#libraryView.active');
    await page.click('#newDeckBtn');
    await page.fill('#newDeckNameInput', 'E2E 自定义词库');
    await page.click('#createDeckBtn');
    await page.waitForSelector('#wordEditorModal.open');
    await page.fill('#editWord_word', 'e2etest');
    await page.fill('#editWord_meaning', '端到端测试');
    await page.click('#saveWordBtn');
    await page.waitForTimeout(400);
    await page.click('[data-route="home"]');
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.querySelector('#homeDecks .deck-card.is-selected h3')?.textContent), 'E2E 自定义词库');
    await page.click('#startStudyBtn');
    await page.waitForSelector('#studyView.active');
    const customStudy = await page.evaluate(() => ({
      deck: document.querySelector('#studyDeckLabel')?.textContent,
      word: document.querySelector('#wordText')?.textContent
    }));
    assert.equal(customStudy.deck, 'E2E 自定义词库');
    assert.equal(customStudy.word, 'e2etest');
    await page.click('#exitStudyBtn');

    const tempDataPath = path.join(profile, 'english-anki-learning-data.json.tmp');
    fs.rmSync(tempDataPath, { recursive: true, force: true });
    fs.mkdirSync(tempDataPath);
    await page.evaluate(() => { document.querySelector('#themeBtn').click(); window.englishAnki.window.close(); });
    await page.waitForTimeout(1200);
    assert.equal(child.exitCode, null, 'close should be cancelled when the final save fails');
    assert.match(await page.evaluate(() => document.querySelector('#toast')?.textContent || ''), /保存失败/);
    fs.rmSync(tempDataPath, { recursive: true, force: true });
    await page.evaluate(() => window.englishAnki.window.close());
    const appExit = await Promise.race([
      new Promise(resolve => child.once('exit', code => resolve({ exited: true, code }))),
      new Promise(resolve => setTimeout(() => resolve({ exited: false }), 6000))
    ]);
    assert.equal(appExit.exited, true);
    const data = JSON.parse(fs.readFileSync(path.join(profile, 'english-anki-learning-data.json'), 'utf8'));
    assert.equal(data.settings.theme, 'dark');
    assert.deepEqual(errors, []);
    console.log('E2E OK');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (!child.killed && child.exitCode === null) child.kill();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

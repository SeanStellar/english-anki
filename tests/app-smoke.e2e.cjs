const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const electronPath = process.env.ENGLISH_ANKI_RUNTIME
  || path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'english-anki-e2e-'));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

assert.ok(fs.existsSync(electronPath), 'Electron runtime is missing; run npm rebuild electron first');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForTarget(port) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(1000),
      }).then(response => response.json());
      const page = targets.find(target => target.type === 'page');
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw Error('Electron did not expose a renderer page');
}

async function main() {
  const port = await freePort();
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: dataRoot };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(electronPath, [root, '--allow-multiple-instances', `--remote-debugging-port=${port}`], {
    cwd: root,
    env,
    stdio: 'ignore',
    windowsHide: true,
  });

  let socket;
  try {
    const target = await waitForTarget(port);
    assert.match(target.url.replace(/\\/g, '/'), /\/renderer\/index\.html$/);

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });

    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Renderer smoke check timed out')), 20_000);
      socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error || message.result?.exceptionDetails) {
          reject(Error(JSON.stringify(message.error || message.result.exceptionDetails)));
          return;
        }
        resolve(message.result.result.value);
      });
      socket.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          awaitPromise: true,
          returnByValue: true,
          expression: `(async () => {
            for (let attempt = 0; attempt < 150; attempt += 1) {
              if (typeof state !== 'undefined' && state && words.length >= 3000 && deckDefinitions.length >= 2 && window.englishAnki) {
                const baseById = new Map(words.filter(word => word.deckId === 'zhuanshengben-3000').map(word => [word.id, word]));
                const merged = words.filter(word => word.deckId === 'kaoyan-2752' && word.baseWordId);
                return {
                  title: document.title,
                  words: words.length,
                  decks: deckDefinitions.length,
                  homeVisible: !!document.querySelector('#homeView.active'),
                  apiReady: !!window.englishAnki,
                  merged,
                  mergeOk: merged.every(word => {
                    const ref = baseById.get(word.baseWordId);
                    const story = memoryStories.get(word.id);
                    return ref && word.meaning === ref.meaning && story?.anchor && story?.sentence;
                  }),
                  sample: (() => {
                    const card = words.find(word => word.deckId === 'kaoyan-2752' && word.word === 'abandon');
                    if (!card?.baseWordId) return null;
                    const ref = baseById.get(card.baseWordId);
                    const linkedDetail = wordDetail(card);
                    const baseDetail = wordDetail(ref);
                    return {
                      baseWordId: card.baseWordId,
                      sentenceSame: !!linkedDetail.story?.sentence && linkedDetail.story.sentence === baseDetail.story?.sentence
                    };
                  })(),
                  kycOk: (() => {
                    const card = words.find(word => word.id === 'kyc-2032');
                    if (!card) return false;
                    const detail = wordDetail(card);
                    return /[\u4e00-\u9fff]/.test(detail.story?.sentence || '')
                      && /[\u4e00-\u9fff]/.test(detail.memory || '')
                      && String(detail.mnemonic?.html || '').includes('abide</strong>（遵守）');
                  })(),
                  xrayWord: words.find(word => word.deckId === 'kaoyan-2752' && word.number === 5526)?.word
                };
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            throw Error('Application data did not finish loading');
          })()`,
        },
      }));
    });

    assert.match(result.title, /Anki/);
    assert.ok(result.words >= 3000);
    assert.ok(result.decks >= 2);
    assert.equal(result.homeVisible, true);
    assert.equal(result.apiReady, true);
    // 2754 张同拼写重复卡 + X-ray/x-ray 别名，均采用专升本词卡与记忆句
    assert.equal(result.merged.length, 2755);
    assert.equal(result.mergeOk, true);
    assert.equal(result.sample?.sentenceSame, true);
    assert.equal(result.kycOk, true);
    assert.equal(result.xrayWord, 'x-ray');
    console.log(`PASS: Electron renderer loaded ${result.words} words across ${result.decks} deck definitions; ${result.merged.length} kaoyan cards linked to zhuanshengben cards.`);
  } finally {
    try {
      socket?.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: { expression: 'window.close()' },
      }));
    } catch {}
    await sleep(500);
    if (!child.killed) child.kill();
    socket?.close();
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

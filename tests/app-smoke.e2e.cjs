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
                return {
                  title: document.title,
                  words: words.length,
                  decks: deckDefinitions.length,
                  homeVisible: !!document.querySelector('#homeView.active'),
                  apiReady: !!window.englishAnki
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
    console.log(`PASS: Electron renderer loaded ${result.words} words across ${result.decks} deck definitions.`);
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

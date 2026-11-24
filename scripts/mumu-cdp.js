/* 在 MuMu 等 Android 设备上通过 CDP 执行页面脚本：node scripts/mumu-cdp.js "<js>" */
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const WebSocket = require('ws');

const ADB = process.env.ADB || 'D:/MuMu/nx_main/adb.exe';
const SERIAL = process.env.DEVICE || '127.0.0.1:16384';
const PORT = Number(process.env.CDP_PORT || 9229);

function adb(args) {
  return execFileSync(ADB, ['-s', SERIAL, ...args], { encoding: 'utf8' }).trim();
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function prepareForward() {
  let pid = '';
  try {
    pid = adb(['shell', 'pidof', 'com.englishanki.app']);
  } catch {}
  if (!pid) {
    execFileSync(ADB, ['-s', SERIAL, 'shell', 'am', 'start', '-n', 'com.englishanki.app/.MainActivity'], { stdio: 'ignore' });
    for (let attempt = 0; attempt < 20 && !pid; attempt += 1) {
      sleepSync(1000);
      try {
        pid = adb(['shell', 'pidof', 'com.englishanki.app']);
      } catch {}
    }
  }
  if (!pid) throw new Error('应用未运行');
  try {
    execFileSync(ADB, ['-s', SERIAL, 'forward', '--remove', `tcp:${PORT}`], { stdio: 'ignore' });
  } catch {}
  execFileSync(ADB, ['-s', SERIAL, 'forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`], { stdio: 'ignore' });
}

async function connect() {
  prepareForward();
  let target = null;
  for (let attempt = 0; attempt < 10 && !target; attempt += 1) {
    try {
      const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
      target = targets.find(entry => entry.type === 'page');
    } catch {}
    if (!target) await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!target) throw new Error('未找到可调试页面');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();
  ws.on('message', data => {
    const message = JSON.parse(data);
    const handler = pending.get(message.id);
    if (handler) {
      pending.delete(message.id);
      handler(message);
    }
  });
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  const evaluate = expression => new Promise((resolve, reject) => {
    nextId += 1;
    const id = nextId;
    pending.set(id, message => {
      if (message.error) return reject(new Error(JSON.stringify(message.error)));
      if (message.result?.exceptionDetails) return reject(new Error(message.result.exceptionDetails.text));
      resolve(message.result?.result?.value);
    });
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression, awaitPromise: true, returnByValue: true, userGesture: true }
    }));
  });
  return { evaluate, close: () => ws.close() };
}

async function main() {
  const expression = process.argv.slice(2).join(' ');
  if (!expression) {
    console.error('用法: node scripts/mumu-cdp.js "<javascript>"');
    process.exit(1);
  }
  const client = await connect();
  const value = await client.evaluate(expression);
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  client.close();
}

module.exports = { connect };

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
}
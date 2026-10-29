const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { checksumFor, inspectBackupPayload } = require('../backup-utils');
const runtime = process.env.ENGLISH_ANKI_RUNTIME || path.resolve(__dirname, '..', '..', 'ea-runtime', '英语 Anki.exe');
if (!fs.existsSync(runtime)) throw Error('找不到 Electron 运行时；请设置 ENGLISH_ANKI_RUNTIME 指向英语 Anki.exe');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'english-anki-integration-'));
const dataDir = path.join(root, 'EnglishAnkiData');
fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
const now = new Date(), iso = n => new Date(now.getTime() + n).toISOString();
const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const card = { due: iso(-60000), stability: 1.2, difficulty: 5, elapsed_days: 0, scheduled_days: 0, reps: 2, lapses: 1, learning_steps: 0, state: 1, last_review: iso(-120000) };
const initial = { version: 4, settings: { dailyNew: 0, dailyReview: 1, workloadProtection: false, autoSpeak: false }, cards: { 'hb-0001-a': card }, logs: [{ date, timestamp: iso(-120000), wordId: 'hb-0001-a', deckId: 'zhuanshengben-3000', rating: 'again', isNew: false, elapsedMs: 5000 }], customWords: [], customDecks: [], selectedDeck: 'zhuanshengben-3000' };
for (const [file, value] of Object.entries({ 'english-anki-learning-data.json': initial, 'study-session.json': null, 'integration-preferences.json': { syncAuto: false, autoUpdateCheck: false }, 'backup-preferences.json': {}, 'window-state.json': {} })) fs.writeFileSync(path.join(dataDir,file), JSON.stringify(value));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort() { const server=net.createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const port=server.address().port; await new Promise(resolve=>server.close(resolve)); return port; }
async function launch(port) {
  const env = { ...process.env, PORTABLE_EXECUTABLE_DIR: root }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(runtime, ['--allow-multiple-instances', `--remote-debugging-port=${port}`], { env, windowsHide: true, stdio: 'ignore' });
  let target;
  for (let i=0;i<100;i++) { try { const data=await fetch(`http://127.0.0.1:${port}/json/list`, {signal:AbortSignal.timeout(1000)}).then(r=>r.json()); target=data.find(x=>x.type==='page'); if (target) break; } catch {} await sleep(150); }
  if (!target) throw Error('隔离应用启动失败');
  assert.match(target.url.replace(/\\/g,'/'), /english-anki\/renderer\/index\.html/);
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let next=0;const pending=new Map();ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}});
  const evaluate = expression => new Promise((resolve,reject)=>{ const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('应用响应超时'))},15000);pending.set(id,m=>{clearTimeout(timer);if(m.error||m.result?.exceptionDetails)reject(Error(JSON.stringify(m.error||m.result.exceptionDetails)));else resolve(m.result.result.value)});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}))});
  for(let i=0;i<100;i++){try{if(await evaluate(`typeof state !== 'undefined' && !!state && !!window.englishAnki`))return {child,ws,evaluate,port};}catch{}await sleep(100)}
  throw Error('隔离应用未完成初始化');
}
async function close(app) { try { app.ws.send(JSON.stringify({id:999999,method:'Runtime.evaluate',params:{expression:'window.close()'}})); } catch {} for(let i=0;i<100;i++){try{await fetch(`http://127.0.0.1:${app.port}/json/list`,{signal:AbortSignal.timeout(300)});await sleep(100)}catch{break}}try{app.ws.close()}catch{}}
async function main() {
  const port=await freePort(); let app=await launch(port);
  try {
    const check = await app.evaluate(`(async()=>{let dir=(await window.englishAnki.backupLocation()).directory;let sync=await window.englishAnki.syncStatus();return {dir,configured:sync.configured,due:planFor('zhuanshengben-3000').reviews.map(w=>w.id)}})()`);
    assert.equal(path.resolve(check.dir),path.resolve(dataDir,'backups'));assert.equal(check.configured,false);assert.deepEqual(check.due,['hb-0001-a']);
    const restored = await app.evaluate(`(async()=>{const initial=await window.englishAnki.loadData();const old=await window.englishAnki.listBackups();if(!await window.englishAnki.backupData())throw Error('backup failed');const list=await window.englishAnki.listBackups();const name=list.find(x=>!old.some(y=>y.name===x.name))?.name;if(!name)throw Error('no backup');const info=await window.englishAnki.inspectBackup(name);let modified=JSON.parse(JSON.stringify(initial));modified.settings.integrationMarker='before-restore';modified.logs.push({date:'2026-10-28',wordId:'hb-0001-a',isNew:false});await window.englishAnki.saveData(modified);const result=await window.englishAnki.restoreBackup(name);if(!result)throw Error('restore failed');const read=await window.englishAnki.loadData();state=normalizeState(result);selectedDeck=state.selectedDeck;return {info,equal:JSON.stringify(initial)===JSON.stringify(read)}})()`);
    assert.equal(restored.info.valid,true);assert.equal(restored.info.integrity,'verified');assert.equal(restored.equal,true);
    const dir=path.join(dataDir,'backups');let foundPreRestore=false;
    for(const file of fs.readdirSync(dir).filter(n=>/^english-anki-backup-\d{14}(?:-\d+)?\.json(?:\.gz)?$/.test(n))){let raw=fs.readFileSync(path.join(dir,file));if(raw[0]===31)raw=zlib.gunzipSync(raw);const result=inspectBackupPayload(JSON.parse(raw.toString()));if(result.valid&&result.data.settings.integrationMarker==='before-restore')foundPreRestore=true;}
    assert.equal(foundPreRestore,true,'恢复前版本必须先保存到备份');
    const bad={version:4,settings:[],cards:null,logs:[]};const badName='english-anki-backup-20990101000000.json.gz';fs.writeFileSync(path.join(dir,badName),zlib.gzipSync(JSON.stringify({format:'english-anki-backup-v2',createdAt:iso(0),checksum:checksumFor(bad),data:bad})));
    const rejected=await app.evaluate(`(async()=>{const before=await window.englishAnki.loadData();const info=await window.englishAnki.inspectBackup('${badName}');const data=await window.englishAnki.restoreBackup('${badName}');const after=await window.englishAnki.loadData();return {valid:info.valid,result:data,unchanged:JSON.stringify(before)===JSON.stringify(after)}})()`);
    assert.equal(rejected.valid,false);assert.equal(rejected.result,null);assert.equal(rejected.unchanged,true);
    await close(app);app=await launch(port);
    const after=await app.evaluate(`(async()=>{let d=await window.englishAnki.loadData();return {reps:d.cards['hb-0001-a']?.reps,logs:d.logs.length,marker:d.settings.integrationMarker||null,due:planFor('zhuanshengben-3000').reviews.map(w=>w.id)}})()`);
    assert.equal(after.reps,2);assert.equal(after.logs,1);assert.equal(after.marker,null);assert.deepEqual(after.due,['hb-0001-a']);
    console.log('PASS：独立数据目录、同日到期队列、备份校验、恢复前备份、拒绝坏备份及重启后读取。');
    console.log(`隔离测试目录：${root}`);
  } finally { await close(app); }
}
main().catch(error=>{console.error(error);process.exitCode=1});

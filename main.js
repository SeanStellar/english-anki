const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { createBackupEnvelope, inspectBackupPayload, checksumFor, isLearningData } = require('./backup-utils');
const { compareVersions, syncStateFor, validateUpdateManifest } = require('./integration-utils');

function preparePortableDataDirectory() {
  const portableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!portableDirectory) return;
  const source = app.getPath('userData');
  const target = path.join(portableDirectory, 'EnglishAnkiData');
  try {
    fs.mkdirSync(target, { recursive: true });
    fs.accessSync(target, fs.constants.W_OK);
    if (path.resolve(source) === path.resolve(target)) return;
    app.setPath('userData', target);
    const files = ['english-anki-learning-data.json', 'study-session.json', 'integration-preferences.json', 'backup-preferences.json', 'window-state.json'];
    files.forEach(name => {
      const from = path.join(source, name);
      const to = path.join(target, name);
      if (!fs.existsSync(to) && fs.existsSync(from)) {
        try { fs.copyFileSync(from, to); } catch {}
      }
    });
    const backupsFrom = path.join(source, 'backups');
    const backupsTo = path.join(target, 'backups');
    if (!fs.existsSync(backupsTo) && fs.existsSync(backupsFrom)) {
      try { fs.cpSync(backupsFrom, backupsTo, { recursive: true }); } catch {}
    }
  } catch {}
}

preparePortableDataDirectory();

let mainWindow;
let syncTimer = null;
let closeAllowed = false;
let closeFlushPending = false;
let closeFlushTimer = null;
let corruptDataBackup = '';

const allowMultipleInstances = !app.isPackaged && process.argv.includes('--allow-multiple-instances');
const hasSingleInstanceLock = allowMultipleInstances || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function windowStateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const state = JSON.parse(fs.readFileSync(windowStateFile(), 'utf8'));
    if (!state || typeof state.width !== 'number' || typeof state.height !== 'number') return null;
    const savedWidth = Math.max(900, Math.min(4000, Math.round(state.width)));
    const savedHeight = Math.max(500, Math.min(4000, Math.round(state.height)));
    const maximized = !!state.maximized;
    const hasPosition = typeof state.x === 'number' && typeof state.y === 'number';
    const display = hasPosition
      ? screen.getDisplayMatching({ x: state.x, y: state.y, width: savedWidth, height: savedHeight })
      : screen.getPrimaryDisplay();
    const area = display.workArea;
    const width = Math.min(savedWidth, Math.max(900, area.width));
    const height = Math.min(savedHeight, Math.max(500, area.height));
    if (!hasPosition) return { width, height, maximized };
    const x = Math.max(area.x, Math.min(Math.round(state.x), area.x + area.width - Math.min(width, area.width)));
    const y = Math.max(area.y, Math.min(Math.round(state.y), area.y + area.height - Math.min(height, area.height)));
    return { x, y, width, height, maximized };
  } catch {
    return null;
  }
}

function saveWindowState(win) {
  try {
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized()
    };
    const file = windowStateFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // 保存失败不影响使用
  }
}

function dataFile() {
  return path.join(app.getPath('userData'), 'english-anki-learning-data.json');
}

const contentCache = new Map();
function readContent(name) {
  if (!contentCache.has(name)) contentCache.set(name, readJsonFile(path.join(__dirname, 'renderer', 'data', name)));
  return contentCache.get(name);
}

function renameWithRetry(from, to) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt === 5) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60 * (attempt + 1));
    }
  }
}

function writeJsonAtomic(file, payload, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(payload, null, pretty ? 2 : 0), 'utf8');
  renameWithRetry(temp, file);
}

function integrationPreferencesFile() {
  return path.join(app.getPath('userData'), 'integration-preferences.json');
}

function readIntegrationPreferences() {
  const saved = readJsonFile(integrationPreferencesFile()) || {};
  return {
    syncDirectory: saved.syncDirectory && path.isAbsolute(saved.syncDirectory) ? path.resolve(saved.syncDirectory) : '',
    syncAuto: saved.syncAuto !== false,
    lastSyncChecksum: typeof saved.lastSyncChecksum === 'string' ? saved.lastSyncChecksum : '',
    updateSource: typeof saved.updateSource === 'string' ? saved.updateSource.trim() : '',
    autoUpdateCheck: saved.autoUpdateCheck !== false,
    lastUpdateCheck: Number(saved.lastUpdateCheck) || 0,
    lastUpdateResult: saved.lastUpdateResult || null
  };
}

function writeIntegrationPreferences(patch = {}) {
  const next = { ...readIntegrationPreferences(), ...patch };
  writeJsonAtomic(integrationPreferencesFile(), next);
  return next;
}

function syncDataFile(directory = readIntegrationPreferences().syncDirectory) {
  return directory ? path.join(directory, 'english-anki-sync.json') : '';
}

function inspectSyncFile(file = syncDataFile()) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const inspection = inspectBackupPayload(payload);
    const stat = fs.statSync(file);
    return { ...inspection, file, modifiedAt: stat.mtimeMs, checksum: inspection.valid ? checksumFor(inspection.data) : '' };
  } catch {
    return { valid: false, integrity: 'failed', file, modifiedAt: 0, checksum: '', data: null, meta: {} };
  }
}

function localDataSnapshot() {
  const data = readJsonFile(dataFile());
  if (!data) return { data: null, checksum: '', modifiedAt: 0 };
  let modifiedAt = 0;
  try { modifiedAt = fs.statSync(dataFile()).mtimeMs; } catch {}
  return { data, checksum: checksumFor(data), modifiedAt };
}

function syncStatus() {
  const preferences = readIntegrationPreferences();
  const local = localDataSnapshot();
  const remote = inspectSyncFile(syncDataFile(preferences.syncDirectory));
  const state = syncStateFor({
    configured: !!preferences.syncDirectory,
    remoteExists: !!remote,
    remoteValid: !!remote?.valid,
    localExists: !!local.data,
    localChecksum: local.checksum,
    remoteChecksum: remote?.checksum || '',
    lastSyncChecksum: preferences.lastSyncChecksum
  });
  return {
    configured: !!preferences.syncDirectory,
    directory: preferences.syncDirectory,
    auto: preferences.syncAuto,
    state,
    localModifiedAt: local.modifiedAt,
    remoteModifiedAt: remote?.modifiedAt || 0,
    remoteIntegrity: remote?.integrity || '',
    remoteMeta: remote?.meta || null
  };
}

function pushSyncData() {
  try {
    const preferences = readIntegrationPreferences();
    const local = localDataSnapshot();
    if (!preferences.syncDirectory || !local.data) return { ok: false, error: 'not-configured', ...syncStatus() };
    fs.mkdirSync(preferences.syncDirectory, { recursive: true });
    const envelope = createBackupEnvelope(local.data);
    envelope.device = os.hostname();
    writeJsonAtomic(syncDataFile(preferences.syncDirectory), envelope);
    writeIntegrationPreferences({ lastSyncChecksum: local.checksum });
    return { ok: true, action: 'pushed', ...syncStatus() };
  } catch (error) {
    return { ok: false, error: error.message, ...syncStatus() };
  }
}

function pullSyncData() {
  try {
    const preferences = readIntegrationPreferences();
    const remote = inspectSyncFile(syncDataFile(preferences.syncDirectory));
    if (!remote?.valid) return { ok: false, error: 'invalid-remote', ...syncStatus() };
    const dataPath = dataFile();
    const current = readJsonFile(dataPath);
    if (fs.existsSync(dataPath) && (!current || !isLearningData(current))) {
      if (!corruptDataBackup) corruptDataBackup = quarantineCorruptDataFile(dataPath);
    }
    if (current && isLearningData(current) && !createBackup()) return { ok: false, error: 'backup-failed', ...syncStatus() };
    writeData(remote.data);
    try { fs.unlinkSync(sessionFile()); } catch {}
    writeIntegrationPreferences({ lastSyncChecksum: remote.checksum });
    return { ok: true, action: 'pulled', data: remote.data, ...syncStatus() };
  } catch (error) {
    return { ok: false, error: error.message, ...syncStatus() };
  }
}

function autoSyncData(allowPull = true) {
  const status = syncStatus();
  if (!status.configured || !status.auto) return { ok: true, action: 'disabled', ...status };
  if (status.state === 'local-only') return pushSyncData();
  if (status.state === 'local-newer') return pushSyncData();
  if (status.state === 'remote-newer') return allowPull ? pullSyncData() : { ok: true, action: 'remote-pending', ...status };
  if (status.state === 'synced' || status.state === 'empty') return { ok: true, action: 'none', ...status };
  return { ok: false, action: status.state, ...status };
}

async function readUpdateManifest(source) {
  if (!source) {
    const local = syncDataFile() && path.join(path.dirname(syncDataFile()), 'english-anki-update.json');
    if (!local || !fs.existsSync(local)) return null;
    return JSON.parse(fs.readFileSync(local, 'utf8'));
  }
  if (path.isAbsolute(source)) return JSON.parse(fs.readFileSync(source, 'utf8'));
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('版本源必须使用 HTTPS');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'user-agent': `English-Anki/${app.getVersion()}` } });
    if (!response.ok) throw new Error(`版本源返回 HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 1024 * 1024) throw new Error('版本清单文件过大');
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

async function checkForUpdates() {
  const preferences = readIntegrationPreferences();
  const checkedAt = Date.now();
  try {
    const manifest = await readUpdateManifest(preferences.updateSource);
    if (!manifest) {
      const result = { ok: true, available: false, currentVersion: app.getVersion(), checkedAt, reason: 'no-source' };
      writeIntegrationPreferences({ lastUpdateCheck: checkedAt, lastUpdateResult: result });
      return result;
    }
    const normalized = validateUpdateManifest(manifest);
    const result = {
      ok: true,
      available: compareVersions(normalized.version, app.getVersion()) > 0,
      currentVersion: app.getVersion(),
      version: normalized.version,
      notes: normalized.notes,
      downloadUrl: normalized.downloadUrl,
      sha256: normalized.sha256,
      checkedAt
    };
    writeIntegrationPreferences({ lastUpdateCheck: checkedAt, lastUpdateResult: result });
    return result;
  } catch (error) {
    const result = { ok: false, available: false, currentVersion: app.getVersion(), checkedAt, error: error.message };
    writeIntegrationPreferences({ lastUpdateCheck: checkedAt, lastUpdateResult: result });
    return result;
  }
}

function legacyDataFiles() {
  const userData = app.getPath('userData');
  const appData = path.dirname(userData);
  return [
    path.join(userData, 'mori-learning-data.json'),
    path.join(appData, 'mori-memory', 'mori-learning-data.json'),
    path.join(appData, 'Mori 高效记忆', 'mori-learning-data.json')
  ];
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function quarantineCorruptDataFile(file) {
  try {
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    let target = path.join(path.dirname(file), `english-anki-learning-data.corrupt-${stamp}.json`);
    let suffix = 1;
    while (fs.existsSync(target)) {
      target = path.join(path.dirname(file), `english-anki-learning-data.corrupt-${stamp}-${suffix++}.json`);
    }
    renameWithRetry(file, target);
    return target;
  } catch {
    return '';
  }
}

function readData() {
  const file = dataFile();
  const current = readJsonFile(file);
  if (fs.existsSync(file) && (!current || !isLearningData(current))) {
    if (!corruptDataBackup) corruptDataBackup = quarantineCorruptDataFile(file);
    try { fs.unlinkSync(sessionFile()); } catch {}
    return legacyDataFiles().map(readJsonFile).find(Boolean);
  }
  const legacy = legacyDataFiles().map(readJsonFile).find(Boolean);
  if (!current) return legacy;
  if (!legacy || current.migration?.legacyMergedAt) return current;
  const uniqueBy = (items, keyFor) => [...new Map(items.map(item => [keyFor(item), item])).values()];
  const merged = {
    ...legacy,
    ...current,
    version: Math.max(2, Number(current.version) || 0),
    settings: { ...(current.settings || {}), ...(legacy.settings || {}) },
    cards: { ...(legacy.cards || {}), ...(current.cards || {}) },
    logs: uniqueBy([...(legacy.logs || []), ...(current.logs || [])], item => `${item.timestamp || ''}:${item.wordId || ''}:${item.rating || ''}`),
    keywordStats: { ...(legacy.keywordStats || {}), ...(current.keywordStats || {}) },
    keywordProfile: {
      known: { ...(legacy.keywordProfile?.known || {}), ...(current.keywordProfile?.known || {}) },
      rejected: { ...(legacy.keywordProfile?.rejected || {}), ...(current.keywordProfile?.rejected || {}) },
      swaps: { ...(legacy.keywordProfile?.swaps || {}), ...(current.keywordProfile?.swaps || {}) }
    },
    customWords: uniqueBy([...(legacy.customWords || []), ...(current.customWords || [])], item => item.id || item.word),
    customDecks: uniqueBy([...(legacy.customDecks || []), ...(current.customDecks || [])], item => item.id || item.name),
    selectedDeck: legacy.selectedDeck || current.selectedDeck || 'hebei-3000',
    createdAt: legacy.createdAt || current.createdAt,
    migration: { ...(current.migration || {}), legacyMergedAt: new Date().toISOString(), legacySource: 'mori-memory' }
  };
  writeData(merged);
  return merged;
}

function writeData(data) {
  writeJsonAtomic(dataFile(), data);
  maybeAutoBackup();
  return true;
}

function backupPreferencesFile() {
  return path.join(app.getPath('userData'), 'backup-preferences.json');
}

function defaultBackupsDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function readBackupPreferences() {
  const saved = readJsonFile(backupPreferencesFile());
  const directory = saved?.directory && path.isAbsolute(saved.directory) ? path.resolve(saved.directory) : '';
  return { directory };
}

function writeBackupPreferences(directory = '') {
  const file = backupPreferencesFile();
  const temp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify({ directory }, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

function backupsDir() {
  return readBackupPreferences().directory || defaultBackupsDir();
}

function backupLocation() {
  const directory = backupsDir();
  return { directory, custom: directory !== defaultBackupsDir() };
}

function backupFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => /^english-anki-backup-\d{14}(?:-\d+)?\.json(?:\.gz)?$/i.test(name)).sort();
}

function backupMetaFile(file) {
  return `${file}.meta.json`;
}

function readBackupInspection(file) {
  try {
    let raw = fs.readFileSync(file);
    if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
    const payload = JSON.parse(raw.toString('utf8'));
    return inspectBackupPayload(payload);
  } catch {
    return { valid: false, integrity: 'failed', data: null, meta: { version: 0, learned: 0, reviews: 0, customWords: 0, createdAt: '' } };
  }
}

function readBackupSummary(file) {
  try {
    const summary = JSON.parse(fs.readFileSync(backupMetaFile(file), 'utf8'));
    if (!summary || typeof summary !== 'object' || !summary.meta) throw new Error('invalid summary');
    return { valid: summary.valid !== false, integrity: summary.integrity || 'verified', meta: summary.meta };
  } catch {
    return { valid: null, integrity: 'unverified', meta: null };
  }
}

function findBackup(name) {
  try {
    const safe = path.basename(String(name || ''));
    const dir = backupsDir();
    if (!backupFiles(dir).includes(safe)) return null;
    return { name: safe, file: path.join(dir, safe) };
  } catch {
    return null;
  }
}

function createBackup() {
  try {
    const current = readJsonFile(dataFile());
    if (!current) return null;
    const dir = backupsDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    let suffix = '';
    while (fs.existsSync(path.join(dir, `english-anki-backup-${stamp}${suffix}.json.gz`))
      || fs.existsSync(path.join(dir, `english-anki-backup-${stamp}${suffix}.json`))) {
      suffix = `-${Number(suffix.slice(1) || 0) + 1}`;
    }
    const envelope = createBackupEnvelope(current);
    const inspection = inspectBackupPayload(envelope);
    const file = path.join(dir, `english-anki-backup-${stamp}${suffix}.json.gz`);
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, zlib.gzipSync(JSON.stringify(envelope)));
    renameWithRetry(temp, file);
    try {
      writeJsonAtomic(backupMetaFile(file), {
        format: 'english-anki-backup-v3',
        createdAt: envelope.createdAt,
        valid: inspection.valid,
        integrity: inspection.integrity,
        meta: inspection.meta
      });
    } catch {}
    const files = backupFiles(dir);
    while (files.length > 20) {
      const expired = path.join(dir, files.shift());
      try { fs.unlinkSync(expired); } catch {}
      try { fs.unlinkSync(backupMetaFile(expired)); } catch {}
    }
    return path.basename(file);
  } catch {
    return null;
  }
}

let lastAutoBackupAt = 0;
function maybeAutoBackup() {
  const now = Date.now();
  if (now - lastAutoBackupAt < 30 * 60 * 1000) return;
  if (createBackup()) lastAutoBackupAt = now;
}

function sessionFile() {
  return path.join(app.getPath('userData'), 'study-session.json');
}

function finishWindowClose() {
  clearTimeout(closeFlushTimer);
  closeFlushTimer = null;
  if (closeAllowed) return;
  closeAllowed = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
}

function cancelWindowClose() {
  if (!closeFlushPending || closeAllowed) return;
  closeFlushPending = false;
  clearTimeout(closeFlushTimer);
  closeFlushTimer = null;
}

function createWindow() {
  closeAllowed = false;
  closeFlushPending = false;
  clearTimeout(closeFlushTimer);
  closeFlushTimer = null;
  const winState = loadWindowState() || {};
  const workArea = screen.getPrimaryDisplay().workArea;
  mainWindow = new BrowserWindow({
    x: winState.x,
    y: winState.y,
    width: winState.width || Math.min(1440, workArea.width),
    height: winState.height || Math.min(900, workArea.height),
    minWidth: 900,
    minHeight: 500,
    backgroundColor: '#f4f4ee',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.bundle.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: true
    }
  });
  if (winState.maximized) mainWindow.maximize();

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (process.argv.includes('--dev')) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('close', event => {
    if (!closeAllowed) {
      event.preventDefault();
      if (!closeFlushPending) {
        closeFlushPending = true;
        mainWindow.webContents.send('app:before-close');
        closeFlushTimer = setTimeout(finishWindowClose, 5000);
      }
      return;
    }
    autoSyncData(false);
    createBackup();
    saveWindowState(mainWindow);
  });
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (app.isReady()) createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    autoSyncData(true);
    createWindow();
    syncTimer = setInterval(() => autoSyncData(false), 5 * 60 * 1000);
    const preferences = readIntegrationPreferences();
    if (preferences.autoUpdateCheck && Date.now() - preferences.lastUpdateCheck > 24 * 60 * 60 * 1000) checkForUpdates();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (syncTimer) clearInterval(syncTimer);
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('content:builtin-words', () => readContent('hebei-3000.json'));
ipcMain.handle('content:memory-release', () => readContent('memory-release.json'));
ipcMain.handle('content:memory-stories', () => readContent('memory-stories.json'));
ipcMain.handle('content:memory-story-overrides', () => readContent('memory-stories-v3-overrides.json'));
ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:corruption', () => corruptDataBackup);
ipcMain.handle('data:save', (_event, data) => writeData(data));
ipcMain.handle('data:backup', () => !!createBackup());
ipcMain.handle('data:backup-location', () => backupLocation());
ipcMain.handle('data:choose-backup-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择英语 Anki 备份目录',
    defaultPath: backupsDir(),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const directory = path.resolve(result.filePaths[0]);
  fs.mkdirSync(directory, { recursive: true });
  writeBackupPreferences(directory);
  const created = !!createBackup();
  return { ...backupLocation(), created };
});
ipcMain.handle('data:reset-backup-dir', () => {
  writeBackupPreferences('');
  const created = !!createBackup();
  return { ...backupLocation(), created };
});
ipcMain.handle('data:list-backups', () => {
  try {
    const dir = backupsDir();
    if (!fs.existsSync(dir)) return [];
    return backupFiles(dir)
      .map(name => {
        const file = path.join(dir, name);
        const stat = fs.statSync(file);
        return { name, time: stat.mtimeMs, size: stat.size, ...readBackupSummary(file) };
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 10);
  } catch {
    return [];
  }
});
ipcMain.handle('data:inspect-backup', (_event, name) => {
  const target = findBackup(name);
  if (!target) return { valid: false, integrity: 'failed', meta: null };
  const inspection = readBackupInspection(target.file);
  return { valid: inspection.valid, integrity: inspection.integrity, meta: inspection.meta };
});
ipcMain.handle('data:restore-backup', (_event, name) => {
  try {
    const target = findBackup(name);
    if (!target) return null;
    const inspection = readBackupInspection(target.file);
    if (!inspection.valid) return null;
    const current = readJsonFile(dataFile());
    if (current && !createBackup()) return null;
    writeData(inspection.data);
    try { fs.unlinkSync(sessionFile()); } catch {}
    return inspection.data;
  } catch {
    return null;
  }
});
ipcMain.handle('sync:status', () => syncStatus());
ipcMain.handle('sync:choose-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择 OneDrive、坚果云或其他同步文件夹',
    defaultPath: readIntegrationPreferences().syncDirectory || app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const directory = path.resolve(result.filePaths[0]);
  fs.mkdirSync(directory, { recursive: true });
  writeIntegrationPreferences({ syncDirectory: directory, lastSyncChecksum: '' });
  return syncStatus();
});
ipcMain.handle('sync:reset-directory', () => {
  writeIntegrationPreferences({ syncDirectory: '', lastSyncChecksum: '' });
  return syncStatus();
});
ipcMain.handle('sync:set-auto', (_event, enabled) => {
  writeIntegrationPreferences({ syncAuto: !!enabled });
  return syncStatus();
});
ipcMain.handle('sync:push', () => pushSyncData());
ipcMain.handle('sync:pull', () => pullSyncData());
ipcMain.handle('sync:auto', () => autoSyncData(true));
ipcMain.handle('update:status', () => {
  const preferences = readIntegrationPreferences();
  return {
    currentVersion: app.getVersion(),
    source: preferences.updateSource,
    auto: preferences.autoUpdateCheck,
    lastCheck: preferences.lastUpdateCheck,
    result: preferences.lastUpdateResult
  };
});
ipcMain.handle('update:set-preferences', (_event, preferences = {}) => {
  const source = String(preferences.source || '').trim();
  if (source && !path.isAbsolute(source)) {
    const url = new URL(source);
    if (url.protocol !== 'https:') throw new Error('版本源必须使用 HTTPS');
  }
  const next = writeIntegrationPreferences({ updateSource: source, autoUpdateCheck: preferences.auto !== false });
  return { currentVersion: app.getVersion(), source: next.updateSource, auto: next.autoUpdateCheck, lastCheck: next.lastUpdateCheck, result: next.lastUpdateResult };
});
ipcMain.handle('update:check', () => checkForUpdates());
ipcMain.handle('update:open-download', async (_event, value) => {
  const target = String(value || '');
  if (!target) return false;
  if (path.isAbsolute(target)) return (await shell.openPath(target)) === '';
  const url = new URL(target);
  if (url.protocol !== 'https:') return false;
  await shell.openExternal(url.toString());
  return true;
});
ipcMain.handle('session:load', () => readJsonFile(sessionFile()));
ipcMain.handle('session:save', (_event, payload) => {
  try {
    writeJsonAtomic(sessionFile(), payload || null);
    return true;
  } catch {
    return false;
  }
});
ipcMain.handle('session:clear', () => {
  try { fs.unlinkSync(sessionFile()); } catch {}
  return true;
});
ipcMain.handle('data:export', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出英语 Anki 学习记录',
    defaultPath: `英语-Anki-学习记录-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON 文件', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(payload, null, 2), 'utf8');
  return true;
});
ipcMain.on('app:flush-done', () => {
  if (!closeFlushPending) return;
  finishWindowClose();
});
ipcMain.on('app:flush-failed', () => cancelWindowClose());
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

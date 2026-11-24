import { createFsrsApi } from './fsrs.js';
import {
  getKv,
  setKv,
  deleteKv,
  putBackup,
  getBackup,
  listBackupRecords,
  deleteBackup
} from './idb.js';

const APP_VERSION = __APP_VERSION__;
const BACKUP_FORMAT = 'english-anki-backup-v2';
const AUTO_BACKUP_INTERVAL = 30 * 60 * 1000;
const MAX_BACKUPS = 20;
const GITHUB_LATEST_URL = 'https://github.com/SeanStellar/english-anki/releases/latest';
const GITHUB_ATOM_URL = 'https://github.com/SeanStellar/english-anki/releases.atom';

const fsrsApi = createFsrsApi();

function nativePlugins() {
  if (!window.Capacitor?.isNativePlatform?.()) return null;
  return window.Capacitor.Plugins || {};
}

function compareVersions(left, right) {
  const parse = value => String(value || '').replace(/^v/i, '').split(/[.-]/).slice(0, 3).map(part => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function htmlToPlainNotes(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|pre|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function releaseTagFromHtml(html) {
  const match = /\/releases\/tag\/(v?[0-9][A-Za-z0-9._-]*)/.exec(String(html || ''));
  return match ? decodeURIComponent(match[1]) : null;
}

function releaseNotesFromAtom(xml, version) {
  for (const match of String(xml || '').matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1];
    const link = /<link[^>]+href="([^"]+)"/.exec(entry)?.[1] || '';
    const tag = /\/releases\/tag\/([^/?#"]+)/.exec(link)?.[1];
    if (!tag || decodeURIComponent(tag) !== version) continue;
    const title = decodeXmlEntities((/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1] || '').trim());
    const body = htmlToPlainNotes(decodeXmlEntities(/<content[^>]*>([\s\S]*?)<\/content>/.exec(entry)?.[1] || ''));
    return [title, body].filter(Boolean).join('\n\n');
  }
  return '';
}

async function fetchNativeUpdateManifest() {
  const http = nativePlugins()?.CapacitorHttp;
  if (!http) throw new Error('当前环境不支持联网检查');
  const latest = await http.get({
    url: GITHUB_LATEST_URL,
    responseType: 'text',
    headers: { 'User-Agent': `English-Anki-Mobile/${APP_VERSION}` }
  });
  let version = /\/releases\/tag\/([^/?#]+)/.exec(latest.url || '')?.[1];
  if (version) version = decodeURIComponent(version);
  else version = releaseTagFromHtml(latest.data);
  if (!version) throw new Error(`HTTP ${latest.status}`);
  let notes = '';
  try {
    const atom = await http.get({ url: GITHUB_ATOM_URL, responseType: 'text' });
    notes = releaseNotesFromAtom(atom.data, version);
  } catch {}
  return {
    version,
    notes,
    downloadUrl: `https://github.com/SeanStellar/english-anki/releases/tag/${encodeURIComponent(version)}`
  };
}

function fetchJson(url) {
  return fetch(url, { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`${url} 请求失败（${response.status}）`);
    return response.json();
  });
}

async function loadBuiltinWords() {
  const manifest = await fetchJson('./data/decks.json');
  const files = [...new Set((manifest.decks || []).map(deck => deck.file).filter(Boolean))];
  const decks = await Promise.all(files.map(file => fetchJson(`./data/${file}`)));
  return { manifest, words: decks.flat() };
}

function loadMemoryRelease() {
  return fetchJson('./data/memory-release.json');
}

function loadMemoryStories() {
  return fetchJson('./data/memory-stories.json');
}

async function loadMemoryStoryOverrides() {
  const [overrides, kaoyan] = await Promise.all([
    fetchJson('./data/memory-stories-v3-overrides.json'),
    fetchJson('./data/memory-stories-kaoyan.json')
  ]);
  return { ...overrides, cards: [...(overrides.cards || []), ...(kaoyan.cards || [])] };
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isLearningData(data) {
  if (!isPlainRecord(data) || ![1, 2, 3, 4].includes(data.version)
    || !isPlainRecord(data.settings) || !isPlainRecord(data.cards)
    || !Array.isArray(data.logs) || !data.logs.every(isPlainRecord)) return false;
  for (const card of Object.values(data.cards)) {
    if (!isPlainRecord(card)) return false;
    if (card.reps !== undefined && (!Number.isFinite(Number(card.reps)) || Number(card.reps) < 0)) return false;
    if (Number(card.reps) > 0 && (card.due == null || card.due === '' || !Number.isFinite(new Date(card.due).getTime()))) return false;
  }
  for (const key of ['customWords', 'customDecks', 'cardIssues']) {
    if (data[key] !== undefined && (!Array.isArray(data[key]) || !data[key].every(isPlainRecord))) return false;
  }
  for (const key of ['wordOverrides', 'cardFlags', 'keywordStats', 'keywordProfile', 'fsrsProfile']) {
    if (data[key] !== undefined && !isPlainRecord(data[key])) return false;
  }
  return true;
}

function summarize(data) {
  return {
    version: Number(data.version) || 0,
    learned: Object.values(data.cards || {}).filter(card => card?.reps).length,
    reviews: Array.isArray(data.logs) ? data.logs.length : 0,
    customWords: Array.isArray(data.customWords) ? data.customWords.length : 0
  };
}

async function checksumFor(data) {
  if (!globalThis.crypto?.subtle) return null;
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(data)));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

function nextBackupName() {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `english-anki-backup-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createBackupRecord(data) {
  if (!isLearningData(data)) return null;
  const checksum = await checksumFor(data);
  const createdAt = new Date().toISOString();
  const payload = {
    format: checksum ? BACKUP_FORMAT : `${BACKUP_FORMAT}-web`,
    createdAt,
    checksum,
    data
  };
  return {
    name: nextBackupName(),
    createdAt,
    size: JSON.stringify(payload).length,
    valid: true,
    integrity: checksum ? 'verified' : 'unverified',
    meta: summarize(data),
    payload
  };
}

async function saveBackup(data) {
  const record = await createBackupRecord(data);
  if (!record) return null;
  await putBackup(record);
  await pruneBackups();
  return record;
}

async function pruneBackups() {
  const records = await listBackupRecords();
  if (records.length <= MAX_BACKUPS) return;
  const sorted = [...records].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  for (const record of sorted.slice(0, records.length - MAX_BACKUPS)) {
    await deleteBackup(record.name).catch(() => {});
  }
}

let lastAutoBackupAt = 0;

async function maybeAutoBackup(data) {
  const now = Date.now();
  if (now - lastAutoBackupAt < AUTO_BACKUP_INTERVAL) return;
  lastAutoBackupAt = now;
  try {
    await saveBackup(data);
  } catch {
    lastAutoBackupAt = 0;
  }
}

async function loadData() {
  const data = await getKv('learning-data');
  return data === undefined ? null : data;
}

async function saveData(data) {
  try {
    await setKv('learning-data', data);
    maybeAutoBackup(data);
    return true;
  } catch {
    return false;
  }
}

async function backupData() {
  try {
    const current = await loadData();
    if (!current) return false;
    return !!(await saveBackup(current));
  } catch {
    return false;
  }
}

function backupLocation() {
  return { directory: '应用内存储', custom: false };
}

async function listBackups() {
  const records = await listBackupRecords();
  return records
    .filter(record => record?.payload)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(record => ({
      name: record.name,
      time: record.createdAt,
      size: record.size,
      valid: record.valid !== false,
      integrity: record.integrity || 'unverified',
      meta: record.meta || null
    }));
}

async function inspectBackup(name) {
  const record = await getBackup(name);
  if (!record?.payload) return { valid: false, integrity: 'failed', meta: null };
  const data = record.payload.data;
  const schemaValid = isLearningData(data);
  let checksumValid = null;
  if (record.payload.checksum) {
    const current = await checksumFor(data);
    checksumValid = current === null ? null : current === record.payload.checksum;
  }
  const valid = schemaValid && checksumValid !== false;
  return {
    valid,
    integrity: valid ? (checksumValid ? 'verified' : 'unverified') : 'failed',
    meta: record.meta || summarize(data)
  };
}

async function restoreBackup(name) {
  const record = await getBackup(name);
  if (!record?.payload || !isLearningData(record.payload.data)) return null;
  try {
    const current = await loadData();
    if (current) await saveBackup(current);
  } catch {
    return null;
  }
  return record.payload.data;
}

function syncStatusUnavailable() {
  return {
    configured: false,
    state: 'disabled',
    auto: true,
    directory: '移动端暂不支持目录同步',
    remoteMeta: null
  };
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `english-anki-learning-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportData(data) {
  if (!isLearningData(data)) return false;
  const json = JSON.stringify(data, null, 2);
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  const fileName = `english-anki-learning-data-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.json`;
  const plugins = nativePlugins();
  if (plugins?.Filesystem) {
    let written = null;
    try {
      written = await plugins.Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: 'DOCUMENTS',
        encoding: 'utf8',
        recursive: true
      });
    } catch {}
    if (!written) {
      try {
        written = await plugins.Filesystem.writeFile({
          path: fileName,
          data: json,
          directory: 'CACHE',
          encoding: 'utf8'
        });
      } catch {}
    }
    if (written) {
      if (plugins.Share) {
        try {
          await plugins.Share.share({
            title: '英语 Anki 学习记录',
            text: '学习记录已保存到设备「文档」目录，也可以直接分享。',
            files: [written.uri],
            dialogTitle: '导出学习记录'
          });
        } catch {}
      }
      return true;
    }
  }
  try {
    const file = new File([json], fileName, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '英语 Anki 学习记录' });
      return true;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return false;
  }
  try {
    downloadJson(data);
    return true;
  } catch {
    return false;
  }
}

async function checkForUpdates() {
  const checkedAt = new Date().toISOString();
  if (!nativePlugins()?.CapacitorHttp) {
    return { ok: true, available: false, currentVersion: APP_VERSION, reason: 'no-source', checkedAt };
  }
  try {
    const manifest = await fetchNativeUpdateManifest();
    return {
      ok: true,
      available: compareVersions(manifest.version, APP_VERSION) > 0,
      currentVersion: APP_VERSION,
      version: manifest.version,
      notes: manifest.notes,
      downloadUrl: manifest.downloadUrl,
      checkedAt
    };
  } catch (error) {
    return { ok: false, available: false, currentVersion: APP_VERSION, checkedAt, error: error.message };
  }
}

async function openUpdateDownload(url) {
  const target = typeof url === 'string' && /^https:\/\//.test(url)
    ? url
    : 'https://github.com/SeanStellar/english-anki/releases/latest';
  const plugins = nativePlugins();
  if (plugins?.Browser) {
    try {
      await plugins.Browser.open({ url: target });
      return true;
    } catch {}
  }
  window.open(target, '_blank');
  return true;
}

const beforeCloseCallbacks = [];

function onBeforeClose(callback) {
  if (typeof callback !== 'function') return;
  beforeCloseCallbacks.push(callback);
  if (beforeCloseCallbacks.length > 1) return;
  const flush = () => {
    if (document.visibilityState !== 'hidden') return;
    for (const entry of beforeCloseCallbacks) {
      try {
        entry();
      } catch {}
    }
  };
  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', () => {
    for (const entry of beforeCloseCallbacks) {
      try {
        entry();
      } catch {}
    }
  });
}

window.englishAnki = {
  loadBuiltinWords,
  loadMemoryRelease,
  loadMemoryStories,
  loadMemoryStoryOverrides,
  loadData,
  dataCorruption: () => Promise.resolve(null),
  saveData,
  exportData,
  exportApkg: () => Promise.resolve({ error: '移动端暂不支持导出 Anki 牌组，可先导出学习记录 JSON' }),
  backupData,
  backupLocation,
  chooseBackupDirectory: () => Promise.resolve(null),
  resetBackupDirectory: () => Promise.resolve(backupLocation()),
  listBackups,
  inspectBackup,
  restoreBackup,
  syncStatus: () => Promise.resolve(syncStatusUnavailable()),
  chooseSyncDirectory: () => Promise.resolve(null),
  resetSyncDirectory: () => Promise.resolve(syncStatusUnavailable()),
  pushSyncData: () => Promise.resolve({ ok: false }),
  pullSyncData: () => Promise.resolve({ ok: false }),
  autoSyncData: () => Promise.resolve({ ok: true, action: 'disabled' }),
  setSyncAuto: () => Promise.resolve(syncStatusUnavailable()),
  updateStatus: () => Promise.resolve({ currentVersion: APP_VERSION, source: '', auto: true }),
  setUpdatePreferences: preferences => Promise.resolve({
    currentVersion: APP_VERSION,
    source: preferences?.source || '',
    auto: preferences?.auto !== false
  }),
  checkForUpdates,
  openUpdateDownload,
  loadStudySession: async () => {
    const session = await getKv('study-session');
    return session === undefined ? null : session;
  },
  saveStudySession: async payload => {
    try {
      await setKv('study-session', payload);
      return true;
    } catch {
      return false;
    }
  },
  clearStudySession: async () => {
    try {
      await deleteKv('study-session');
      return true;
    } catch {
      return false;
    }
  },
  setZoomFactor: factor => {
    document.documentElement.style.zoom = String(factor);
  },
  defaultFsrsWeights: fsrsApi.defaultFsrsWeights,
  schedule: fsrsApi.schedule,
  createCard: fsrsApi.createCard,
  onBeforeClose,
  confirmClose: () => {},
  cancelClose: () => {},
  window: { minimize() {}, maximize() {}, close() {} }
};
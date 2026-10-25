const { contextBridge, ipcRenderer, webFrame } = require('electron');
const { fsrs, generatorParameters, Rating, createEmptyCard } = require('ts-fsrs');

const schedulerCache = new Map();
const defaultFsrsWeights = generatorParameters().w.slice();

function normalizedWeights(value) {
  if (!Array.isArray(value) || value.length !== defaultFsrsWeights.length) return defaultFsrsWeights;
  const next = value.map(Number);
  return next.every(Number.isFinite) ? next : defaultFsrsWeights;
}

function schedulerFor(options = {}) {
  const requestRetention = Math.max(0.7, Math.min(0.99, Number(options.requestRetention) || 0.9));
  const maximumInterval = Math.max(1, Math.min(36500, Math.round(Number(options.maximumInterval) || 36500)));
  const weights = normalizedWeights(options.weights);
  const enableFuzz = options.enableFuzz !== false;
  const key = `${requestRetention}:${maximumInterval}:${enableFuzz}:${weights.map(value => value.toFixed(6)).join(',')}`;
  if (!schedulerCache.has(key)) {
    schedulerCache.set(key, fsrs(generatorParameters({
      request_retention: requestRetention,
      maximum_interval: maximumInterval,
      w: weights,
      enable_fuzz: enableFuzz,
      enable_short_term: true
    })));
  }
  return schedulerCache.get(key);
}

function normalizeCard(source) {
  if (!source) return createEmptyCard(new Date());
  return {
    ...source,
    due: new Date(source.due),
    last_review: source.last_review ? new Date(source.last_review) : undefined
  };
}

const api = {
  loadBuiltinWords: () => ipcRenderer.invoke('content:builtin-words'),
  loadMemoryRelease: () => ipcRenderer.invoke('content:memory-release'),
  loadMemoryStories: () => ipcRenderer.invoke('content:memory-stories'),
  loadMemoryStoryOverrides: () => ipcRenderer.invoke('content:memory-story-overrides'),
  loadData: () => ipcRenderer.invoke('data:load'),
  dataCorruption: () => ipcRenderer.invoke('data:corruption'),
  saveData: data => ipcRenderer.invoke('data:save', data),
  exportData: data => ipcRenderer.invoke('data:export', data),
  exportApkg: payload => ipcRenderer.invoke('data:export-apkg', payload),
  backupData: () => ipcRenderer.invoke('data:backup'),
  backupLocation: () => ipcRenderer.invoke('data:backup-location'),
  chooseBackupDirectory: () => ipcRenderer.invoke('data:choose-backup-dir'),
  resetBackupDirectory: () => ipcRenderer.invoke('data:reset-backup-dir'),
  listBackups: () => ipcRenderer.invoke('data:list-backups'),
  inspectBackup: name => ipcRenderer.invoke('data:inspect-backup', name),
  restoreBackup: name => ipcRenderer.invoke('data:restore-backup', name),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  chooseSyncDirectory: () => ipcRenderer.invoke('sync:choose-directory'),
  resetSyncDirectory: () => ipcRenderer.invoke('sync:reset-directory'),
  pushSyncData: () => ipcRenderer.invoke('sync:push'),
  pullSyncData: () => ipcRenderer.invoke('sync:pull'),
  autoSyncData: () => ipcRenderer.invoke('sync:auto'),
  setSyncAuto: enabled => ipcRenderer.invoke('sync:set-auto', enabled),
  updateStatus: () => ipcRenderer.invoke('update:status'),
  setUpdatePreferences: preferences => ipcRenderer.invoke('update:set-preferences', preferences),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  openUpdateDownload: url => ipcRenderer.invoke('update:open-download', url),
  loadStudySession: () => ipcRenderer.invoke('session:load'),
  saveStudySession: payload => ipcRenderer.invoke('session:save', payload),
  clearStudySession: () => ipcRenderer.invoke('session:clear'),
  setZoomFactor: factor => webFrame.setZoomFactor(Math.max(1, Math.min(1.35, Number(factor) || 1.15))),
  defaultFsrsWeights: defaultFsrsWeights.slice(),
  schedule: (card, options = {}, now = new Date().toISOString()) => {
    const reviewTime = new Date(now);
    const maximumInterval = Math.max(1, Math.min(36500, Math.round(Number(options.maximumInterval) || 36500)));
    const result = schedulerFor(options).repeat(normalizeCard(card), reviewTime);
    const clampInterval = item => {
      if (!item?.card || Number(item.card.scheduled_days) <= maximumInterval) return item;
      return {
        ...item,
        card: {
          ...item.card,
          scheduled_days: maximumInterval,
          due: new Date(reviewTime.getTime() + maximumInterval * 86_400_000)
        }
      };
    };
    return {
      again: clampInterval(result[Rating.Again]),
      hard: clampInterval(result[Rating.Hard]),
      good: clampInterval(result[Rating.Good]),
      easy: clampInterval(result[Rating.Easy])
    };
  },
  createCard: () => createEmptyCard(new Date()),
  onBeforeClose: callback => ipcRenderer.on('app:before-close', () => callback()),
  confirmClose: () => ipcRenderer.send('app:flush-done'),
  cancelClose: () => ipcRenderer.send('app:flush-failed'),
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close')
  }
};

contextBridge.exposeInMainWorld('englishAnki', api);

/* 英语 Anki - familiar-word linking + FSRS scheduling */
if (!window.englishAnki) {
  const makeSchedule = (source, days, rating) => {
    const now = new Date();
    const due = new Date(now.getTime() + days * 86_400_000);
    return { card: { ...(source || {}), due: due.toISOString(), stability: Math.max(.1, (source?.stability || .3) * (rating < 3 ? .7 : rating === 3 ? 2.5 : 4)), difficulty: source?.difficulty || 5, elapsed_days: 0, scheduled_days: days, reps: (source?.reps || 0) + 1, lapses: (source?.lapses || 0) + (rating === 1 ? 1 : 0), state: rating < 3 ? 1 : 2, last_review: now.toISOString() } };
  };
  window.englishAnki = {
    loadBuiltinWords: () => fetch('./data/hebei-3000.json').then(response => response.json()),
    loadMemoryRelease: () => fetch('./data/memory-release.json').then(response => response.json()),
    loadMemoryStories: () => fetch('./data/memory-stories.json').then(response => response.json()),
    loadMemoryStoryOverrides: () => fetch('./data/memory-stories-v3-overrides.json').then(response => response.json()),
    loadData: () => Promise.resolve(JSON.parse(localStorage.getItem('english-anki-preview') || localStorage.getItem('mori-preview') || 'null')),
    saveData: data => { localStorage.setItem('english-anki-preview', JSON.stringify(data)); return Promise.resolve(true); },
    exportData: () => Promise.resolve(false),
    backupData: () => Promise.resolve(false),
    backupLocation: () => Promise.resolve({ directory: '浏览器预览模式', custom: false }),
    chooseBackupDirectory: () => Promise.resolve(null),
    resetBackupDirectory: () => Promise.resolve({ directory: '浏览器预览模式', custom: false }),
    listBackups: () => Promise.resolve([]),
    restoreBackup: () => Promise.resolve(null),
    syncStatus: () => Promise.resolve({ configured: false, state: 'disabled', auto: true }),
    chooseSyncDirectory: () => Promise.resolve(null),
    resetSyncDirectory: () => Promise.resolve({ configured: false, state: 'disabled', auto: true }),
    pushSyncData: () => Promise.resolve({ ok: false }),
    pullSyncData: () => Promise.resolve({ ok: false }),
    autoSyncData: () => Promise.resolve({ ok: true, action: 'disabled' }),
    setSyncAuto: () => Promise.resolve({ configured: false, state: 'disabled', auto: true }),
    updateStatus: () => Promise.resolve({ currentVersion: '4.0.1', source: '', auto: true }),
    setUpdatePreferences: preferences => Promise.resolve({ currentVersion: '4.0.1', source: preferences.source || '', auto: preferences.auto !== false }),
    checkForUpdates: () => Promise.resolve({ ok: true, available: false, currentVersion: '4.0.1', reason: 'no-source' }),
    openUpdateDownload: () => Promise.resolve(false),
    loadStudySession: () => Promise.resolve(null),
    saveStudySession: () => Promise.resolve(true),
    clearStudySession: () => Promise.resolve(true),
    setZoomFactor: factor => { document.documentElement.style.zoom = String(factor); },
    defaultFsrsWeights: [0.212,1.2931,2.3065,8.2956,6.4133,0.8334,3.0194,0.001,1.8722,0.1666,0.796,1.4835,0.0614,0.2629,1.6483,0.6014,1.8729,0.5425,0.0912,0.0658,0.1542],
    schedule: card => ({ again: makeSchedule(card, 1 / 1440, 1), hard: makeSchedule(card, 6 / 1440, 2), good: makeSchedule(card, 1, 3), easy: makeSchedule(card, 4, 4) }),
    window: { minimize() {}, maximize() {}, close() {} }
  };
}
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const DAY = 86_400_000;

const deckDefinitions = [
  { id: 'hebei-3000', name: '河北专升本英语 3000 词', short: '专升本 3000', desc: '高职英语课程标准附录全词表', color: '#1da779', icon: '河', tier: null },
  { id: 'tier-0', name: '官方基础词', short: '官方基础', desc: '核心基础 · 2099 个词条', color: '#5474db', icon: '基', tier: 0 },
  { id: 'tier-1', name: '基础模块词', short: '基础模块', desc: '重点强化 · 500 个词条', color: '#e69b55', icon: '重', tier: 1 },
  { id: 'tier-2', name: '拓展模块词', short: '拓展模块', desc: '能力拔高 · 400 个词条', color: '#9a6cd4', icon: '拓', tier: 2 }
];

const curated = {
  abandon: { memory: 'a + band + on：乐队不再演出，所有人“离开、抛弃”舞台', example: 'He had to <strong>abandon</strong> the plan.', zh: '他不得不放弃这个计划。', icon: '🚪' },
  absorb: { memory: 'ab + sorb，像海绵把水全部“吸收”进去', example: 'Plants <strong>absorb</strong> water through their roots.', zh: '植物通过根部吸收水分。', icon: '🧽' },
  abstract: { memory: 'abs（离开）+ tract（拉）→ 从具体事物里抽离出来', example: 'Love is an <strong>abstract</strong> idea.', zh: '爱是一个抽象概念。', icon: '◈' },
  accurate: { memory: 'ac（加强）+ cur（关心）+ ate → 处处留心才会准确', example: 'The report is clear and <strong>accurate</strong>.', zh: '这份报告清晰而准确。', icon: '🎯' },
  acquire: { memory: 'ac + quire（寻求）→ 经过寻找而获得', example: 'She <strong>acquired</strong> new skills at work.', zh: '她在工作中获得了新技能。', icon: '🧩' },
  anticipate: { memory: 'anti（在前）+ cip（拿）→ 提前拿到信息，预料到', example: 'We <strong>anticipate</strong> a busy week.', zh: '我们预计这周会很忙。', icon: '🔭' },
  approach: { memory: 'ap（靠近）+ proach → 一步一步靠近目标', example: 'The train is <strong>approaching</strong> the station.', zh: '火车正在接近车站。', icon: '🚶' },
  appropriate: { memory: 'proper 藏在 appropriate 里：合适、恰当', example: 'Wear clothes that are <strong>appropriate</strong> for the weather.', zh: '穿适合天气的衣服。', icon: '✓' },
  available: { memory: 'avail（有用）+ able（能够）→ 能拿来用的', example: 'The book is <strong>available</strong> online.', zh: '这本书可以在网上找到。', icon: '🟢' },
  benefit: { memory: 'bene（好）+ fit（做）→ 做了有好处', example: 'Exercise <strong>benefits</strong> both body and mind.', zh: '运动有益身心。', icon: '🌱' },
  challenge: { memory: '把 challenge 想成一座等你翻越的高山：挑战', example: 'Learning a language is an exciting <strong>challenge</strong>.', zh: '学习语言是一项令人兴奋的挑战。', icon: '⛰️' },
  concentrate: { memory: 'con（一起）+ centr（中心）→ 注意力聚到中心', example: 'Please <strong>concentrate</strong> on the question.', zh: '请集中注意力思考这个问题。', icon: '◎' },
  consequence: { memory: 'con（一起）+ sequ（跟随）→ 随之而来的结果', example: 'Every decision has a <strong>consequence</strong>.', zh: '每个决定都有后果。', icon: '🁢' },
  contrast: { memory: 'contra（相反）+ st（站）→ 站在对面作比较', example: 'The white walls <strong>contrast</strong> with the dark floor.', zh: '白墙与深色地板形成对比。', icon: '◐' },
  crucial: { memory: '想象十字路口 cross：关键的选择就在路口', example: 'Sleep is <strong>crucial</strong> for memory.', zh: '睡眠对记忆至关重要。', icon: '✦' },
  decline: { memory: 'de（向下）+ cline（倾斜）→ 向下倾斜、下降', example: 'Sales began to <strong>decline</strong> in winter.', zh: '销售额在冬季开始下降。', icon: '📉' },
  demonstrate: { memory: 'de + monstr（展示）→ 清楚地演示给人看', example: 'The teacher <strong>demonstrated</strong> the experiment.', zh: '老师演示了这个实验。', icon: '👩‍🏫' },
  efficient: { memory: 'effect + -ive：用更少力气产生更好效果', example: 'This is a simple and <strong>efficient</strong> method.', zh: '这是一个简单高效的方法。', icon: '⚡' },
  essential: { memory: 'essence（本质）+ ial → 触及本质，所以必不可少', example: 'Water is <strong>essential</strong> for life.', zh: '水对生命必不可少。', icon: '💧' },
  maintain: { memory: 'main（手）+ tain（握住）→ 一直握住，保持下去', example: 'It is hard to <strong>maintain</strong> a healthy habit.', zh: '保持健康习惯并不容易。', icon: '🤲' },
  significant: { memory: 'sign（标志）+ fic（做）→ 做出明显标志，意义重大', example: 'This was a <strong>significant</strong> improvement.', zh: '这是一次显著的进步。', icon: '⭐' },
  withdraw: { memory: 'with（向后）+ draw（拉）→ 向后拉回、撤回、取出', example: 'She <strong>withdrew</strong> some money from the bank.', zh: '她从银行取了一些钱。', icon: '↩' }
};

const affixes = [
  ['anti', '反、在前'], ['inter', '在……之间'], ['trans', '跨越、转变'], ['under', '在下、不足'], ['over', '过度、在上'],
  ['pre', '在前、预先'], ['post', '在后'], ['sub', '在下、次级'], ['super', '在上、超过'], ['dis', '分开、否定'],
  ['un', '否定'], ['re', '再次、向后'], ['de', '向下、去除'], ['con', '共同、加强'], ['com', '共同、一起'],
  ['pro', '向前、赞成'], ['ex', '向外、以前'], ['im', '进入、否定'], ['in', '进入、否定'], ['mis', '错误'],
  ['tion', '名词后缀'], ['ment', '结果、状态'], ['ness', '性质、状态'], ['able', '能够……的'], ['less', '没有……的'],
  ['ful', '充满……的'], ['ive', '有……性质的'], ['ous', '具有……的'], ['ist', '从事……的人'], ['er', '人或器物']
];

const memoryTips = [
  '先回忆，再看答案。那几秒钟的努力，正是记忆变牢的时刻。',
  '把单词放进一个夸张画面里。画面越离谱，大脑越不愿意删掉它。',
  '评分要诚实：刚刚犹豫过，就选“模糊”，FSRS 会在恰好的时间带它回来。',
  '听到发音后再拼一次，声音和字形会形成两条独立的提取路径。',
  '短时高专注胜过长时浏览。每 20 张卡停十秒，让大脑完成编码。'
];

let words = [];
let releaseInfo = null;
let memoryStories = new Map();
let state;
let currentRoute = 'home';
let selectedDeck = 'hebei-3000';
let libraryFilter = 'all';
let libraryPage = 0;
let editingDeckId = '';
let editingWordId = '';
let editingWordIsBuiltin = false;
let editingWordIsNew = false;
let currentCardActionWordId = '';
let currentIssueFilter = 'open';
let pendingUpdateResult = null;
let lastModalFocus = null;
const LIBRARY_PAGE_SIZE = 250;
let studyQueue = [];
let currentStudyIndex = 0;
let initialQueueSize = 0;
let currentStudyMode = 'normal';
let currentStudyLabel = '';
let lastRatingUndo = null;
let studyAdvanceTimer = 0;
let cardShownAt = 0;
let studySessionStartedAt = 0;
let lastRestPromptAt = 0;
let rhythmTimer = 0;
let breakTimer = 0;
let breakEndsAt = 0;
let schedules = null;
let ratingLocked = false;
let studyQueueKinds = new Map();
const revealOrder = ['scenePanel', 'keywordLinkPanel', 'keywordScenePanel'];
let revealedAnswerPanels = new Set();
let currentKeywordLink = null;
let keywordFamiliarityCache = new Map();
const relatedWordCache = new Map();
let relatedVocabularyIndex = null;
let saveTimer;
let memoryGraph = {
  nodes: [], edges: [], projected: [], focusWord: null, strongIds: new Set(),
  rotationX: -.14, rotationY: .22, zoom: 1, dragging: false, dragDistance: 0,
  lastX: 0, lastY: 0, hovered: null, frame: null, width: 0, height: 0, dpr: 1, lastDraw: 0,
  relations: [], history: [], autoRotate: true, onlyStrong: false, hoverX: 0, hoverY: 0,
  searchResults: [], searchIndex: -1
};
let memoryResizeObserver;
const wordTonePalette = ['#8974f6', '#3ea6ff', '#62d9bd', '#f078b2', '#ff9b69', '#b86ff3'];
let performanceProfile = {
  lite: false,
  reason: 'full',
  monitorFrame: 0,
  sampleStartedAt: 0,
  sampleFrames: 0,
  slowSamples: 0,
  toneIndex: 0,
  toneTimer: null
};

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function examStudyPlan(dateValue = state?.settings?.examDate || '') {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const exam = new Date(`${dateValue}T23:59:59`);
  const days = Math.ceil((exam.getTime() - Date.now()) / DAY);
  if (!Number.isFinite(days) || days < 1) return { expired: true, days: 0, remaining: newWords('hebei-3000').length, recommended: 0 };
  const remaining = newWords('hebei-3000').length;
  const learningDays = Math.max(1, Math.floor(days * .8));
  const recommended = remaining ? Math.max(1, Math.min(1000, Math.ceil(remaining / learningDays))) : 0;
  return { expired: false, days, learningDays, remaining, recommended };
}

function updateExamPlanPreview() {
  const input = $('#examDateInput');
  const box = $('#examPlanPreview');
  if (!input || !box) return null;
  const plan = examStudyPlan(input.value);
  const button = $('#applyExamPlanBtn');
  if (!plan) {
    box.querySelector('p').textContent = '设置考试日期后生成冲刺计划。';
    button.disabled = true;
    return null;
  }
  if (plan.expired) {
    box.querySelector('p').textContent = '考试日期需要晚于今天。';
    button.disabled = true;
    return plan;
  }
  box.querySelector('p').textContent = plan.remaining
    ? `距考试 ${plan.days} 天，内置 3000 词还剩 ${plan.remaining} 个新词。预留 20% 时间复习，建议每天新学 ${plan.recommended} 个。`
    : `距考试 ${plan.days} 天，内置 3000 词的新词已经学完，保持到期复习即可。`;
  button.disabled = !plan.recommended;
  return plan;
}

function defaultState() {
  return {
    version: 4,
    settings: {
      dailyNew: 20,
      dailyReview: -1,
      workloadProtection: true,
      dailyStudyMinutes: 45,
      autoSpeak: true,
      theme: 'light',
      performanceMode: 'auto',
      zoom: 'auto',
      desiredRetention: 0.9,
      maximumInterval: 36500,
      examDate: '',
      restReminderEnabled: true,
      restReminderMinutes: 25,
      libraryOnboardingSeen: false
    },
    cards: {},
    logs: [],
    keywordStats: {},
    keywordProfile: { known: {}, rejected: {}, swaps: {} },
    wordOverrides: {},
    cardFlags: {},
    cardIssues: [],
    fsrsProfile: { weights: null, optimizedAt: '', calibrationScale: 1, sampleSize: 0, uniqueWords: 0 },
    customWords: [],
    customDecks: [],
    selectedDeck: 'hebei-3000',
    createdAt: new Date().toISOString()
  };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeState(saved) {
  const base = defaultState();
  if (!saved || ![1, 2, 3, 4].includes(saved.version)) return base;
  const { vocabularyLevel: _legacyVocabularyLevel, uiScale: _legacyUiScale, ...savedSettings } = isPlainObject(saved.settings) ? saved.settings : {};
  if (saved.version < 3 && savedSettings.dailyReview === 200) savedSettings.dailyReview = -1;
  const savedKeywordProfile = isPlainObject(saved.keywordProfile) ? saved.keywordProfile : {};
  return {
    ...base,
    ...saved,
    version: 4,
    settings: { ...base.settings, ...savedSettings },
    cards: isPlainObject(saved.cards)
      ? Object.fromEntries(Object.entries(saved.cards).filter(([, card]) => isPlainObject(card)))
      : {},
    logs: Array.isArray(saved.logs) ? saved.logs.filter(isPlainObject) : [],
    keywordStats: isPlainObject(saved.keywordStats) ? saved.keywordStats : {},
    keywordProfile: {
      ...base.keywordProfile,
      ...savedKeywordProfile,
      known: isPlainObject(savedKeywordProfile.known) ? savedKeywordProfile.known : {},
      rejected: isPlainObject(savedKeywordProfile.rejected) ? savedKeywordProfile.rejected : {},
      swaps: isPlainObject(savedKeywordProfile.swaps) ? savedKeywordProfile.swaps : {}
    },
    customWords: Array.isArray(saved.customWords) ? saved.customWords.filter(isPlainObject) : [],
    customDecks: Array.isArray(saved.customDecks) ? saved.customDecks.filter(isPlainObject) : [],
    wordOverrides: isPlainObject(saved.wordOverrides) ? saved.wordOverrides : {},
    cardFlags: isPlainObject(saved.cardFlags) ? saved.cardFlags : {},
    cardIssues: Array.isArray(saved.cardIssues) ? saved.cardIssues.filter(isPlainObject) : [],
    fsrsProfile: { ...base.fsrsProfile, ...(isPlainObject(saved.fsrsProfile) ? saved.fsrsProfile : {}) }
  };
}

function validImportedLearningData(data) {
  return isPlainObject(data)
    && [1, 2, 3, 4].includes(data.version)
    && isPlainObject(data.settings)
    && isPlainObject(data.cards)
    && Array.isArray(data.logs)
    && (data.customWords === undefined || Array.isArray(data.customWords))
    && (data.customDecks === undefined || Array.isArray(data.customDecks))
    && (data.cardIssues === undefined || Array.isArray(data.cardIssues))
    && (data.wordOverrides === undefined || isPlainObject(data.wordOverrides))
    && (data.cardFlags === undefined || isPlainObject(data.cardFlags));
}

function persist(touch = true) {
  if (touch) state.updatedAt = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.englishAnki.saveData(state).catch(() => toast('学习数据保存失败，请检查磁盘空间或关闭占用文件的程序'));
  }, 80);
}

function advanceLiteWordTone() {
  if (!performanceProfile.lite || currentRoute !== 'study') return;
  performanceProfile.toneIndex = (performanceProfile.toneIndex + 1) % wordTonePalette.length;
  const tone = wordTonePalette[performanceProfile.toneIndex];
  $$('.word-card').forEach(card => card.style.setProperty('--word-tone', tone));
}

function setPerformanceLite(enabled, reason = 'full') {
  const changed = performanceProfile.lite !== enabled;
  performanceProfile.lite = enabled;
  performanceProfile.reason = reason;
  document.body.classList.toggle('performance-lite', enabled);
  document.body.dataset.performanceProfile = enabled ? 'smooth' : 'full';

  if (enabled && !performanceProfile.toneTimer) {
    advanceLiteWordTone();
    performanceProfile.toneTimer = setInterval(advanceLiteWordTone, 2400);
  } else if (!enabled && performanceProfile.toneTimer) {
    clearInterval(performanceProfile.toneTimer);
    performanceProfile.toneTimer = null;
    $$('.word-card').forEach(card => card.style.removeProperty('--word-tone'));
  }

  if (changed && currentRoute === 'memory' && memoryGraph.focusWord) {
    buildMemoryGraph(memoryGraph.focusWord);
    resizeMemoryCanvas();
  }
  if (enabled) stopPerformanceMonitor();
}

function applyPerformanceMode(notify = false) {
  const requested = ['auto', 'full', 'smooth'].includes(state.settings.performanceMode) ? state.settings.performanceMode : 'auto';
  state.settings.performanceMode = requested;
  const cores = Number(navigator.hardwareConcurrency) || 8;
  const memory = Number(navigator.deviceMemory) || 8;
  const lowHardware = cores <= 4 || memory <= 4;
  const lite = requested === 'smooth' || (requested === 'auto' && lowHardware);
  setPerformanceLite(lite, requested === 'auto' && lowHardware ? 'hardware' : requested);
  performanceProfile.slowSamples = 0;
  if (requested === 'auto' && !lite && ['study', 'memory'].includes(currentRoute)) startPerformanceMonitor();
  else stopPerformanceMonitor();
  if (notify) toast(lite ? '已启用流畅模式：保留 3D 与动态颜色，减少高开销特效' : requested === 'full' ? '已启用完整特效模式' : '已启用自动性能调节');
}

function startPerformanceMonitor() {
  if (performanceProfile.monitorFrame) return;
  performanceProfile.sampleStartedAt = 0;
  performanceProfile.sampleFrames = 0;
  performanceProfile.monitorFrame = requestAnimationFrame(monitorPerformance);
}

function stopPerformanceMonitor() {
  if (performanceProfile.monitorFrame) cancelAnimationFrame(performanceProfile.monitorFrame);
  performanceProfile.monitorFrame = 0;
}

function monitorPerformance(time = 0) {
  performanceProfile.monitorFrame = 0;
  if (document.hidden || !['study', 'memory'].includes(currentRoute) || state.settings.performanceMode !== 'auto' || performanceProfile.lite) {
    performanceProfile.sampleStartedAt = 0;
    performanceProfile.sampleFrames = 0;
    return;
  }
  performanceProfile.monitorFrame = requestAnimationFrame(monitorPerformance);
  if (!performanceProfile.sampleStartedAt) performanceProfile.sampleStartedAt = time;
  performanceProfile.sampleFrames += 1;
  const elapsed = time - performanceProfile.sampleStartedAt;
  if (elapsed < 2200) return;
  const fps = performanceProfile.sampleFrames * 1000 / Math.max(1, elapsed);
  performanceProfile.slowSamples = fps < 47 ? performanceProfile.slowSamples + 1 : Math.max(0, performanceProfile.slowSamples - 1);
  performanceProfile.sampleStartedAt = time;
  performanceProfile.sampleFrames = 0;
  if (performanceProfile.slowSamples >= 2) setPerformanceLite(true, 'frame-rate');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function serializableSnapshot(value) {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value));
}

function allDecks() {
  return [...deckDefinitions, ...state.customDecks];
}

function allWords() {
  return [...words, ...state.customWords].map(source => {
    const override = state.wordOverrides?.[source.id];
    if (!override) return source;
    return { ...source, ...override, id: source.id, deckId: source.deckId, number: source.number, tier: source.tier, tierName: source.tierName };
  });
}

function rawWordById(wordId) {
  return state.customWords.find(word => word.id === wordId) || words.find(word => word.id === wordId) || null;
}

function wordById(wordId) {
  return allWords().find(word => word.id === wordId) || null;
}

function wordIsAvailable(word) {
  return !state.cardFlags?.[word.id]?.suspended;
}

function deckFor(id) {
  return allDecks().find(deck => deck.id === id) || deckDefinitions[0];
}

function resolvedSelectedDeckId() {
  const next = allDecks().some(deck => deck.id === selectedDeck) ? selectedDeck : 'hebei-3000';
  if (selectedDeck !== next) selectedDeck = next;
  if (state && state.selectedDeck !== next) state.selectedDeck = next;
  return next;
}

function wordsForDeck(id) {
  const deck = deckFor(id);
  const source = allWords();
  if (deck.tier !== null && deck.tier !== undefined) return source.filter(word => word.deckId === 'hebei-3000' && word.tier === deck.tier);
  return source.filter(word => word.deckId === id);
}

function wordStatus(word) {
  if (state.cardFlags?.[word.id]?.suspended) return 'suspended';
  const card = state.cards[word.id];
  if (!card || !card.reps) return 'new';
  if ((card.stability || 0) >= 21 && (card.lapses || 0) <= Math.max(2, card.reps * .25)) return 'mastered';
  return 'learning';
}

function dueReviewWords(deckId = 'hebei-3000') {
  const now = Date.now();
  return wordsForDeck(deckId)
    .filter(word => {
      if (!wordIsAvailable(word)) return false;
      const card = state.cards[word.id];
      return card?.reps > 0 && new Date(card.due).getTime() <= now;
    })
    .map(word => ({ word, due: new Date(state.cards[word.id].due).getTime() }))
    .sort((left, right) => left.due - right.due
      || (Number(left.word.number) || 0) - (Number(right.word.number) || 0)
      || String(left.word.id).localeCompare(String(right.word.id)))
    .map(item => item.word);
}

function newWords(deckId = 'hebei-3000') {
  return wordsForDeck(deckId).filter(word => wordIsAvailable(word) && !state.cards[word.id]?.reps);
}

function todayLogs() {
  const key = todayKey();
  return state.logs.filter(log => log.date === key);
}

function trimmedAverage(values, fallback) {
  const sorted = values.filter(Number.isFinite).filter(value => value >= 1 && value <= 180).sort((a, b) => a - b);
  if (!sorted.length) return fallback;
  const trim = sorted.length >= 10 ? Math.floor(sorted.length * .1) : 0;
  const sample = sorted.slice(trim, sorted.length - trim || undefined);
  return sample.reduce((sum, value) => sum + value, 0) / Math.max(1, sample.length);
}

function personalStudyPace() {
  const recent = state.logs.slice(-500).map(log => ({ ...log, seconds: Number(log.responseTimeMs || log.elapsedMs) / 1000 }))
    .filter(log => Number.isFinite(log.seconds) && log.seconds >= 1 && log.seconds <= 180);
  const newSeconds = trimmedAverage(recent.filter(log => log.isNew).map(log => log.seconds), 28);
  const reviewSeconds = trimmedAverage(recent.filter(log => !log.isNew).map(log => log.seconds), 10);
  const againRate = recent.length ? recent.filter(log => log.rating === 'again').length / recent.length : .12;
  return {
    newSeconds: Math.max(8, Math.min(90, newSeconds)),
    reviewSeconds: Math.max(3, Math.min(45, reviewSeconds)),
    againRate,
    sampleSize: recent.length
  };
}

function planFor(deckId = 'hebei-3000') {
  const logs = todayLogs();
  const reviewedIds = new Set(logs.map(log => log.wordId));
  const newDoneIds = new Set(logs.filter(log => log.isNew).map(log => log.wordId));
  const reviewDoneIds = new Set(logs
    .filter(log => !log.isNew && !newDoneIds.has(log.wordId))
    .map(log => log.wordId));
  const reviewDone = reviewDoneIds.size;
  const allDue = dueReviewWords(deckId).filter(word => !reviewedIds.has(word.id));
  const reviewLimit = state.settings.dailyReview === -1
    ? allDue.length
    : Math.max(0, Number(state.settings.dailyReview || 0) - reviewDone);
  const reviews = allDue.slice(0, reviewLimit);
  const allFresh = newWords(deckId).filter(word => !reviewedIds.has(word.id));
  const configuredNew = state.settings.dailyNew === -1 ? allFresh.length : Math.max(0, Number(state.settings.dailyNew || 0) - newDoneIds.size);
  const targetNew = Math.min(allFresh.length, configuredNew);
  const pace = personalStudyPace();
  const spentSeconds = logs.reduce((sum, log) => sum + Math.max(0, Number(log.responseTimeMs || log.elapsedMs) || 0) / 1000, 0);
  const budgetSeconds = Math.max(15, Math.min(240, Number(state.settings.dailyStudyMinutes) || 45)) * 60;
  const repeatFactor = 1 + pace.againRate * .45;
  const reviewSeconds = reviews.length * pace.reviewSeconds * repeatFactor;
  const availableNewSeconds = Math.max(0, budgetSeconds - spentSeconds - reviewSeconds);
  const protectedNew = state.settings.workloadProtection === false
    ? targetNew
    : Math.max(0, Math.min(targetNew, Math.floor(availableNewSeconds / Math.max(1, pace.newSeconds * repeatFactor))));
  const fresh = allFresh.slice(0, protectedNew);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const overdue = reviews.filter(word => new Date(state.cards[word.id]?.due).getTime() < startToday.getTime()).length;
  const estimateSeconds = (reviewSeconds + fresh.length * pace.newSeconds * repeatFactor);
  const meta = {
    pace,
    targetNew,
    effectiveNew: fresh.length,
    deferredNew: Math.max(0, targetNew - fresh.length),
    overdue,
    dueTotal: allDue.length,
    spentMinutes: Math.round(spentSeconds / 60),
    estimateMinutes: Math.max(0, Math.ceil(estimateSeconds / 60)),
    budgetMinutes: Math.round(budgetSeconds / 60),
    protectionActive: state.settings.workloadProtection !== false && fresh.length < targetNew
  };
  return { reviews, fresh, queue: [...reviews, ...fresh], meta };
}

function route(name, options = {}) {
  currentRoute = name;
  document.body.classList.toggle('study-mode', name === 'study');
  document.body.classList.toggle('memory-mode', name === 'memory');
  if (name === 'study') startRhythmTimer();
  else { clearInterval(rhythmTimer); rhythmTimer = 0; }
  if (['study', 'memory'].includes(name)) {
    if (state.settings.performanceMode === 'auto' && !performanceProfile.lite) startPerformanceMonitor();
  } else stopPerformanceMonitor();
  if (name !== 'memory' && memoryGraph.frame) { cancelAnimationFrame(memoryGraph.frame); memoryGraph.frame = null; }
  $$('.view').forEach(view => view.classList.toggle('active', view.dataset.view === name));
  $$('[data-route]').forEach(button => button.classList.toggle('active', button.dataset.route === name));
  const labels = { home: '今日计划', study: '沉浸学习', memory: '记忆星图', library: '词库管理', stats: '学习统计' };
  $('#routeLabel').textContent = labels[name];
  if (name === 'home') renderHome();
  if (name === 'library') { libraryPage = 0; renderLibrary(); }
  if (name === 'stats') renderStats();
  if (name === 'memory') renderMemory(options.wordId);
  if (name === 'study' && options.start !== false) maybeStartStudy(options.deckId || selectedDeck, options.wordId);
}

function refreshDataViews() {
  if (currentRoute === 'study') {
    route('home');
    return;
  }
  renderHome();
  if (currentRoute === 'library') renderLibrary();
  else if (currentRoute === 'stats') renderStats();
  else if (currentRoute === 'memory') renderMemory(memoryGraph.focusWord?.id || '');
}

function renderHome() {
  const homeDeckId = resolvedSelectedDeckId();
  const plan = planFor(homeDeckId);
  const logs = todayLogs();
  const deckWordIds = new Set(wordsForDeck(homeDeckId).map(word => word.id));
  const uniqueDone = new Set(logs.filter(log => deckWordIds.has(log.wordId)).map(log => log.wordId)).size;
  const total = uniqueDone + plan.queue.length;
  const progress = total ? Math.round(uniqueDone / total * 100) : 100;
  const due = plan.queue.length;
  const hour = new Date().getHours();
  const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
  $('#dateLabel').textContent = date.toUpperCase();
  $('#greeting').textContent = `${greeting}，今天也要让单词留下来。`;
  $('#heroDue').textContent = due;
  $('#dueBadge').textContent = due > 99 ? '99+' : due;
  $('#planNew').textContent = plan.fresh.length;
  $('#planReview').textContent = plan.reviews.length;
  $('#planPercent').textContent = `${progress}%`;
  $('#planRing').style.setProperty('--value', `${progress * 3.6}deg`);
  $('#estimatedMinutes').textContent = plan.meta.estimateMinutes;
  $('#estimateBreakdown').textContent = plan.meta.pace.sampleSize
    ? `按你的速度：新词约 ${Math.round(plan.meta.pace.newSeconds)} 秒，复习约 ${Math.round(plan.meta.pace.reviewSeconds)} 秒/张。`
    : '先按新词 28 秒、复习 10 秒估算，使用后会自动校准。';
  $('#workloadHint').textContent = plan.meta.protectionActive
    ? `检测到 ${plan.meta.dueTotal} 张到期卡，已把今天的新词从 ${plan.meta.targetNew} 个调为 ${plan.meta.effectiveNew} 个。`
    : plan.meta.overdue
      ? `有 ${plan.meta.overdue} 张逾期卡，今天先复习，再完成 ${plan.meta.effectiveNew} 个新词。`
      : `复习优先，今天计划 ${plan.meta.effectiveNew} 个新词，预计 ${plan.meta.estimateMinutes} 分钟完成。`;
  const streak = getStreak();
  $('#sideStreak').textContent = `${streak} 天`;
  $('#homeStreak').textContent = streak;
  $('#profileLevel').textContent = levelName();
  $('#startStudyBtn').innerHTML = due ? '开始学习 <span>→</span>' : '再学一组 <span>→</span>';
  const examPlan = examStudyPlan();
  const examHome = $('#examPlanHome');
  if (examHome) {
    const showExamPlan = examPlan && !examPlan.expired;
    examHome.hidden = !showExamPlan;
    if (showExamPlan) examHome.textContent = examPlan.remaining ? `考试倒计时 ${examPlan.days} 天 · 内置 3000 词建议每日新学 ${examPlan.recommended} 个` : `考试倒计时 ${examPlan.days} 天 · 内置 3000 词已完成`;
  }
  renderWeek();
  renderDeckCards();
}

function renderWeek() {
  const active = new Set(state.logs.map(log => log.date));
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  $('#weekDots').innerHTML = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const done = active.has(todayKey(date));
    return `<span class="week-day ${done ? 'done' : ''}"><i>${done ? '✓' : ''}</i>${labels[date.getDay()]}</span>`;
  }).join('');
}

function homeDeckList() {
  const activeId = resolvedSelectedDeckId();
  const selected = deckFor(activeId);
  const rest = [...deckDefinitions, ...state.customDecks].filter(deck => deck.id !== activeId);
  return [selected, ...rest].slice(0, 6);
}

function renderDeckCards() {
  const activeId = resolvedSelectedDeckId();
  $('#homeDecks').innerHTML = homeDeckList().map(deck => {
    const deckWords = wordsForDeck(deck.id);
    const learned = deckWords.filter(word => state.cards[word.id]?.reps).length;
    const pct = deckWords.length ? Math.round(learned / deckWords.length * 100) : 0;
    const active = deck.id === activeId;
    return `<button class="deck-card ${active ? 'is-selected' : ''}" style="--deck:${escapeHtml(deck.color)}" data-deck="${escapeHtml(deck.id)}" aria-pressed="${active}"><div class="deck-top"><span class="deck-icon">${escapeHtml(deck.icon)}</span><span>${pct}% 已学习${active ? ' · 当前' : ''}</span></div><h3>${escapeHtml(deck.name)}</h3><p>${learned.toLocaleString()} / ${deckWords.length.toLocaleString()} 个词条</p><div class="deck-progress"><i style="width:${pct}%"></i></div></button>`;
  }).join('');
  $$('.deck-card').forEach(card => card.addEventListener('click', () => route('study', { deckId: card.dataset.deck })));
}

function startStudy(deckId = 'hebei-3000', preferredWordId = '') {
  clearTimeout(studyAdvanceTimer);
  currentStudyMode = 'normal';
  currentStudyLabel = '';
  studySessionStartedAt = Date.now();
  lastRestPromptAt = studySessionStartedAt;
  lastRatingUndo = null;
  selectedDeck = deckId;
  state.selectedDeck = deckId;
  const plan = planFor(deckId);
  studyQueue = [...plan.queue];
  if (preferredWordId) {
    const preferred = wordsForDeck(deckId).find(word => word.id === preferredWordId && wordIsAvailable(word));
    if (preferred) studyQueue = [preferred, ...studyQueue.filter(word => word.id !== preferred.id)];
  }
  const reviewIds = new Set(plan.reviews.map(word => word.id));
  studyQueueKinds = new Map(studyQueue.map(word => [word.id, reviewIds.has(word.id) ? 'review' : 'new']));
  initialQueueSize = studyQueue.length;
  currentStudyIndex = 0;
  $('#studyDeckLabel').textContent = deckFor(deckId).name;
  saveCurrentStudySession();
  showCurrentCard();
  persist();
}

function saveCurrentStudySession() {
  return window.englishAnki.saveStudySession({
    deckId: selectedDeck,
    mode: currentStudyMode,
    label: currentStudyLabel,
    queue: studyQueue.map(word => word.id),
    index: currentStudyIndex,
    sessionStartedAt: studySessionStartedAt,
    lastRestPromptAt,
    savedAt: new Date().toISOString()
  });
}

function resetStudySessionState() {
  clearTimeout(studyAdvanceTimer);
  studyQueue = [];
  studyQueueKinds = new Map();
  currentStudyIndex = 0;
  initialQueueSize = 0;
  currentStudyMode = 'normal';
  currentStudyLabel = '';
  lastRatingUndo = null;
  window.englishAnki.clearStudySession?.();
}

function studyRemainingEstimate() {
  const pace = personalStudyPace();
  const repeatFactor = 1 + pace.againRate * .45;
  const remaining = studyQueue.slice(currentStudyIndex);
  const seconds = remaining.reduce((sum, word) => {
    const kind = studyQueueKinds.get(word.id) || (state.cards[word.id]?.reps ? 'review' : 'new');
    return sum + (kind === 'new' ? pace.newSeconds : pace.reviewSeconds) * repeatFactor;
  }, 0);
  return { remaining: remaining.length, seconds: Math.max(0, seconds) };
}

function updateStudyRhythm() {
  const status = $('#studyRhythmStatus');
  if (!status || currentRoute !== 'study') return;
  const estimate = studyRemainingEstimate();
  const minutes = Math.max(0, Math.ceil(estimate.seconds / 60));
  const end = new Date(Date.now() + estimate.seconds * 1000);
  const endLabel = end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  status.innerHTML = `<strong>${estimate.remaining}</strong><span>张剩余</span><i></i><strong>${minutes}</strong><span>分钟</span><small>约 ${endLabel} 完成</small>`;
  const enabled = state.settings.restReminderEnabled !== false;
  const interval = Math.max(10, Math.min(90, Number(state.settings.restReminderMinutes) || 25)) * 60 * 1000;
  if (enabled && studySessionStartedAt > 0 && lastRestPromptAt > 0 && !document.hidden && !$('.modal-backdrop.open') && Date.now() - lastRestPromptAt >= interval) openRestReminder();
}

function startRhythmTimer() {
  clearInterval(rhythmTimer);
  rhythmTimer = setInterval(updateStudyRhythm, 15000);
  updateStudyRhythm();
}

function openRestReminder() {
  lastRestPromptAt = Date.now();
  saveCurrentStudySession();
  const elapsed = Math.max(1, Math.round((Date.now() - studySessionStartedAt) / 60000));
  const estimate = studyRemainingEstimate();
  $('#restReminderCopy').textContent = `你已经连续学习约 ${elapsed} 分钟，本轮还剩 ${estimate.remaining} 张。短暂离开屏幕能帮助刚才的内容完成巩固。`;
  $('#breakCountdown').hidden = true;
  $('#restPromptActions').hidden = false;
  openModal('#restReminderModal');
}

function startBreak(minutes) {
  breakEndsAt = Date.now() + minutes * 60000;
  $('#restPromptActions').hidden = true;
  $('#breakCountdown').hidden = false;
  const tick = () => {
    const remaining = Math.max(0, breakEndsAt - Date.now());
    const mm = Math.floor(remaining / 60000);
    const ss = Math.ceil((remaining % 60000) / 1000);
    $('#breakCountdownValue').textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    if (!remaining) endBreak();
  };
  clearInterval(breakTimer);
  breakTimer = setInterval(tick, 1000);
  tick();
}

function endBreak() {
  clearInterval(breakTimer);
  breakTimer = 0;
  breakEndsAt = 0;
  lastRestPromptAt = Date.now();
  closeModals();
  updateStudyRhythm();
}

function updateUndoControl() {
  const button = $('#undoRatingBtn');
  if (!button) return;
  button.disabled = !lastRatingUndo;
  button.classList.toggle('available', !!lastRatingUndo);
  button.setAttribute('aria-disabled', String(!lastRatingUndo));
  button.title = lastRatingUndo ? `撤销对 ${lastRatingUndo.wordLabel || '上一张卡'} 的评分` : '完成一次评分后可撤销';
}

let resumePending = null;

function formatSessionTime(iso) {
  if (!iso) return '';
  try {
    const time = new Date(iso);
    const now = new Date();
    const sameDay = time.toDateString() === now.toDateString();
    const hh = String(time.getHours()).padStart(2, '0');
    const mm = String(time.getMinutes()).padStart(2, '0');
    return sameDay ? `今天 ${hh}:${mm}` : `${time.getMonth() + 1}月${time.getDate()}日 ${hh}:${mm}`;
  } catch {
    return '';
  }
}

async function maybeStartStudy(deckId, wordId) {
  const deck = deckId || selectedDeck;
  try {
    const session = await window.englishAnki.loadStudySession();
    if (session && session.deckId === deck && Array.isArray(session.queue) && session.queue.length
        && Number.isInteger(session.index) && session.index > 0 && session.index < session.queue.length) {
      const sourceWords = session.mode === 'weak' ? allWords() : wordsForDeck(deck);
      const wordsById = new Map(sourceWords.map(word => [word.id, word]));
      const queue = session.queue.map(id => wordsById.get(id)).filter(Boolean);
      if (queue.length === session.queue.length) {
        resumePending = { session, deck, wordId, queue };
        const remain = session.queue.length - session.index;
        const when = formatSessionTime(session.savedAt);
        const sessionLabel = session.label || deckFor(deck).name;
        $('#resumeInfo').textContent = `上次学习「${sessionLabel}」还剩 ${remain} 张卡片${when ? `，保存于 ${when}` : ''}。`;
        openModal('#resumeModal');
        return;
      }
    }
  } catch {
    // 会话读取失败时直接开始新的学习
  }
  startStudy(deck, wordId);
}

function showCurrentCard() {
  updateUndoControl();
  updateStudyRhythm();
  if (!studyQueue.length || currentStudyIndex >= studyQueue.length) {
    $('#wordCard').style.display = 'none';
    $('#reviewActions').style.display = 'none';
    $('#studyEmpty').classList.add('show');
    $('#studyProgressText').textContent = `${initialQueueSize} / ${initialQueueSize}`;
    $('#studyProgressBar').style.width = '100%';
    renderHome();
    return;
  }
  $('#wordCard').style.display = '';
  $('#reviewActions').style.display = '';
  $('#studyEmpty').classList.remove('show');
  const word = studyQueue[currentStudyIndex];
  const card = state.cards[word.id];
  schedules = window.englishAnki.schedule(card || null, {
    requestRetention: state.settings.desiredRetention,
    maximumInterval: state.settings.maximumInterval,
    weights: state.fsrsProfile?.weights
  });
  ratingLocked = false;
  revealedAnswerPanels = new Set();
  $('#wordCard').className = 'word-card revealed';
  $('#scenePanel').classList.remove('visual-revealed');
  ['keywordLinkPanel', 'scenePanel', 'keywordScenePanel'].forEach(id => {
    const panel = $('#' + id);
    if (!panel) return;
    panel.classList.remove('panel-revealed');
    panel.setAttribute('aria-expanded', 'false');
    const labels = {
      keywordLinkPanel: '查看释义与熟词记忆链',
      scenePanel: '查看单词场景插画',
      keywordScenePanel: '查看熟词联想句'
    };
    panel.setAttribute('aria-label', labels[id]);
    panel.querySelectorAll('.panel-body, .memory-scene').forEach(body => body.setAttribute('aria-hidden', 'true'));
  });
  const detail = wordDetail(word);
  renderKeywordLink(word, detail);
  const anchorWord = String(currentKeywordLink?.word || '').trim();
  renderTargetWord(word.word, anchorWord);
  fitWordWidth();
  $('#wordDepthBack').textContent = word.word;
  $('#wordDepthMid').textContent = word.word;
  const related = anchorWord && anchorWord.toLowerCase() !== String(word.word).toLowerCase()
    ? [anchorWord]
    : relatedWordsFor(word).slice(0, 1);
  $('#relatedCloud').innerHTML = related.map((item, index) => renderRelatedWord(item, word, index, { alternateValue: word.word })).join('');
  $('#word3dStage').classList.toggle('has-related', related.length > 0);
  centerRelatedPill();
  $('#phonetic').textContent = word.phonetic || '/ — /';
  $('#levelTag').textContent = word.tierName || deckFor(word.deckId).short;
  $('#meaning').textContent = [word.pos, word.meaning].filter(Boolean).join(' ');
  $('#morphStrip').innerHTML = visualChunks(word.word).map((chunk, index) => `<span class="morph-letter" style="--delay:${index * .22}s">${escapeHtml(chunk)}</span>${index < visualChunks(word.word).length - 1 ? '<b>·</b>' : ''}`).join('') + '<i>∞</i>';
  $('#exampleSentence').innerHTML = detail.mnemonic?.html || detail.example;
  $('#cardStatus').textContent = detail.story ? 'STORY · 已审核' : (card?.reps ? `FSRS · 第 ${card.reps + 1} 次` : 'NEW · 新学');
  const completed = Math.min(currentStudyIndex, initialQueueSize);
  $('#wordIndex').textContent = `${String(completed + 1).padStart(2, '0')} / ${String(initialQueueSize).padStart(2, '0')}`;
  const kind = studyQueueKinds.get(word.id) || (card?.reps ? 'review' : 'new');
  const kindTotal = [...studyQueueKinds.values()].filter(value => value === kind).length;
  const kindSeen = new Set(studyQueue
    .slice(0, currentStudyIndex + 1)
    .filter(item => (studyQueueKinds.get(item.id) || kind) === kind)
    .map(item => item.id)).size;
  $('#cardKindLabel').textContent = `${kind === 'review' ? '复习' : '新词'} ${kindSeen}/${kindTotal}`;
  $('#studyProgressText').textContent = `${completed} / ${initialQueueSize}`;
  $('#studyProgressBar').style.width = `${initialQueueSize ? completed / initialQueueSize * 100 : 0}%`;
  $('#cardSerial').textContent = `NO. ${String(word.number || completed + 1).padStart(4, '0')}`;
  updateIntervals();
  syncReviewGate();
  cardShownAt = Date.now();
  if (state.settings.autoSpeak) setTimeout(() => speak(word.word), 250);
}

function renderKeywordLink(word, detail) {
  currentKeywordLink = detail.keyword || keywordLinkFor(word);
  $('#memory').textContent = detail.memory;
  $('#memoryScene').innerHTML = detail.story
    ? storySceneSvg(word, detail.story)
    : sceneSvg(word, detail.icon, currentKeywordLink, detail.scene, detail.mnemonic);
  if (detail.scene) {
    const script = [detail.scene.subject, detail.scene.action, detail.scene.result].filter(Boolean).join('；');
    $('#memoryScene').insertAdjacentHTML('beforeend', `<p class="scene-script">${escapeHtml(script)}</p>`);
  }
  $('#memoryScene').insertAdjacentHTML('beforeend', '<div class="scene-lock" id="sceneLock" aria-hidden="true"><span>IMAGE HINT · 点击查看 …</span></div>');
  if (detail.story) {
    bindStoryImageFallback();
    preloadUpcomingStoryImages();
  }
}

function revealStudyPanel(panel) {
  if (panel.classList.contains('panel-revealed')) return;
  const wasComplete = allAnswersRevealed();
  panel.classList.add('panel-revealed');
  panel.setAttribute('aria-expanded', 'true');
  panel.setAttribute('aria-label', `${panel.getAttribute('aria-label').replace(/^查看/, '')}，已展开`);
  panel.querySelectorAll('.panel-body, .memory-scene').forEach(body => body.setAttribute('aria-hidden', 'false'));
  if (panel.classList.contains('scene-panel')) panel.classList.add('visual-revealed');
  if (panel.id) revealedAnswerPanels.add(panel.id);
  if (!wasComplete && allAnswersRevealed()) {
    $('#wordCard').classList.add('reveal-burst');
    setTimeout(() => $('#wordCard').classList.remove('reveal-burst'), 500);
    emitSparks();
    centerRelatedPill();
  }
  syncReviewGate();
}

function allAnswersRevealed() {
  return revealOrder.every(id => revealedAnswerPanels.has(id));
}

function updateRevealHint() {
  const hint = $('#revealHint');
  if (!hint) return;
  const names = { scenePanel: '图像', keywordLinkPanel: '释义', keywordScenePanel: '联想句' };
  if (allAnswersRevealed()) {
    hint.textContent = '答案已揭晓，可以评分了';
    return;
  }
  const next = revealOrder.find(id => !revealedAnswerPanels.has(id));
  hint.textContent = `按空格查看${names[next] || '答案'}`;
}

function syncReviewGate() {
  const enabled = allAnswersRevealed();
  $('#reviewActions').classList.toggle('enabled', enabled);
  $$('.rating-button').forEach(button => {
    button.disabled = !enabled;
    button.setAttribute('aria-disabled', String(!enabled));
  });
  updateRevealHint();
}

function advanceReveal() {
  if (allAnswersRevealed()) return;
  const next = revealOrder.find(id => !revealedAnswerPanels.has(id));
  const panel = $('#' + next);
  if (panel) revealStudyPanel(panel);
}

function rateCard(rating) {
  if (ratingLocked || !studyQueue.length || !schedules?.[rating] || !allAnswersRevealed()) return;
  ratingLocked = true;
  $('#reviewActions').classList.remove('enabled');
  $$('.rating-button').forEach(button => {
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
  });
  $('#wordCard').classList.add(`card-leave-${rating}`);
  const word = studyQueue[currentStudyIndex];
  const beforeCard = serializableSnapshot(state.cards[word.id]);
  lastRatingUndo = {
    wordId: word.id,
    wordLabel: word.word,
    cardBefore: beforeCard,
    logLengthBefore: state.logs.length,
    queueBefore: studyQueue.map(item => item.id),
    queueKindsBefore: [...studyQueueKinds.entries()],
    indexBefore: currentStudyIndex,
    initialQueueSizeBefore: initialQueueSize,
    modeBefore: currentStudyMode,
    labelBefore: currentStudyLabel,
    keywordKey: null,
    keywordStatsBefore: null
  };
  const wasNew = !beforeCard?.reps;
  const elapsedMs = Math.max(500, Date.now() - cardShownAt);
  const reviewedAt = new Date().toISOString();
  const afterCard = serializableSnapshot(schedules[rating].card);
  state.cards[word.id] = afterCard;
  state.logs.push({
    schemaVersion: 2,
    date: todayKey(),
    timestamp: reviewedAt,
    reviewedAt,
    wordId: word.id,
    deckId: word.deckId,
    rating,
    ratingValue: { again: 1, hard: 2, good: 3, easy: 4 }[rating],
    isNew: wasNew,
    elapsedMs,
    responseTimeMs: elapsedMs,
    beforeCard,
    afterCard,
    fsrsLog: serializableSnapshot(schedules[rating].log),
    scheduledDays: afterCard?.scheduled_days ?? null,
    nextDue: afterCard?.due || null,
    anchorWord: currentKeywordLink?.word || null
  });
  if (currentKeywordLink?.word) {
    const keywordKey = `${word.id}:${String(currentKeywordLink.word).toLowerCase()}`;
    lastRatingUndo.keywordKey = keywordKey;
    lastRatingUndo.keywordStatsBefore = serializableSnapshot(state.keywordStats[keywordKey]);
    const previous = state.keywordStats[keywordKey] || { attempts: 0, success: 0, avgElapsedMs: 0 };
    const result = { again: 0, hard: .35, good: .82, easy: 1 }[rating] ?? 0;
    state.keywordStats[keywordKey] = {
      attempts: previous.attempts + 1,
      success: previous.success + result,
      avgElapsedMs: previous.attempts ? Math.round((previous.avgElapsedMs * previous.attempts + elapsedMs) / (previous.attempts + 1)) : elapsedMs,
      lastRating: rating,
      updatedAt: new Date().toISOString()
    };
  }
  keywordFamiliarityCache.clear();
  if (rating === 'again') {
    const insertAt = Math.min(studyQueue.length, currentStudyIndex + 4);
    studyQueue.splice(insertAt, 0, word);
  } else if (rating === 'hard' && wasNew) {
    const insertAt = Math.min(studyQueue.length, currentStudyIndex + 7);
    studyQueue.splice(insertAt, 0, word);
  } else if (rating === 'good' && afterCard.state === 1 && afterCard.scheduled_days === 0) {
    const insertAt = Math.min(studyQueue.length, currentStudyIndex + 10);
    studyQueue.splice(insertAt, 0, word);
  }
  initialQueueSize = Math.max(initialQueueSize, studyQueue.length);
  currentStudyIndex += 1;
  persist();
  saveCurrentStudySession();
  updateUndoControl();
  clearTimeout(studyAdvanceTimer);
  studyAdvanceTimer = setTimeout(showCurrentCard, 330);
}

function undoLastRating() {
  if (!lastRatingUndo) return;
  clearTimeout(studyAdvanceTimer);
  const snapshot = lastRatingUndo;
  const wordsById = new Map(allWords().map(word => [word.id, word]));
  const restoredQueue = snapshot.queueBefore.map(id => wordsById.get(id)).filter(Boolean);
  if (restoredQueue.length !== snapshot.queueBefore.length) {
    toast('无法撤销：原词库内容已经发生变化');
    return;
  }
  if (snapshot.cardBefore) state.cards[snapshot.wordId] = snapshot.cardBefore;
  else delete state.cards[snapshot.wordId];
  state.logs = state.logs.slice(0, snapshot.logLengthBefore);
  if (snapshot.keywordKey) {
    if (snapshot.keywordStatsBefore) state.keywordStats[snapshot.keywordKey] = snapshot.keywordStatsBefore;
    else delete state.keywordStats[snapshot.keywordKey];
  }
  studyQueue = restoredQueue;
  studyQueueKinds = new Map(snapshot.queueKindsBefore || []);
  currentStudyIndex = snapshot.indexBefore;
  initialQueueSize = snapshot.initialQueueSizeBefore ?? initialQueueSize;
  currentStudyMode = snapshot.modeBefore || 'normal';
  currentStudyLabel = snapshot.labelBefore || '';
  lastRatingUndo = null;
  keywordFamiliarityCache.clear();
  persist();
  saveCurrentStudySession();
  showCurrentCard();
  toast(`已撤销「${snapshot.wordLabel}」的上一次评分`);
}

function emitSparks() {
  const rect = $('#wordCard').getBoundingClientRect();
  const centerX = rect.left + rect.width * .55;
  const centerY = rect.top + rect.height * .48;
  Array.from({ length: 10 }, (_, index) => {
    const spark = document.createElement('i');
    spark.className = 'spark';
    const angle = Math.PI * 2 * index / 10;
    const distance = 35 + (index % 3) * 18;
    spark.style.left = `${centerX}px`; spark.style.top = `${centerY}px`;
    spark.style.setProperty('--sx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--sy', `${Math.sin(angle) * distance}px`);
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 700);
  });
}

function updateIntervals() {
  const ids = { again: 'againInterval', hard: 'hardInterval', good: 'goodInterval', easy: 'easyInterval' };
  Object.entries(ids).forEach(([rating, id]) => {
    const due = schedules?.[rating]?.card?.due;
    $("#" + id).textContent = due ? formatInterval(new Date(due).getTime() - Date.now()) : '—';
  });
}

function formatInterval(ms) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} 分钟后`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时后`;
  const days = Math.round(hours / 24);
  if (days < 31) return days === 1 ? '明天' : `${days} 天后`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} 个月后`;
  return `${(days / 365).toFixed(1)} 年后`;
}

function wordDetail(word) {
  const story = memoryStories.get(word.id);
  if (story) {
    const effectiveStory = word.example ? { ...story, sentence: word.example } : story;
    const detail = formalStoryDetail(word, effectiveStory);
    if (word.memory) detail.memory = word.memory;
    return detail;
  }
  const key = word.word.toLowerCase().split(/[\/\s]/)[0].replace(/[^a-z-]/g, '');
  const keyword = keywordLinkFor(word);
  const mnemonic = keywordMnemonicFor(word, keyword);
  if (curated[key]) return { ...curated[key], keyword, mnemonic, memory: `${keyword.bridge}｜词形补强：${curated[key].memory}` };
  const lower = key.toLowerCase();
  const prefix = affixes.find(([part]) => lower.startsWith(part) && lower.length > part.length + 2);
  const suffix = [...affixes].reverse().find(([part]) => lower.endsWith(part) && lower.length > part.length + 2);
  const parts = [];
  if (prefix) parts.push(`${prefix[0]}（${prefix[1]}）`);
  if (suffix && suffix !== prefix) parts.push(`${suffix[0]}（${suffix[1]}）`);
  const chunks = visualChunks(key);
  const memory = word.memory || (parts.length
    ? `${parts.join(' + ')}；抓住词形，再把它钩到“${shortMeaning(word.meaning)}”`
    : `把拼写切成 ${chunks.join(' · ')}，边读边在脑中看到“${shortMeaning(word.meaning)}”`);
  const icon = chooseIcon(word);
  return {
    memory: `${keyword.bridge}｜词形补强：${memory}`,
    keyword,
    mnemonic,
    icon,
    example: word.example ? escapeHtml(word.example).replace(new RegExp(`\\b${key}\\b`, 'i'), match => `<strong>${match}</strong>`) : `看到“${escapeHtml(shortMeaning(word.meaning))}”，先主动说出 <strong>${escapeHtml(word.word)}</strong>。`,
    zh: word.zh || `读音 ${word.phonetic || '—'} · 拼写节奏 ${chunks.join(' · ')}`
  };
}

function storyTokenMatch(sentence, token) {
  const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, 'i').exec(sentence);
}

function storySentenceHtml(story, targetMeaning) {
  const source = String(story.sentence || '');
  const matches = [
    ['anchor', story.anchor],
    ['target', story.word]
  ].map(([role, token]) => {
    const match = storyTokenMatch(source, token);
    return match ? { role, token: match[0], index: match.index } : null;
  }).filter(Boolean).sort((a, b) => a.index - b.index);
  let cursor = 0;
  let html = '';
  matches.forEach(match => {
    html += escapeHtml(source.slice(cursor, match.index));
    html += `<strong class="mnemonic-word mnemonic-${match.role}">${escapeHtml(match.token)}</strong>`;
    const gloss = match.role === 'anchor' ? (story.anchorMeaning || '') : (targetMeaning || '');
    if (gloss) html += `<small class="scene-inline-gloss">（${escapeHtml(gloss)}）</small>`;
    cursor = match.index + match.token.length;
  });
  return html + escapeHtml(source.slice(cursor));
}

function formalStoryDetail(word, story) {
  const anchorMeaning = story.anchorMeaning || '熟词';
  const targetMeaning = shortMeaning(word.meaning);
  return {
    story,
    icon: story.scene?.props?.[0]?.[1] || '◆',
    keyword: {
      word: story.anchor,
      meaning: anchorMeaning,
      icon: story.scene?.props?.[0]?.[1] || '◆',
      bridge: story.review?.reason || ''
    },
    memory: story.review?.reason || '已通过人工语义复核',
    mnemonic: {
      plain: story.sentence,
      html: storySentenceHtml(story, shortMeaning(word.meaning)),
      linkHtml: `<span class="mnemonic-link-label">熟词</span><strong class="mnemonic-word mnemonic-anchor">${escapeHtml(story.anchor)}</strong><small>（${escapeHtml(anchorMeaning)}）</small><i>→</i><span class="mnemonic-link-label">生词</span><strong class="mnemonic-word mnemonic-target">${escapeHtml(story.word)}</strong><small>（${escapeHtml(targetMeaning)}）</small>`
    }
  };
}

// 3.0 only loads approved WebP scenes by card ID; legacy handwritten SVG scenes were removed.

function storySceneSvg(word, story) {
  const props = Array.isArray(story.scene?.props) ? story.scene.props : [];
  const start = props[0] || ['', '', 36, 50];
  const end = props[2] || props[1] || ['', '', 64, 50];
  const hash = stableHash(`${word.id}:${story.storyKey || word.word}`);
  const fromX = Math.round((50 - Number(start[2] || 50)) * .13);
  const fromY = Math.round((50 - Number(start[3] || 50)) * .08);
  const toX = Math.round((50 - Number(end[2] || 50)) * .13);
  const toY = Math.round((50 - Number(end[3] || 50)) * .08);
  const fromScale = (1.025 + (hash % 5) * .004).toFixed(3);
  const toScale = (1.065 + (hash % 7) * .004).toFixed(3);
  const duration = (6 + (hash % 9) * .08).toFixed(2);
  const file = story.illustration?.file || `./assets/memory-scenes/${word.id}.webp`;
  const style = `--art-from-x:${fromX}px;--art-from-y:${fromY}px;--art-to-x:${toX}px;--art-to-y:${toY}px;--art-from-scale:${fromScale};--art-to-scale:${toScale};--art-duration:${duration}s`;
  return `<img class="story-illustration" src="${escapeHtml(file)}" alt="${escapeHtml(story.sentence)}" decoding="async" fetchpriority="high" style="${style}"><div class="story-image-error" hidden><span>插画资源待补齐</span><small>${escapeHtml(word.word)}</small></div>`;
}

function bindStoryImageFallback() {
  const image = $('#memoryScene .story-illustration');
  const fallback = $('#memoryScene .story-image-error');
  if (!image || !fallback) return;
  image.addEventListener('error', () => {
    image.hidden = true;
    fallback.hidden = false;
  }, { once: true });
}

function preloadUpcomingStoryImages() {
  const preloadCount = performanceProfile.lite ? 1 : 2;
  for (let offset = 1; offset <= preloadCount; offset += 1) {
    const nextWord = studyQueue[currentStudyIndex + offset];
    const nextStory = nextWord ? memoryStories.get(nextWord.id) : null;
    if (!nextWord || !nextStory) continue;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.decoding = 'async';
    image.src = nextStory.illustration?.file || `./assets/memory-scenes/${nextWord.id}.webp`;
  }
}

function visualChunks(word) {
  if (!word) return ['word'];
  const clean = word.replace(/[^a-zA-Z-]/g, '');
  const pieces = clean.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?=[^aeiouy]|$))?/gi) || [clean];
  return pieces.map(piece => piece.toLowerCase()).filter(Boolean).slice(0, 5);
}

const curatedRelatedWords = {
  a: ['an'], an: ['a'], am: ['p.m.'], pm: ['a.m.'], abandon: ['abandoned'], ability: ['able'], able: ['ability'],
  discrete: ['discreet'], accept: ['except'], affect: ['effect'], adapt: ['adopt'], advice: ['advise'],
  aloud: ['allowed'], access: ['assess'], breath: ['breathe'], complement: ['compliment'], desert: ['dessert'],
  economic: ['economical'], loose: ['lose'], principal: ['principle'], quiet: ['quite'], rise: ['raise'], sensible: ['sensitive']
};

const relatedWordGlosses = {
  abandoned: { phonetic: '/əˈbændənd/', pos: 'adj.', meaning: '被遗弃的，废弃的', tierName: '词族关联' },
  ability: { phonetic: '/əˈbɪləti/', pos: 'n.', meaning: '能力，才能', tierName: '词族关联' },
  allowed: { phonetic: '/əˈlaʊd/', pos: 'adj.', meaning: '被允许的，准许的', tierName: '近音词' },
  compliment: { phonetic: '/ˈkɒmplɪmənt/', pos: 'n./v.', meaning: '赞美，称赞', tierName: '近形词' },
  discreet: { phonetic: '/dɪˈskriːt/', pos: 'adj.', meaning: '谨慎的，审慎的', tierName: '近形词' },
  economical: { phonetic: '/ˌiːkəˈnɒmɪk(ə)l/', pos: 'adj.', meaning: '经济的，节俭的', tierName: '词族关联' }
};

function wordDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[right.length];
}

const keywordOverrides = {
  a: { word: 'one', phonetic: '/wʌn/', pos: 'num.', meaning: '一个', icon: '①', level: '直接概念', scene: '把字母 a 看成物品前的一枚“1”号标签：a 表示一个，放在辅音音素前。' },
  an: { word: 'one', phonetic: '/wʌn/', pos: 'num.', meaning: '一个', icon: '①', level: '直接概念', scene: '把 an 看成物品前的一枚“1”号标签：an 表示一个，放在元音音素前，n 像连接下一词的小钩子。' },
  abandon: { word: 'band', phonetic: '/bænd/', pos: 'n.', meaning: '乐队', icon: '🎸', level: '小学', scene: '一支 band 乐队被赶出舞台，所有人转身离开；把“离开舞台”锁定为 abandon＝抛弃、遗弃。' },
  abstract: { word: 'tract', phonetic: '/trækt/', pos: 'n.', meaning: '一片土地', icon: '🧩', level: '基础熟词', scene: '从一片 tract 土地上把具体物体全部抽走，只剩概念轮廓；abstract 就是“抽象的”。' },
  accurate: { word: 'rate', phonetic: '/reɪt/', pos: 'n.', meaning: '比率，速度', icon: '🎯', level: '基础熟词', scene: '把 rate 表盘的指针调到唯一正确的刻度，画面锁定 accurate＝准确的。' },
  acquire: { word: 'quire', phonetic: '/kwaɪə/', pos: 'n.', meaning: '一刀纸', icon: '📄', level: '高频熟词', scene: '主动寻找并拿到一刀 quire 纸，把“拿到手”锁定为 acquire＝获得。' },
  approach: { word: 'coach', phonetic: '/kəʊtʃ/', pos: 'n.', meaning: '教练', icon: '🚶', level: '小学', scene: 'coach 教练一步步走近你，距离不断缩短；approach 就是接近。' },
  available: { word: 'able', phonetic: '/ˈeɪbəl/', pos: 'adj.', meaning: '能够的', icon: '🟢', level: '小学', scene: '看到 able 就想到“能够拿来用”，把可用状态锁定为 available。' },
  benefit: { word: 'fit', phonetic: '/fɪt/', pos: 'adj.', meaning: '健康的，合适的', icon: '🌱', level: '小学', scene: '运动让身体 fit，立刻得到好处；benefit 就是益处、使受益。' },
  maintain: { word: 'main', phonetic: '/meɪn/', pos: 'adj.', meaning: '主要的', icon: '🤲', level: '小学', scene: '用双手一直托住 main 主体不让它掉下，锁定 maintain＝维持、保持。' },
  starve: { word: 'star', phonetic: '/stɑːr/', pos: 'n.', meaning: '星，恒星，明星，名角', icon: '⭐', level: '小学', scene: '一颗 star 饿得只剩最后一点光，画面锁定 starve＝挨饿。' },
  withdraw: { word: 'draw', phonetic: '/drɔː/', pos: 'v.', meaning: '拉，拖，画', icon: '↩', level: '小学', scene: '把 draw 出去的东西向后拉回来，锁定 withdraw＝撤回、取出。' }
};

const basicKeywordBank = [
  ['air', '/eə/', 'n.', '空气', '💨'], ['arm', '/ɑːm/', 'n.', '手臂', '💪'], ['band', '/bænd/', 'n.', '乐队', '🎸'],
  ['book', '/bʊk/', 'n.', '书', '📘'], ['car', '/kɑː/', 'n.', '汽车', '🚗'], ['cat', '/kæt/', 'n.', '猫', '🐈'],
  ['day', '/deɪ/', 'n.', '一天', '☀️'], ['dog', '/dɒɡ/', 'n.', '狗', '🐕'], ['door', '/dɔː/', 'n.', '门', '🚪'],
  ['face', '/feɪs/', 'n.', '脸', '🙂'], ['fire', '/faɪə/', 'n.', '火', '🔥'], ['fit', '/fɪt/', 'adj.', '健康的，合适的', '🏃'],
  ['food', '/fuːd/', 'n.', '食物', '🍎'], ['hand', '/hænd/', 'n.', '手', '✋'], ['head', '/hed/', 'n.', '头', '🧠'],
  ['home', '/həʊm/', 'n.', '家', '🏠'], ['house', '/haʊs/', 'n.', '房子', '🏡'], ['light', '/laɪt/', 'n.', '光', '💡'],
  ['line', '/laɪn/', 'n.', '线', '➖'], ['man', '/mæn/', 'n.', '男人', '👤'], ['map', '/mæp/', 'n.', '地图', '🗺️'],
  ['moon', '/muːn/', 'n.', '月亮', '🌙'], ['one', '/wʌn/', 'num.', '一个', '①'], ['plan', '/plæn/', 'n.', '计划', '📋'], ['play', '/pleɪ/', 'v.', '玩，演奏', '🎮'],
  ['rain', '/reɪn/', 'n.', '雨', '🌧️'], ['run', '/rʌn/', 'v.', '跑', '🏃'], ['star', '/stɑː/', 'n.', '星，明星', '⭐'],
  ['sun', '/sʌn/', 'n.', '太阳', '☀️'], ['time', '/taɪm/', 'n.', '时间', '⏰'], ['train', '/treɪn/', 'n.', '火车', '🚆'],
  ['tree', '/triː/', 'n.', '树', '🌳'], ['water', '/ˈwɔːtə/', 'n.', '水', '💧'], ['work', '/wɜːk/', 'v.', '工作', '🛠️']
].map(([word, phonetic, pos, meaning, icon]) => ({ id: `keyword-${word}`, word, phonetic, pos, meaning, icon, tier: 0, keywordBase: true }));

function soundSkeleton(value) {
  return String(value || '').toLowerCase().replace(/ph/g, 'f').replace(/gh/g, 'g').replace(/qu/g, 'kw').replace(/ck/g, 'k').replace(/c(?=[aou])/g, 'k').replace(/c/g, 's').replace(/x/g, 'ks').replace(/e$/, '').replace(/[aeiouy]+/g, 'a').replace(/(.)\1+/g, '$1').replace(/[^a-z]/g, '');
}

function commonEdgeLength(left, right, fromEnd = false) {
  const a = fromEnd ? [...left].reverse().join('') : left;
  const b = fromEnd ? [...right].reverse().join('') : right;
  let count = 0;
  while (count < Math.min(a.length, b.length) && a[count] === b[count]) count += 1;
  return count;
}

function keywordFamiliarity(candidate) {
  const key = String(candidate.word || '').toLowerCase().replace(/[^a-z]/g, '');
  const cached = keywordFamiliarityCache.get(key);
  if (cached !== undefined) return cached;
  if (state?.keywordProfile?.rejected?.[key]) return -Infinity;
  const confirmed = state?.keywordProfile?.known?.[key] ? 1.65 : 0;
  if (candidate.keywordBase) {
    const score = 1.15 + confirmed;
    keywordFamiliarityCache.set(key, score);
    return score;
  }
  const card = state?.cards?.[candidate.id];
  const recent = (state?.logs || []).filter(log => log.wordId === candidate.id).slice(-4);
  const ratingScore = recent.reduce((sum, log) => sum + ({ again: -.3, hard: .05, good: .3, easy: .45 }[log.rating] || 0), 0);
  const learned = card?.reps ? Math.min(1.35, .55 + Math.log2(card.reps + 1) * .28 + Math.min(.35, (card.stability || 0) / 30)) : 0;
  const basic = candidate.tier === 0 ? .82 : candidate.tier === 1 ? .28 : 0;
  const score = learned + basic + ratingScore + confirmed;
  keywordFamiliarityCache.set(key, score);
  return score;
}

function keywordCandidateAllowed(candidate, targetWord) {
  const key = String(candidate.word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!key || state?.keywordProfile?.rejected?.[key]) return false;
  const swapped = state?.keywordProfile?.swaps?.[targetWord.id] || [];
  if (swapped.includes(key)) return false;
  if (candidate.keywordBase || state?.keywordProfile?.known?.[key] || state?.cards?.[candidate.id]?.reps) return true;
  return candidate.tier === 0 && key.length <= 7;
}

function keywordCandidateMetrics(targetWord, candidate) {
  const target = String(targetWord?.word || targetWord || '').toLowerCase().replace(/[^a-z]/g, '');
  const anchor = String(candidate.word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!anchor || anchor === target || anchor.length < 3 || anchor.length > 10) return null;
  const familiarityRaw = keywordFamiliarity(candidate);
  if (!Number.isFinite(familiarityRaw)) return null;
  const prefix = commonEdgeLength(target, anchor);
  const suffix = commonEdgeLength(target, anchor, true);
  const targetContains = target.includes(anchor);
  const anchorContains = anchor.includes(target);
  let sliceDistance = Math.max(target.length, anchor.length);
  const width = Math.min(target.length, anchor.length);
  for (let index = 0; index <= Math.max(0, target.length - width); index += 1) {
    sliceDistance = Math.min(sliceDistance, wordDistance(target.slice(index, index + width), anchor.slice(0, width)));
  }
  const editSimilarity = Math.max(0, 1 - sliceDistance / Math.max(3, width));
  const shape = Math.min(100, Math.round(
    (targetContains ? 62 : anchorContains ? 42 : 0) +
    Math.min(18, prefix * 5) + Math.min(10, suffix * 3) + editSimilarity * 34
  ));
  const targetSound = soundSkeleton(target);
  const anchorSound = soundSkeleton(anchor);
  const soundSimilarity = Math.max(0, 1 - wordDistance(targetSound, anchorSound) / Math.max(3, targetSound.length, anchorSound.length));
  const sound = Math.min(100, Math.round(soundSimilarity * 100));
  const familiarity = Math.max(0, Math.min(100, Math.round((familiarityRaw + .2) / 3.2 * 100)));
  const statKey = `${targetWord?.id || ''}:${anchor}`;
  const stat = state?.keywordStats?.[statKey];
  const history = stat?.attempts ? Math.round(stat.success / stat.attempts * 100) : 50;
  const confusionPenalty = Math.min(35,
    (stat?.lastRating === 'again' ? 16 : stat?.lastRating === 'hard' ? 7 : 0) +
    (stat?.avgElapsedMs > 15000 ? 9 : stat?.avgElapsedMs > 9000 ? 4 : 0)
  );
  const vividness = memoryCategoryFor(candidate).id === 'abstract' ? 35 : 78;
  const curatedBonus = candidate.curatedOverride ? 9 : 0;
  const total = Math.max(0, Math.min(100, Math.round(
    shape * .35 + sound * .23 + familiarity * .26 + history * .1 + vividness * .06 + curatedBonus - confusionPenalty
  )));
  const relationHint = targetContains ? '词中藏词' : sound >= 72 ? '近音联想' : shape >= 62 ? '近形联想' : prefix >= 2 ? '共享词首' : '音形桥接';
  return { familiarity, shape, sound, history, confusionPenalty, total, relationHint };
}

function keywordSimilarity(target, candidate) {
  return keywordCandidateMetrics(target, candidate)?.total ?? -Infinity;
}

function keywordBridge(word, anchor) {
  const target = String(word.word || '').toLowerCase();
  const meaning = shortMeaning(word.meaning);
  const known = `${anchor.word}（${shortMeaning(anchor.meaning)}）`;
  const hook = target.includes(anchor.word.toLowerCase()) ? `在 ${target} 里直接看见熟词 ${known}` : `把 ${target} 的声音和字形钩到熟词 ${known}`;
  const action = {
    departure: `让${shortMeaning(anchor.meaning)}被留在门外，人物立刻转身离开`,
    classroom: `让${shortMeaning(anchor.meaning)}跳到黑板中央，所有人同时指向它`,
    motion: `让${shortMeaning(anchor.meaning)}沿着一条夸张箭头快速移动`,
    nature: `让${shortMeaning(anchor.meaning)}在巨大的太阳与树木之间发生变化`,
    work: `让人物拿着${shortMeaning(anchor.meaning)}完成一项明确任务`,
    thought: `把${shortMeaning(anchor.meaning)}放进人物头顶的巨大想法气泡`,
    contrast: `把${shortMeaning(anchor.meaning)}和“${meaning}”放在画面两侧强烈对照`
  }[sceneTypeFor(word)] || `把${shortMeaning(anchor.meaning)}和“${meaning}”放进同一幅夸张画面`;
  return `${hook}；${action}，把画面结果锁定为“${meaning}”。`;
}

function keywordCandidatesFor(word, limit = 10) {
  const target = String(word.word || '').toLowerCase().replace(/[^a-z]/g, '');
  const override = keywordOverrides[target];
  const overrideKey = String(override?.word || '').toLowerCase().replace(/[^a-z]/g, '');
  const overrideExcluded = state?.keywordProfile?.rejected?.[overrideKey] || (state?.keywordProfile?.swaps?.[word.id] || []).includes(overrideKey);
  const candidates = new Map();
  if (override && !overrideExcluded) candidates.set(overrideKey, { id: `override-${target}`, ...override, curatedOverride: true });
  basicKeywordBank.filter(item => keywordCandidateAllowed(item, word)).forEach(item => {
    if (!candidates.has(item.word)) candidates.set(item.word, item);
  });
  words.forEach(item => {
    const key = String(item.word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (key.length >= 3 && key.length <= 10 && keywordCandidateAllowed(item, word) && !candidates.has(key)) candidates.set(key, item);
  });
  return [...candidates.values()].map(candidate => {
    const metrics = keywordCandidateMetrics(word, candidate);
    return metrics ? { ...candidate, metrics, score: metrics.total, relationHint: metrics.relationHint } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || stableHash(a.word) - stableHash(b.word)).slice(0, Math.max(1, limit));
}

function keywordLinkFor(word) {
  const target = String(word.word || '').toLowerCase().replace(/[^a-z]/g, '');
  const ranked = keywordCandidatesFor(word, 1);
  const fallbackBank = basicKeywordBank.filter(item => keywordCandidateAllowed(item, word));
  const anchor = ranked[0] || fallbackBank[stableHash(target) % Math.max(1, fallbackBank.length)] || basicKeywordBank[0];
  const anchorKey = String(anchor.word || '').toLowerCase();
  const familiarity = state?.keywordProfile?.known?.[anchorKey] ? '你已确认' : state?.cards?.[anchor.id]?.reps ? '已掌握' : anchor.tier === 0 ? '小学' : '高频熟词';
  const confidence = Math.max(.55, Math.min(.98, (anchor.score || 58) / 100));
  return { ...anchor, familiarity, confidence, bridge: anchor.curatedOverride && anchor.scene ? anchor.scene : keywordBridge(word, anchor) };
}

function relatedForms(value) {
  const source = String(value || '').toLowerCase();
  const dottedAbbreviation = source.match(/(?:[a-z]\.){2,}/)?.[0];
  if (dottedAbbreviation) return [dottedAbbreviation.replace(/\./g, '')];
  const matches = source.match(/[a-z]+(?:-[a-z]+)*/g) || [];
  return [...new Set(matches.filter(form => form.length > 1 || /^[ai]$/.test(form)))];
}

function relatedStem(value) {
  let stem = String(value || '').replace(/-/g, '');
  const prefixes = ['counter', 'under', 'super', 'trans', 'inter', 'over', 'anti', 'post', 'pre', 'sub', 'dis', 'mis', 'un', 're'];
  const suffixes = ['ization', 'ational', 'fulness', 'ousness', 'iveness', 'ability', 'ibility', 'ation', 'ition', 'ment', 'ness', 'able', 'ible', 'ally', 'ically', 'ical', 'ous', 'ive', 'ful', 'less', 'ing', 'ied', 'ies', 'ed', 'er', 'est', 'ly', 's'];
  const prefix = prefixes.find(part => stem.startsWith(part) && stem.length - part.length >= 4);
  if (prefix) stem = stem.slice(prefix.length);
  const suffix = suffixes.find(part => stem.endsWith(part) && stem.length - part.length >= 3);
  if (suffix) stem = stem.slice(0, -suffix.length);
  return stem;
}

function bigramSimilarity(left, right) {
  const pairs = value => {
    const result = [];
    for (let index = 0; index < value.length - 1; index += 1) result.push(value.slice(index, index + 2));
    return result;
  };
  const a = pairs(left); const b = pairs(right);
  if (!a.length || !b.length) return left === right ? 1 : 0;
  const remaining = [...b];
  let shared = 0;
  a.forEach(pair => { const index = remaining.indexOf(pair); if (index >= 0) { shared += 1; remaining.splice(index, 1); } });
  return shared * 2 / (a.length + b.length);
}

function relatedVocabulary() {
  if (relatedVocabularyIndex) return relatedVocabularyIndex;
  const unique = new Map();
  words.forEach(item => relatedForms(item.word).forEach(form => {
    if (!unique.has(form)) unique.set(form, { form, meaning: item.meaning || '' });
  }));
  const items = [...unique.values()];
  const byPrefix = new Map(); const bySuffix = new Map(); const bySound = new Map(); const byStem = new Map(); const byFirst = new Map();
  const add = (index, key, item) => {
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(item);
  };
  items.forEach(item => {
    add(byPrefix, item.form.slice(0, 2), item);
    add(bySuffix, item.form.slice(-2), item);
    add(bySound, soundSkeleton(item.form).slice(0, 2), item);
    add(byStem, relatedStem(item.form), item);
    add(byFirst, item.form[0], item);
  });
  relatedVocabularyIndex = { items, byPrefix, bySuffix, bySound, byStem, byFirst };
  return relatedVocabularyIndex;
}

function relatedCandidates(key) {
  const vocabulary = relatedVocabulary();
  const unique = new Map();
  const include = items => (items || []).forEach(item => unique.set(item.form, item));
  include(vocabulary.byPrefix.get(key.slice(0, 2)));
  include(vocabulary.bySuffix.get(key.slice(-2)));
  include(vocabulary.bySound.get(soundSkeleton(key).slice(0, 2)));
  include(vocabulary.byStem.get(relatedStem(key)));
  if (unique.size < 20) include(vocabulary.byFirst.get(key[0]));
  if (unique.size < 2) include(vocabulary.items);
  return [...unique.values()];
}

function relatedWordsFor(word) {
  const forms = relatedForms(word.word);
  const key = forms[0];
  if (!key) return [];
  const cacheKey = String(word.word || '').toLowerCase().trim();
  if (relatedWordCache.has(cacheKey)) return relatedWordCache.get(cacheKey);

  const directPair = forms.find((form, index) => index > 0 && form !== key);
  const curated = curatedRelatedWords[key]?.[0];
  if (curated || directPair) {
    const result = [curated || directPair];
    relatedWordCache.set(cacheKey, result);
    return result;
  }

  const targetStem = relatedStem(key);
  const targetSound = soundSkeleton(key);
  const maxLengthGap = Math.max(4, Math.ceil(key.length * .55));
  const meaningChars = new Set([...String(word.meaning || '')].filter(char => /[\u4e00-\u9fff]/.test(char)));
  const ranked = relatedCandidates(key)
    .filter(item => item.form !== key && Math.abs(item.form.length - key.length) <= maxLengthGap)
    .map(item => {
      const candidate = item.form;
      const width = Math.max(key.length, candidate.length, 2);
      const edit = 1 - wordDistance(key, candidate) / width;
      const prefix = commonEdgeLength(key, candidate) / Math.min(key.length, candidate.length);
      const suffix = commonEdgeLength(key, candidate, true) / Math.min(key.length, candidate.length);
      const family = Math.min(key.length, candidate.length) >= 3 && (candidate.includes(key) || key.includes(candidate));
      const stemMatch = targetStem.length >= 3 && targetStem === relatedStem(candidate);
      const sound = Math.max(0, 1 - wordDistance(targetSound, soundSkeleton(candidate)) / Math.max(targetSound.length, soundSkeleton(candidate).length, 2));
      const semantic = [...meaningChars].filter(char => String(item.meaning).includes(char)).length;
      const score = edit * 42 + bigramSimilarity(key, candidate) * 18 + prefix * 14 + suffix * 12 + sound * 8 + Math.min(6, semantic) + (family ? 34 : 0) + (stemMatch ? 30 : 0) - Math.abs(key.length - candidate.length) * 1.4;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score || stableHash(left.candidate) - stableHash(right.candidate));
  const result = ranked[0] ? [ranked[0].candidate] : [];
  relatedWordCache.set(cacheKey, result);
  return result;
}

function anchorLetterIndexes(targetValue, anchorValue) {
  const target = String(targetValue || '');
  const anchor = String(anchorValue || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!target || anchor.length < 2) return new Set();
  const normalized = [];
  const sourceIndexes = [];
  [...target].forEach((character, index) => {
    if (!/[a-z]/i.test(character)) return;
    normalized.push(character.toLowerCase());
    sourceIndexes.push(index);
  });
  const targetLetters = normalized.join('');
  let start = targetLetters.indexOf(anchor);
  let length = anchor.length;
  if (start < 0) {
    let bestStart = -1; let bestLength = 0;
    for (let targetIndex = 0; targetIndex < targetLetters.length; targetIndex += 1) {
      for (let anchorIndex = 0; anchorIndex < anchor.length; anchorIndex += 1) {
        let matchLength = 0;
        while (targetIndex + matchLength < targetLetters.length && anchorIndex + matchLength < anchor.length
          && targetLetters[targetIndex + matchLength] === anchor[anchorIndex + matchLength]) matchLength += 1;
        if (matchLength > bestLength) { bestStart = targetIndex; bestLength = matchLength; }
      }
    }
    start = bestStart; length = bestLength;
  }
  if (start < 0 || length < 2) return new Set();
  return new Set(sourceIndexes.slice(start, start + length));
}

function renderTargetWord(targetValue, anchorValue) {
  const target = String(targetValue || '');
  const coloredIndexes = anchorLetterIndexes(target, anchorValue);
  const element = $('#wordText');
  element.setAttribute('aria-label', target);
  element.classList.toggle('has-anchor-letters', coloredIndexes.size > 0);
  element.innerHTML = [...target].map((character, index) => `<span class="word-letter ${coloredIndexes.has(index) ? 'is-anchor-letter' : 'is-static-letter'}">${escapeHtml(character)}</span>`).join('');
}

function fitWordWidth() {
  const wordEl = $('#wordText');
  if (!wordEl) return;
  const info = wordEl.closest('.word-info');
  const scene = $('#scenePanel');
  if (!info) return;
  const prevTransition = wordEl.style.transition;
  const prevMaxWidth = wordEl.style.maxWidth;
  wordEl.style.transition = 'none';
  wordEl.style.maxWidth = 'none';
  wordEl.style.fontSize = '';
  const measureRange = document.createRange();
  measureRange.selectNodeContents(wordEl);
  const natural = measureRange.getBoundingClientRect().width;
  measureRange.detach();
  const wordLeft = wordEl.getBoundingClientRect().left;
  const available = scene
    ? scene.getBoundingClientRect().left - wordLeft - 8
    : info.clientWidth;
  if (natural > available && natural > 0) {
    const ratio = available / natural;
    const current = parseFloat(getComputedStyle(wordEl).fontSize) || 56;
    wordEl.style.fontSize = `${Math.max(22, Math.round(current * ratio * 10) / 10)}px`;
  }
  wordEl.style.maxWidth = prevMaxWidth;
  wordEl.style.transition = prevTransition;
}
function centerRelatedPill() {
  const wordEl = $('#wordText');
  const cloud = $('#relatedCloud');
  if (!wordEl || !cloud || !cloud.offsetWidth) return;
  const wordWidth = wordEl.scrollWidth || wordEl.offsetWidth;
  const cloudWidth = cloud.offsetWidth;
  const offset = Math.max(0, (wordWidth - cloudWidth) / 2);
  cloud.style.marginLeft = `${offset}px`;
}
window.addEventListener('resize', () => {
  fitWordWidth();
  centerRelatedPill();
});

function renderSharedLetterWord(value, comparisonValue) {
  const word = String(value || '');
  const sharedIndexes = anchorLetterIndexes(word, comparisonValue);
  return [...word].map((character, index) => `<i class="related-cue-letter ${sharedIndexes.has(index) ? 'is-shared-letter' : 'is-static-letter'}">${escapeHtml(character)}</i>`).join('');
}

function relatedWordInfo(value) {
  const label = String(value || '').trim();
  const normalized = label.toLowerCase();
  const forms = relatedForms(label);
  const exact = words.find(item => String(item.word || '').toLowerCase().trim() === normalized);
  const matched = exact || words.find(item => {
    const itemForms = relatedForms(item.word);
    return itemForms.some(form => forms.includes(form));
  });
  const fallback = relatedWordGlosses[normalized] || relatedWordGlosses[forms[0]] || {};
  const source = matched || fallback;
  return {
    word: label,
    phonetic: source.phonetic || '/ — /',
    pos: source.pos || 'word',
    meaning: source.meaning || '与当前词的词形或读音相近',
    tierName: source.tierName || '相似词'
  };
}

function renderRelatedWord(value, currentWord, index, options = {}) {
  const info = relatedWordInfo(value);
  const tooltipId = `related-preview-${index}`;
  const alternateValue = String(options.alternateValue || '').trim();
  const shouldCycle = alternateValue && alternateValue.toLowerCase() !== info.word.toLowerCase();
  const label = shouldCycle
    ? `<span class="related-word-label related-label-cycle" style="--related-index:${index}" aria-label="原单词 ${escapeHtml(alternateValue)}，基础词 ${escapeHtml(info.word)}"><b class="related-label-original">${renderSharedLetterWord(alternateValue, info.word)}</b><b class="related-label-anchor">${renderSharedLetterWord(info.word, alternateValue)}</b></span>`
    : `<span class="related-word-label" style="--related-index:${index}">${renderSharedLetterWord(info.word, currentWord.word)}</span>`;
  return `<div class="related-word-item" tabindex="0" aria-describedby="${tooltipId}">
    ${label}
    <div class="related-preview-card" id="${tooltipId}" role="tooltip">
      <div class="related-preview-head">
        <strong>${escapeHtml(info.word)}</strong>
        <small>${escapeHtml(info.phonetic)}</small>
        <button type="button" data-related-speak="${escapeHtml(info.word)}" aria-label="朗读 ${escapeHtml(info.word)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>
        </button>
        <em>${escapeHtml(info.tierName)}</em>
      </div>
      <div class="related-preview-meaning"><i>${escapeHtml(info.pos)}</i><b>${escapeHtml(info.meaning)}</b></div>
      <small class="related-preview-link">基础词 · ${escapeHtml(info.word)} → ${escapeHtml(currentWord.word)}</small>
    </div>
  </div>`;
}

function shortMeaning(meaning) {
  const source = String(meaning || '这个含义').trim();
  const normalized = source.replace(/^（[^）]{1,24}）\s*/, '').replace(/^\([^)]{1,24}\)\s*/, '').trim();
  return (normalized || source).split(/[，；。]/)[0].trim().slice(0, 14) || '这个含义';
}

function keywordMnemonicFor(word, keyword) {
  const target = String(word?.word || 'word').trim();
  const anchor = String(keyword?.word || 'known word').trim();
  const targetMeaning = shortMeaning(word?.meaning);
  const anchorMeaning = shortMeaning(keyword?.meaning || '熟悉事物');
  const targetToken = { role: 'target', text: target };
  const anchorToken = { role: 'anchor', text: anchor };
  const key = target.toLowerCase().replace(/[^a-z-]/g, '');
  const type = sceneTypeFor(word);
  let fragments;
  if (key === 'starve' && anchor.toLowerCase() === 'star') {
    fragments = ['那个', targetMeaning, ' ', targetToken, ' 的人饿得眼冒金星 ', anchorToken, '。'];
  } else {
    const templates = {
      departure: ['抱着“', anchorMeaning, '”', anchorToken, '的人突然转身离开，画面结果锁定“', targetMeaning, '”', targetToken, '。'],
      classroom: ['老师把“', anchorMeaning, '”', anchorToken, '写在黑板上，全班一起演出“', targetMeaning, '”', targetToken, '。'],
      motion: ['“', anchorMeaning, '”', anchorToken, '沿着巨型箭头猛冲，终点爆出“', targetMeaning, '”', targetToken, '。'],
      nature: ['一颗巨大的“', anchorMeaning, '”', anchorToken, '在风雨中突然变成“', targetMeaning, '”', targetToken, '。'],
      work: ['工人举起“', anchorMeaning, '”', anchorToken, '开始夸张操作，最终完成“', targetMeaning, '”', targetToken, '。'],
      thought: ['人物看见“', anchorMeaning, '”', anchorToken, '，头顶立刻炸出“', targetMeaning, '”', targetToken, '的巨大想法。'],
      contrast: ['左边的“', anchorMeaning, '”', anchorToken, '和右边的“', targetMeaning, '”', targetToken, '猛烈碰撞成同一个画面。']
    };
    fragments = templates[type] || templates.contrast;
  }
  const plain = fragments.map(fragment => typeof fragment === 'string' ? fragment : fragment.text).join('');
  const html = fragments.map(fragment => {
    if (typeof fragment === 'string') return escapeHtml(fragment);
    return `<strong class="mnemonic-word mnemonic-${fragment.role}">${escapeHtml(fragment.text)}</strong>`;
  }).join('');
  const linkHtml = `<span class="mnemonic-link-label">熟词</span><strong class="mnemonic-word mnemonic-anchor">${escapeHtml(anchor)}</strong><small>（${escapeHtml(anchorMeaning)}）</small><i>→</i><span class="mnemonic-link-label">生词</span><strong class="mnemonic-word mnemonic-target">${escapeHtml(target)}</strong><small>（${escapeHtml(targetMeaning)}）</small>`;
  return { plain, html, linkHtml, type, anchor, target, anchorMeaning, targetMeaning };
}

function chooseIcon(word) {
  const text = `${word.meaning} ${word.pos}`;
  const groups = [
    [/人|者|朋友|家庭|老师|学生|父|母|孩子|男人|女人/, '👤'], [/动物|鸟|鱼|狗|猫|马|昆虫/, '🐾'],
    [/植物|花|树|农业|森林|自然/, '🌿'], [/水|雨|海|河|湖|天气|风|云|雪/, '🌦'], [/食|饭|饮|水果|蔬菜|肉|甜/, '🍎'],
    [/学校|学习|教育|书|文章|语言|词/, '📚'], [/工作|职业|公司|商业|钱|银行/, '💼'], [/地点|地区|城市|房|建筑|机场|站/, '📍'],
    [/时间|年|月|日|早|晚|以前|后来/, '⏱'], [/走|跑|移动|行动|做|使用|拿|放|进入|离开/, '🏃'],
    [/想|知道|认为|感到|情绪|爱|担心|希望/, '💭'], [/技术|机器|电脑|网络|科学|工具/, '⚙'], [/声音|说|听|音乐/, '🎵']
  ];
  return groups.find(([pattern]) => pattern.test(text))?.[1] || (word.pos?.startsWith('v') ? '✦' : word.pos?.startsWith('adj') ? '◈' : '●');
}

function sceneTypeFor(word) {
  const key = String(word.word || '').toLowerCase();
  const text = `${key} ${word.meaning || ''} ${word.pos || ''}`;
  if (/abandon|抛弃|遗弃|放弃|离开|退出|撤回/.test(text)) return 'departure';
  if (/学校|学习|教育|老师|学生|书|课堂|语言|演示|考试/.test(text)) return 'classroom';
  if (/走|跑|移动|到达|接近|进入|通过|运输|旅行|上船|飞机|火车/.test(text)) return 'motion';
  if (/植物|花|树|农业|森林|自然|水|雨|海|河|天气|风|云|雪/.test(text)) return 'nature';
  if (/工作|职业|公司|商业|钱|银行|计划|报告|技术|机器|电脑|网络|科学|工具/.test(text)) return 'work';
  if (/想|知道|认为|感到|情绪|爱|担心|希望|记忆|抽象|概念/.test(text)) return 'thought';
  return 'contrast';
}

function sceneArtwork(type, icon, keywordIcon) {
  const person = `<g class="scene-person"><circle cx="168" cy="126" r="20" fill="#f4bd7f"/><path d="M151 151 Q168 136 185 151 L190 209 H145Z" fill="#f0788b"/><path d="M151 162 121 190M184 163l28 21M154 208l-15 35M181 208l20 35" fill="none" stroke="#604a55" stroke-width="11" stroke-linecap="round"/></g>`;
  const scenes = {
    departure: `<path d="M34 236 Q146 203 264 230T398 219V270H34Z" fill="#7fcf9d"/><rect x="310" y="78" width="66" height="156" rx="8" fill="#f3c56b"/><rect x="322" y="92" width="43" height="132" rx="4" fill="#fff0bc"/><circle cx="355" cy="159" r="4" fill="#8d6338"/><g transform="translate(-20 0)">${person}</g><path class="scene-action" d="M205 184c32 7 61 4 92-18" fill="none" stroke="#19bfa6" stroke-width="6" stroke-linecap="round"/><path d="m290 153 19 10-18 12" fill="none" stroke="#19bfa6" stroke-width="6" stroke-linecap="round"/><g transform="rotate(-9 105 221)"><rect x="64" y="190" width="86" height="58" rx="8" fill="#fff" stroke="#dc7d7d" stroke-width="4"/><path d="M78 207h46M78 220h34M78 233h53" stroke="#d68b8b" stroke-width="4" stroke-linecap="round"/><path d="m78 202 58 40" stroke="#dc7d7d" stroke-width="4"/></g>`,
    classroom: `<rect x="45" y="70" width="236" height="128" rx="13" fill="#fffbe7" stroke="#edb84f" stroke-width="10"/><path d="M74 106h150M74 132h104M74 158h132" stroke="#91cbb8" stroke-width="8" stroke-linecap="round"/>${person}<g class="scene-students"><circle cx="286" cy="212" r="19" fill="#e98c66"/><circle cx="336" cy="216" r="19" fill="#f1bf6d"/><path d="M263 261q22-45 46 0M312 263q24-48 49 0" fill="#67a9d9"/></g>`,
    motion: `<path d="M35 244c86-65 149-65 221-22 55 33 91 28 134-5" fill="none" stroke="#fff" stroke-width="34" stroke-linecap="round"/><path class="scene-action" d="M69 236c88-50 155-45 225-4" fill="none" stroke="#39bea2" stroke-width="7" stroke-dasharray="11 11" stroke-linecap="round"/>${person}<path d="m286 217 24 17-27 11" fill="none" stroke="#39bea2" stroke-width="7" stroke-linecap="round"/><circle cx="350" cy="92" r="34" fill="#ffe078"/>`,
    nature: `<circle cx="336" cy="83" r="40" fill="#ffe178"/><path d="M30 232Q109 150 184 225Q276 129 401 232V270H30Z" fill="#8fcf91"/><rect x="89" y="131" width="18" height="105" rx="8" fill="#8c6047"/><circle cx="98" cy="119" r="53" fill="#54b982"/><circle cx="65" cy="134" r="34" fill="#75ce8d"/><path class="scene-action" d="M239 101q25 33 4 65" fill="none" stroke="#65a9e8" stroke-width="7" stroke-linecap="round"/><path d="M232 95q12-21 24 0q-12 25-24 0" fill="#65a9e8"/>${person}`,
    work: `<rect x="48" y="206" width="328" height="28" rx="12" fill="#a87a5e"/><rect x="225" y="105" width="119" height="88" rx="10" fill="#304e68"/><rect x="237" y="117" width="95" height="63" rx="5" fill="#d9fff6"/><path d="M208 205h153" stroke="#243c52" stroke-width="12" stroke-linecap="round"/>${person}<g class="scene-gear"><circle cx="305" cy="72" r="33" fill="#53c5aa"/><text x="305" y="84" text-anchor="middle" font-size="36" fill="#fff">${escapeHtml(icon)}</text></g>`,
    thought: `${person}<path d="M218 73c0-31 26-53 63-53 40 0 70 24 70 57 0 31-29 53-67 53h-13l-33 25 8-34c-18-10-28-27-28-48Z" fill="#fff" opacity=".9"/><text class="scene-thought-icon" x="285" y="91" text-anchor="middle" font-size="45">${escapeHtml(icon)}</text><circle cx="218" cy="139" r="8" fill="#fff" opacity=".85"/><circle cx="202" cy="155" r="5" fill="#fff" opacity=".72"/><path d="M31 237Q155 197 401 232V270H31Z" fill="#a7d8c3"/>`,
    contrast: `<rect x="38" y="70" width="155" height="165" rx="24" fill="#fff" opacity=".92"/><rect x="227" y="70" width="155" height="165" rx="24" fill="#263d5f" opacity=".94"/><path class="scene-action" d="M198 151h25" stroke="#36cdb0" stroke-width="7" stroke-linecap="round"/><circle cx="116" cy="135" r="37" fill="#ffd96d"/><text x="305" y="152" text-anchor="middle" font-size="54">${escapeHtml(icon)}</text><path d="M91 201h50M280 201h50" stroke="#54c8ab" stroke-width="9" stroke-linecap="round"/>`
  };
  const anchor = escapeHtml(keywordIcon || '◆');
  const result = escapeHtml(icon || '✦');
  const logicObjects = {
    departure: `<g class="scene-anchor-object"><circle cx="105" cy="220" r="24" fill="#fff" opacity=".92"/><text x="105" y="230" text-anchor="middle" font-size="28">${anchor}</text></g><g class="scene-result-object"><text x="343" y="169" text-anchor="middle" font-size="31">${result}</text></g>`,
    classroom: `<g class="scene-anchor-object"><circle cx="117" cy="132" r="31" fill="#dff8eb"/><text x="117" y="143" text-anchor="middle" font-size="32">${anchor}</text></g><g class="scene-result-object"><circle cx="247" cy="103" r="24" fill="#ffe783"/><text x="247" y="113" text-anchor="middle" font-size="27">${result}</text></g>`,
    motion: `<g class="scene-anchor-object"><circle cx="87" cy="223" r="27" fill="#fff"/><text x="87" y="233" text-anchor="middle" font-size="29">${anchor}</text></g><g class="scene-result-object"><circle cx="324" cy="218" r="27" fill="#fff"/><text x="324" y="228" text-anchor="middle" font-size="29">${result}</text></g>`,
    nature: `<g class="scene-anchor-object"><circle cx="98" cy="118" r="30" fill="#fff4b5"/><text x="98" y="129" text-anchor="middle" font-size="31">${anchor}</text></g><g class="scene-result-object"><circle cx="249" cy="157" r="26" fill="#eaf8ff"/><text x="249" y="167" text-anchor="middle" font-size="28">${result}</text></g>`,
    work: `<g class="scene-anchor-object"><circle cx="284" cy="148" r="27" fill="#d9fff6"/><text x="284" y="159" text-anchor="middle" font-size="29">${anchor}</text></g>`,
    thought: `<g class="scene-anchor-object"><circle cx="168" cy="177" r="25" fill="#fff0c7"/><text x="168" y="187" text-anchor="middle" font-size="28">${anchor}</text></g>`,
    contrast: `<g class="scene-anchor-object"><text x="116" y="151" text-anchor="middle" font-size="39">${anchor}</text></g>`
  };
  return `${scenes[type] || scenes.contrast}${logicObjects[type] || logicObjects.contrast}`;
}

function sceneWordLabel(value, limit = 11) {
  const label = String(value || 'word').trim();
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
}

function sceneMnemonicChain(word, icon, keyword) {
  const anchorLabel = escapeHtml(sceneWordLabel(keyword?.word));
  const targetLabel = escapeHtml(sceneWordLabel(word?.word));
  const anchorIcon = escapeHtml(keyword?.icon || '◆');
  const targetIcon = escapeHtml(icon || '✦');
  return `<g class="mnemonic-chain-layer" aria-hidden="true">
    <path class="mnemonic-chain-track" d="M132 34 C172 8 248 8 288 34"/>
    <circle class="mnemonic-chain-spark" cx="210" cy="18" r="6"/>
    <g class="mnemonic-scene-token mnemonic-anchor-token">
      <rect x="18" y="16" width="116" height="38" rx="19"/>
      <text class="mnemonic-token-icon" x="36" y="41">${anchorIcon}</text>
      <text x="78" y="40" text-anchor="middle">${anchorLabel}</text>
    </g>
    <g class="mnemonic-scene-token mnemonic-target-token">
      <rect x="286" y="16" width="116" height="38" rx="19"/>
      <text class="mnemonic-token-icon" x="304" y="41">${targetIcon}</text>
      <text x="346" y="40" text-anchor="middle">${targetLabel}</text>
    </g>
  </g>`;
}

function sceneSvg(word, icon, keyword, plannedScene = null, mnemonic = null) {
  const palettes = [
    ['#f8d77b', '#f29c73', '#fff3cd'], ['#8ed8b4', '#4fae8a', '#e7fff3'], ['#9bb5ed', '#607bd0', '#edf2ff'],
    ['#e7a8c5', '#b86b95', '#fff0f7'], ['#d0dc84', '#8aaa50', '#f7ffd9']
  ];
  const hash = [...word.word].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [a, b, c] = palettes[hash % palettes.length];
  const type = ['departure', 'classroom', 'motion', 'nature', 'work', 'thought', 'contrast'].includes(plannedScene?.kind) ? plannedScene.kind : sceneTypeFor(word);
  const keywordIcon = keyword?.icon || '◆';
  return `<svg class="memory-scene-svg scene-kind-${type}" viewBox="0 0 420 300" role="img" aria-label="${escapeHtml(mnemonic?.plain || `${word.word} 的关键词场景动画`)}">
    <defs><linearGradient id="sceneBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c}"/><stop offset="1" stop-color="${a}"/></linearGradient><filter id="sceneShadow"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#213f48" flood-opacity=".22"/></filter></defs>
    <rect width="420" height="300" rx="30" fill="url(#sceneBg)"/>
    <circle class="scene-float-a" cx="368" cy="28" r="82" fill="${b}" opacity=".2"/><circle class="scene-float-b" cx="27" cy="282" r="94" fill="#fff" opacity=".18"/>
    <g filter="url(#sceneShadow)">${sceneArtwork(type, icon, keywordIcon)}</g>
    ${sceneMnemonicChain(word, icon, keyword)}
  </svg>`;
}

const memoryCategories = [
  { id: 'people', label: '人物关系', pattern: /人|者|朋友|家庭|父|母|孩子|男人|女人|社会|关系/ },
  { id: 'learning', label: '学习语言', pattern: /学校|学习|教育|老师|学生|书|文章|语言|词|知识|考试/ },
  { id: 'motion', label: '动作路径', pattern: /走|跑|移动|到达|接近|进入|离开|通过|运输|旅行|上升|下降|放弃|抛弃|遗弃|撤回/ },
  { id: 'nature', label: '自然环境', pattern: /植物|花|树|农业|森林|自然|水|雨|海|河|天气|风|云|雪|动物/ },
  { id: 'work', label: '工作商业', pattern: /工作|职业|公司|商业|钱|银行|计划|报告|管理|生产|市场/ },
  { id: 'emotion', label: '情绪认知', pattern: /想|知道|认为|感到|情绪|爱|担心|希望|记忆|态度|精神|心理/ },
  { id: 'technology', label: '科学技术', pattern: /技术|机器|电脑|网络|科学|工具|数据|系统|设备|实验/ },
  { id: 'time', label: '时间变化', pattern: /时间|年|月|日|早|晚|以前|后来|期间|开始|结束|继续/ },
  { id: 'food', label: '饮食生活', pattern: /食|饭|饮|水果|蔬菜|肉|甜|衣服|健康|身体|生活/ },
  { id: 'place', label: '空间地点', pattern: /地点|地区|城市|房|建筑|机场|车站|位置|方向|上面|下面/ },
  { id: 'sound', label: '声音表达', pattern: /声音|说|听|音乐|表达|讨论|回答|叫|朗读/ },
  { id: 'abstract', label: '抽象概念', pattern: /.*/ }
];

function memoryCategoryFor(word) {
  const text = `${word.meaning || ''} ${word.pos || ''}`;
  return memoryCategories.find(category => category.pattern.test(text)) || memoryCategories.at(-1);
}

function stableHash(value, salt = 0) {
  let hash = 2166136261 ^ salt;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function hashUnit(value, salt = 0) {
  return (stableHash(value, salt) % 10000) / 10000;
}

function memoryMeaningPairs(value) {
  const pairs = new Set();
  const segments = String(value || '').match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const segment of segments) {
    for (let index = 0; index < segment.length - 1; index += 1) pairs.add(segment.slice(index, index + 2));
  }
  return pairs;
}

function strongMemoryRelations(focus) {
  const label = String(focus.word || '').toLowerCase();
  const key = label.replace(/[^a-z]/g, '');
  const focusTokens = label.split(/[^a-z]+/).filter(token => token.length >= 3);
  const focusStem = relatedStem(key);
  const category = memoryCategoryFor(focus).id;
  const curatedNames = new Set(relatedWordsFor(focus).map(item => String(item).toLowerCase()));
  const focusPairs = memoryMeaningPairs(focus.meaning);
  const focusSound = soundSkeleton(key);
  return words
    .filter(candidate => candidate.id !== focus.id && String(candidate.word || '').length >= 2)
    .map(candidate => {
      const candidateLabel = String(candidate.word || '').toLowerCase();
      const candidateKey = candidateLabel.replace(/[^a-z]/g, '');
      const candidateTokens = candidateLabel.split(/[^a-z]+/).filter(token => token.length >= 3);
      if (!candidateKey) return null;
      const candidateStem = relatedStem(candidateKey);
      const minLength = Math.min(key.length, candidateKey.length);
      const curated = curatedNames.has(candidateLabel) || curatedNames.has(candidateKey);
      const compound = minLength >= 3 && (candidateKey.length >= 4 || ['man', 'men'].includes(candidateKey)) && (
        focusTokens.some(token => token === candidateKey || token.startsWith(candidateKey) || token.endsWith(candidateKey))
        || candidateTokens.some(token => token === key || token.startsWith(key) || token.endsWith(key))
      );
      const stemMatch = focusStem.length >= 4 && focusStem === candidateStem;
      const prefix = minLength >= 4 && key.slice(0, 4) === candidateKey.slice(0, 4);
      const suffix = minLength >= 5 && key.slice(-4) === candidateKey.slice(-4);
      const distance = Math.abs(candidateKey.length - key.length) <= 3 ? wordDistance(key, candidateKey) : 9;
      const candidatePairs = memoryMeaningPairs(candidate.meaning);
      const semanticMatches = [...focusPairs].filter(pair => candidatePairs.has(pair)).length;
      const sameCategory = memoryCategoryFor(candidate).id === category;
      const candidateSound = soundSkeleton(candidateKey);
      const sound = focusSound && candidateSound
        ? 1 - wordDistance(focusSound, candidateSound) / Math.max(focusSound.length, candidateSound.length, 2)
        : 0;
      let type = '';
      let score = 0;
      if (curated) { type = '人工精选'; score = 130; }
      else if (compound) {
        const likelyAffix = Math.abs(candidateKey.length - key.length) >= 2;
        type = likelyAffix ? '构词关联' : '近形词';
        score = (likelyAffix ? 114 : 99) + Math.min(8, minLength);
      }
      else if (stemMatch) { type = '词族关联'; score = 108; }
      else if (distance === 1) { type = '近形词'; score = 103; }
      else if (prefix || suffix) { type = '词形关联'; score = 91 + (prefix && suffix ? 5 : 0); }
      else if (distance === 2 && minLength >= 5) { type = '近形词'; score = 84; }
      else if (semanticMatches >= 2 || (semanticMatches >= 1 && sameCategory)) { type = '语义关联'; score = 70 + semanticMatches * 8; }
      else if (sound >= .84 && minLength >= 4) { type = '近音词'; score = 66 + sound * 10; }
      if (!type) return null;
      score -= Math.abs(candidateKey.length - key.length) * .35;
      return { word: candidate, type, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || stableHash(left.word.word) - stableHash(right.word.word))
    .slice(0, 6);
}

function sampleMemoryWords(focus, relations) {
  const buckets = new Map(memoryCategories.map(category => [category.id, []]));
  for (const word of words) buckets.get(memoryCategoryFor(word).id).push(word);
  const sampled = [];
  const perCategory = performanceProfile.lite ? 4 : 7;
  for (const category of memoryCategories) {
    const bucket = buckets.get(category.id)
      .filter(word => word.id !== focus.id)
      .sort((left, right) => stableHash(left.word, category.id.length) - stableHash(right.word, category.id.length));
    sampled.push(...bucket.slice(0, category.id === 'abstract' ? perCategory + 2 : perCategory));
  }
  const unique = new Map([[focus.id, focus]]);
  relations.forEach(relation => unique.set(relation.word.id, relation.word));
  sampled.forEach(word => unique.set(word.id, word));
  return [...unique.values()].slice(0, performanceProfile.lite ? 58 : 96);
}

function buildMemoryGraph(focus) {
  const relations = strongMemoryRelations(focus);
  const relationIds = new Set(relations.map(relation => relation.word.id));
  const relationMeta = new Map(relations.map(relation => [relation.word.id, relation]));
  const source = sampleMemoryWords(focus, relations);
  const focusCategory = memoryCategoryFor(focus).id;
  const categoryCounts = new Map();
  const nodes = source.map(word => {
    const category = memoryCategoryFor(word);
    const categoryIndex = memoryCategories.findIndex(item => item.id === category.id);
    const localIndex = categoryCounts.get(category.id) || 0;
    categoryCounts.set(category.id, localIndex + 1);
    const angle = categoryIndex / memoryCategories.length * Math.PI * 2;
    const isFocusCluster = category.id === focusCategory;
    const centerRadius = isFocusCluster ? 55 : 235;
    const centerX = Math.cos(angle) * centerRadius;
    const centerY = Math.sin(angle * 1.7) * (isFocusCluster ? 35 : 125);
    const centerZ = Math.sin(angle) * (isFocusCluster ? 50 : 185);
    const spread = isFocusCluster ? 92 : 76;
    return {
      id: word.id, word, category, relation: relationIds.has(word.id), relationType: relationMeta.get(word.id)?.type || '', focus: word.id === focus.id,
      learned: Boolean(state.cards[word.id]?.reps),
      x: centerX + (hashUnit(word.word, 1) - .5) * spread * 2,
      y: centerY + (hashUnit(word.word, 2) - .5) * spread * 1.45,
      z: centerZ + (hashUnit(word.word, 3) - .5) * spread * 2
    };
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  const focusNode = byId.get(focus.id);
  Object.assign(focusNode, { x: 0, y: 0, z: 20 });
  relations.forEach((relation, index) => {
    const node = byId.get(relation.word.id);
    if (!node) return;
    const angle = index / Math.max(1, relations.length) * Math.PI * 2;
    const radius = 88 + (index % 2) * 26;
    Object.assign(node, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .7, z: 20 + (index % 2 ? 42 : -30) });
  });
  const edges = [];
  const groups = new Map();
  nodes.forEach(node => { if (!groups.has(node.category.id)) groups.set(node.category.id, []); groups.get(node.category.id).push(node); });
  const edgeKeys = new Set();
  groups.forEach(group => group.forEach(node => {
    group
      .filter(candidate => candidate.id !== node.id)
      .map(candidate => ({ candidate, distance: Math.hypot(node.x - candidate.x, node.y - candidate.y, node.z - candidate.z) }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 2)
      .forEach(({ candidate }, index) => {
        if (node.focus || candidate.focus) return;
        const key = [node.id, candidate.id].sort().join('|');
        if (edgeKeys.has(key)) return;
        edgeKeys.add(key);
        edges.push({ from: node.id, to: candidate.id, strength: index ? .055 : .09 });
      });
  }));
  relations.forEach(relation => { if (byId.has(relation.word.id)) edges.push({ from: focus.id, to: relation.word.id, strength: 1 }); });
  memoryGraph.nodes = nodes;
  memoryGraph.edges = edges;
  memoryGraph.focusWord = focus;
  memoryGraph.strongIds = relationIds;
  memoryGraph.relations = relations;
  memoryGraph.hovered = null;
  hideMemoryHoverCard();
  updateMemoryFocusPanel();
}

function renderMemoryWall() {
  const wall = $('#memoryCardWall');
  if (!wall || wall.childElementCount) return;
  const showcase = words.filter(word => /^[a-z-]{3,12}$/i.test(word.word)).filter((_, index) => index % 107 === 0).slice(0, 24);
  wall.innerHTML = showcase.map((word, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const x = -2 + column * 20.5 + (row % 2 ? 3 : 0);
    const y = -3 + row * 29;
    const rotation = -3 + (index % 5) * 1.5;
    const scale = .74 + (index % 4) * .045;
    return `<article class="memory-wall-card" style="--wall-x:${x}%;--wall-y:${y}%;--wall-r:${rotation}deg;--wall-s:${scale};--wall-delay:${-index * .31}s"><strong>${escapeHtml(word.word)}</strong><em>${escapeHtml(word.phonetic || '/ — /')}</em><small>${escapeHtml(shortMeaning(word.meaning))}</small><i></i></article>`;
  }).join('');
}

function updateMemoryFocusPanel() {
  const focus = memoryGraph.focusWord;
  if (!focus || !$('#memoryFocusWord')) return;
  const panel = $('#memoryFocusPanel');
  panel.classList.toggle('is-long', String(focus.word).length > 17);
  panel.classList.toggle('is-very-long', String(focus.word).length > 28);
  $('#memoryFocusWord').textContent = focus.word;
  $('#memoryFocusPhonetic').textContent = focus.phonetic || '/ — /';
  $('#memoryFocusMeaning').textContent = focus.meaning;
  const progress = state.cards[focus.id];
  $('#memoryFocusState').textContent = progress?.reps ? `已复习 ${progress.reps} 次` : '未学习';
  $('#memoryFocusCategory').textContent = `#${memoryCategoryFor(focus).label}`;
  $('#memoryRelationCount').textContent = `${memoryGraph.relations.length} 个强关联`;
  $('#memoryFocusLinks').innerHTML = memoryGraph.relations.length
    ? memoryGraph.relations.map(relation => {
      const type = relation.type.replace('关联', '').replace('人工精选', '精选');
      return `<button type="button" data-memory-word-id="${escapeHtml(relation.word.id)}" title="${escapeHtml(relation.word.meaning || '')}"><span>${escapeHtml(relation.word.word)}</span><small>${escapeHtml(type)}</small></button>`;
    }).join('')
    : '<p class="memory-empty-relations">暂未找到足够可靠的强关联词，可用搜索继续探索。</p>';
  $('#memoryBackBtn').disabled = memoryGraph.history.length === 0;
  updateMemoryGraphHud();
}

function memoryVisibleNodes() {
  if (!memoryGraph.onlyStrong) return memoryGraph.nodes;
  return memoryGraph.nodes.filter(node => node.focus || node.relation);
}

function updateMemoryGraphHud() {
  const visible = memoryVisibleNodes();
  $('#memoryVisibleCount').textContent = visible.length;
  $('#memoryStrongCount').textContent = memoryGraph.relations.length;
  $('#memoryCanvas').setAttribute('aria-label', `${memoryGraph.focusWord?.word || '当前词'} 的记忆星图，显示 ${visible.length} 个单词节点和 ${memoryGraph.relations.length} 个强关联词`);
  $('#memoryRotateBtn').classList.toggle('is-active', memoryGraph.autoRotate);
  $('#memoryRotateBtn').setAttribute('aria-pressed', String(memoryGraph.autoRotate));
  $('#memoryFocusModeBtn').classList.toggle('is-active', memoryGraph.onlyStrong);
  $('#memoryFocusModeBtn').setAttribute('aria-pressed', String(memoryGraph.onlyStrong));
  $('#memoryFocusModeBtn').textContent = memoryGraph.onlyStrong ? '显示全部' : '聚焦关联';
}

function renderMemory(preferredWordId = '') {
  if (!words.length) return;
  renderMemoryWall();
  const currentStudyWord = studyQueue[currentStudyIndex];
  const focus = words.find(word => word.id === preferredWordId)
    || currentStudyWord
    || words.find(word => word.word.toLowerCase() === 'able')
    || words[0];
  memoryGraph.history = [];
  buildMemoryGraph(focus);
  $('#memorySearch').value = focus.word;
  hideMemorySearchResults();
  resizeMemoryCanvas();
  if (!memoryGraph.frame) memoryGraph.frame = requestAnimationFrame(drawMemoryFrame);
}

function resizeMemoryCanvas() {
  const canvas = $('#memoryCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(performanceProfile.lite ? 1.2 : 2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  }
  memoryGraph.width = width; memoryGraph.height = height; memoryGraph.dpr = dpr;
}

function projectMemoryNode(node) {
  const cosY = Math.cos(memoryGraph.rotationY); const sinY = Math.sin(memoryGraph.rotationY);
  const cosX = Math.cos(memoryGraph.rotationX); const sinX = Math.sin(memoryGraph.rotationX);
  const x1 = node.x * cosY - node.z * sinY;
  const z1 = node.x * sinY + node.z * cosY;
  const y1 = node.y * cosX - z1 * sinX;
  const z2 = node.y * sinX + z1 * cosX;
  const camera = 720;
  const perspective = camera / Math.max(260, camera + z2);
  const scale = Math.min(memoryGraph.width, memoryGraph.height) / 620 * memoryGraph.zoom;
  const compact = memoryGraph.width < 900;
  const centerX = memoryGraph.width * (compact ? .5 : .61);
  const centerY = memoryGraph.height * (compact ? .63 : .53);
  return { node, x: centerX + x1 * perspective * scale, y: centerY + y1 * perspective * scale, z: z2, perspective };
}

function fitMemoryLabel(context, label, maxWidth) {
  const source = String(label || '');
  if (context.measureText(source).width <= maxWidth) return source;
  let result = source;
  while (result.length > 4 && context.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

function memoryRectsOverlap(left, right, padding = 4) {
  return left.x < right.x + right.width + padding && left.x + left.width + padding > right.x
    && left.y < right.y + right.height + padding && left.y + left.height + padding > right.y;
}

function drawNodeLabel(context, point, occupied, active = false) {
  const related = point.node.relation;
  context.save();
  context.font = `${active ? 760 : 650} ${active ? 13 : 10.5}px "Segoe UI",sans-serif`;
  const label = fitMemoryLabel(context, point.node.word.word, active ? 230 : 132);
  const height = active ? 28 : 23;
  const width = Math.min(active ? 250 : 150, context.measureText(label).width + (active ? 22 : 18));
  const centerX = memoryGraph.width * (memoryGraph.width < 900 ? .5 : .61);
  let x = point.x < centerX && !active ? point.x - width - 10 : point.x + 10;
  let y = point.y - height / 2;
  x = Math.max(12, Math.min(memoryGraph.width - width - 12, x));
  y = Math.max(12, Math.min(memoryGraph.height - height - 12, y));
  const offsets = [0, -(height + 5), height + 5, -(height * 2 + 9), height * 2 + 9];
  let rect = { x, y, width, height };
  for (const offset of offsets) {
    const candidate = { ...rect, y: Math.max(12, Math.min(memoryGraph.height - height - 12, y + offset)) };
    if (!occupied.some(item => memoryRectsOverlap(candidate, item))) { rect = candidate; break; }
  }
  if (!active && occupied.some(item => memoryRectsOverlap(rect, item))) { context.restore(); return; }
  occupied.push(rect);
  context.fillStyle = active ? 'rgba(203,255,126,.96)' : related ? 'rgba(5,24,29,.9)' : 'rgba(8,21,27,.85)';
  context.strokeStyle = active ? 'rgba(229,255,183,.82)' : 'rgba(122,231,205,.4)';
  context.lineWidth = 1;
  context.shadowBlur = active ? 17 : 9;
  context.shadowColor = active ? 'rgba(184,255,107,.28)' : 'rgba(71,218,181,.13)';
  context.beginPath(); context.roundRect(rect.x, rect.y, rect.width, rect.height, active ? 9 : 8); context.fill(); context.stroke();
  context.fillStyle = active ? '#09221c' : '#dffff6';
  context.shadowBlur = 0;
  context.fillText(label, rect.x + (active ? 11 : 9), rect.y + (active ? 18.5 : 15.5));
  context.restore();
}

function drawMemoryFrame(time = 0) {
  memoryGraph.frame = null;
  if (currentRoute !== 'memory') return;
  const frameInterval = performanceProfile.lite ? 40 : 24;
  if (memoryGraph.lastDraw && time - memoryGraph.lastDraw < frameInterval) {
    memoryGraph.frame = requestAnimationFrame(drawMemoryFrame);
    return;
  }
  memoryGraph.lastDraw = time;
  const canvas = $('#memoryCanvas'); const context = canvas.getContext('2d');
  context.setTransform(memoryGraph.dpr, 0, 0, memoryGraph.dpr, 0, 0);
  context.clearRect(0, 0, memoryGraph.width, memoryGraph.height);
  if (memoryGraph.autoRotate && !memoryGraph.dragging && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) memoryGraph.rotationY += .00042;
  const visibleIds = new Set(memoryVisibleNodes().map(node => node.id));
  const projected = memoryGraph.nodes.filter(node => visibleIds.has(node.id)).map(projectMemoryNode);
  memoryGraph.projected = projected;
  const points = new Map(projected.map(point => [point.node.id, point]));
  context.lineCap = 'round';
  const focusPoint = points.get(memoryGraph.focusWord?.id);
  if (focusPoint) {
    context.save();
    const halo = context.createRadialGradient(focusPoint.x, focusPoint.y, 3, focusPoint.x, focusPoint.y, 112 * memoryGraph.zoom);
    halo.addColorStop(0, 'rgba(102,229,194,.12)');
    halo.addColorStop(.45, 'rgba(55,184,157,.05)');
    halo.addColorStop(1, 'rgba(55,184,157,0)');
    context.fillStyle = halo;
    context.beginPath(); context.arc(focusPoint.x, focusPoint.y, 112 * memoryGraph.zoom, 0, Math.PI * 2); context.fill();
    context.setLineDash([4, 9]);
    context.strokeStyle = 'rgba(112,225,198,.09)';
    context.lineWidth = 1;
    context.beginPath(); context.ellipse(focusPoint.x, focusPoint.y, 120 * memoryGraph.zoom, 62 * memoryGraph.zoom, -.16, 0, Math.PI * 2); context.stroke();
    context.restore();
  }
  let strongEdgeIndex = 0;
  for (const edge of memoryGraph.edges) {
    const from = points.get(edge.from); const to = points.get(edge.to); if (!from || !to) continue;
    const strong = edge.strength === 1;
    context.beginPath(); context.moveTo(from.x, from.y); context.lineTo(to.x, to.y);
    context.strokeStyle = strong ? `rgba(125,237,204,${.31 + Math.sin(time / 680) * .055})` : `rgba(75,139,136,${edge.strength})`;
    context.lineWidth = strong ? 1.55 : .6; context.stroke();
    if (strong && !performanceProfile.lite) {
      const travel = (time / 2200 + strongEdgeIndex * .17) % 1;
      const x = from.x + (to.x - from.x) * travel; const y = from.y + (to.y - from.y) * travel;
      context.save(); context.fillStyle = 'rgba(175,255,224,.82)'; context.shadowBlur = 11; context.shadowColor = '#71e3c5';
      context.beginPath(); context.arc(x, y, 1.8, 0, Math.PI * 2); context.fill(); context.restore();
      strongEdgeIndex += 1;
    }
  }
  projected.sort((left, right) => right.z - left.z).forEach(point => {
    const node = point.node;
    const active = node.focus; const related = node.relation; const hovered = memoryGraph.hovered === node.id;
    const radius = (active ? 7.2 : related ? 4.1 : node.learned ? 2.6 : 1.75) * Math.max(.55, point.perspective);
    context.save();
    context.shadowBlur = performanceProfile.lite ? (active ? 16 : related ? 8 : 0) : (active ? 30 : related ? 18 : 8);
    context.shadowColor = active ? '#c8ff78' : related ? '#73e8ca' : '#3e9b91';
    context.fillStyle = active ? '#d8ff78' : related ? '#83eed0' : node.learned ? '#60cbb4' : `rgba(85,154,148,${Math.max(.26, .72 - point.z / 620)})`;
    context.beginPath(); context.arc(point.x, point.y, radius + (hovered ? 2 : 0), 0, Math.PI * 2); context.fill();
    if (active) {
      context.strokeStyle = 'rgba(226,255,178,.68)'; context.lineWidth = 1.4;
      context.beginPath(); context.arc(point.x, point.y, radius + 7 + Math.sin(time / 420) * 1.8, 0, Math.PI * 2); context.stroke();
      context.strokeStyle = 'rgba(134,236,207,.16)'; context.beginPath(); context.arc(point.x, point.y, radius + 15, 0, Math.PI * 2); context.stroke();
    }
    context.restore();
  });
  const occupied = [];
  projected
    .filter(point => point.node.focus || point.node.relation || memoryGraph.hovered === point.node.id)
    .sort((left, right) => Number(right.node.focus) - Number(left.node.focus) || Number(right.node.relation) - Number(left.node.relation))
    .slice(0, 8)
    .forEach(point => drawNodeLabel(context, point, occupied, point.node.focus));
  memoryGraph.frame = requestAnimationFrame(drawMemoryFrame);
}

function focusMemoryWord(word, options = {}) {
  if (!word) return;
  const previous = memoryGraph.focusWord;
  if (options.pushHistory !== false && previous && previous.id !== word.id) {
    memoryGraph.history.push(previous.id);
    memoryGraph.history = memoryGraph.history.slice(-20);
  }
  buildMemoryGraph(word);
  $('#memorySearch').value = word.word;
  hideMemorySearchResults();
}

function resetMemoryCamera() {
  memoryGraph.rotationX = -.14; memoryGraph.rotationY = .22; memoryGraph.zoom = 1;
  hideMemoryHoverCard();
}

function changeMemoryZoom(factor) {
  memoryGraph.zoom = Math.max(.62, Math.min(2.2, memoryGraph.zoom * factor));
}

function goBackMemoryWord() {
  const previousId = memoryGraph.history.pop();
  const previous = words.find(word => word.id === previousId);
  if (previous) focusMemoryWord(previous, { pushHistory: false });
  else updateMemoryFocusPanel();
}

function showMemoryHoverCard(node, x, y) {
  const card = $('#memoryHoverCard');
  if (!card || !node || node.focus) return hideMemoryHoverCard();
  $('#memoryHoverWord').textContent = node.word.word;
  $('#memoryHoverPhonetic').textContent = node.word.phonetic || '/ — /';
  $('#memoryHoverMeaning').textContent = node.word.meaning || '暂无释义';
  $('#memoryHoverRelation').textContent = node.relation ? node.relationType : `#${node.category.label}`;
  const cardWidth = 218; const cardHeight = 112;
  const left = x + cardWidth + 24 > memoryGraph.width ? x - cardWidth - 14 : x + 14;
  const top = Math.max(12, Math.min(memoryGraph.height - cardHeight - 12, y - 18));
  card.style.left = `${Math.max(12, left)}px`;
  card.style.top = `${top}px`;
  card.hidden = false;
}

function hideMemoryHoverCard() {
  const card = $('#memoryHoverCard');
  if (card) card.hidden = true;
}

function memorySearchMatches(query) {
  const source = String(query || '').trim().toLowerCase();
  if (!source) return [];
  return words
    .map(word => {
      const label = String(word.word || '').toLowerCase();
      const phonetic = String(word.phonetic || '').toLowerCase();
      const meaning = String(word.meaning || '').toLowerCase();
      let score = 99;
      if (label === source) score = 0;
      else if (label.startsWith(source)) score = 1;
      else if (label.split(/[\s/,-]+/).some(part => part.startsWith(source))) score = 2;
      else if (label.includes(source)) score = 3;
      else if (meaning.includes(source)) score = 4;
      else if (phonetic.includes(source)) score = 5;
      return { word, score };
    })
    .filter(item => item.score < 99)
    .sort((left, right) => left.score - right.score || left.word.word.length - right.word.word.length || stableHash(left.word.word) - stableHash(right.word.word))
    .slice(0, 6)
    .map(item => item.word);
}

function renderMemorySearchResults(query) {
  const results = $('#memorySearchResults');
  const input = $('#memorySearch');
  memoryGraph.searchResults = memorySearchMatches(query);
  memoryGraph.searchIndex = memoryGraph.searchResults.length ? 0 : -1;
  if (!String(query || '').trim()) return hideMemorySearchResults();
  results.innerHTML = memoryGraph.searchResults.length
    ? memoryGraph.searchResults.map((word, index) => `<button class="memory-search-result${index === 0 ? ' is-selected' : ''}" type="button" role="option" aria-selected="${index === 0}" data-memory-search-id="${escapeHtml(word.id)}"><strong>${escapeHtml(word.word)}</strong><em>${escapeHtml(word.phonetic || '/ — /')}</em><small>${escapeHtml(shortMeaning(word.meaning))}</small></button>`).join('')
    : '<p class="memory-search-empty">没有匹配结果，试试英文词头或中文含义。</p>';
  results.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function updateMemorySearchSelection(index) {
  if (!memoryGraph.searchResults.length) return;
  memoryGraph.searchIndex = (index + memoryGraph.searchResults.length) % memoryGraph.searchResults.length;
  $$('.memory-search-result').forEach((button, buttonIndex) => {
    const selected = buttonIndex === memoryGraph.searchIndex;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-selected', String(selected));
  });
}

function chooseMemorySearchResult(word = memoryGraph.searchResults[memoryGraph.searchIndex]) {
  if (!word) return toast('没有找到匹配的单词');
  focusMemoryWord(word);
}

function hideMemorySearchResults() {
  const results = $('#memorySearchResults');
  const input = $('#memorySearch');
  if (results) results.hidden = true;
  if (input) input.setAttribute('aria-expanded', 'false');
  memoryGraph.searchResults = [];
  memoryGraph.searchIndex = -1;
}

function bindMemoryInteractions() {
  const canvas = $('#memoryCanvas');
  canvas.addEventListener('pointerdown', event => {
    memoryGraph.dragging = true; memoryGraph.dragDistance = 0; memoryGraph.lastX = event.clientX; memoryGraph.lastY = event.clientY;
    hideMemoryHoverCard();
    canvas.classList.add('dragging'); canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (memoryGraph.dragging) {
      const dx = event.clientX - memoryGraph.lastX; const dy = event.clientY - memoryGraph.lastY;
      memoryGraph.rotationY += dx * .006; memoryGraph.rotationX = Math.max(-1.1, Math.min(1.1, memoryGraph.rotationX + dy * .005));
      memoryGraph.dragDistance += Math.abs(dx) + Math.abs(dy); memoryGraph.lastX = event.clientX; memoryGraph.lastY = event.clientY;
      return;
    }
    const rect = canvas.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    let nearestId = null; let nearestDistance = Infinity;
    for (const point of memoryGraph.projected) {
      const distance = Math.hypot(point.x - x, point.y - y);
      const hitRadius = point.node.focus ? 26 : point.node.relation ? 22 : 16;
      if (distance > hitRadius || distance >= nearestDistance) continue;
      nearestDistance = distance; nearestId = point.node.id;
    }
    if (memoryGraph.hovered !== nearestId) {
      memoryGraph.hovered = nearestId;
      const node = memoryGraph.nodes.find(item => item.id === nearestId);
      if (node) showMemoryHoverCard(node, x, y); else hideMemoryHoverCard();
    } else if (nearestId) {
      const node = memoryGraph.nodes.find(item => item.id === nearestId);
      showMemoryHoverCard(node, x, y);
    }
  });
  const release = event => { if (!memoryGraph.dragging) return; memoryGraph.dragging = false; canvas.classList.remove('dragging'); if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('click', () => { if (memoryGraph.dragDistance > 8 || !memoryGraph.hovered) return; focusMemoryWord(memoryGraph.nodes.find(node => node.id === memoryGraph.hovered)?.word); });
  canvas.addEventListener('pointerleave', () => { if (!memoryGraph.dragging) { memoryGraph.hovered = null; hideMemoryHoverCard(); } });
  canvas.addEventListener('wheel', event => { event.preventDefault(); changeMemoryZoom(event.deltaY > 0 ? .9 : 1.1); }, { passive: false });
  canvas.addEventListener('dblclick', resetMemoryCamera);
  canvas.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') changeMemoryZoom(1.12);
    else if (event.key === '-') changeMemoryZoom(.88);
    else if (event.key === '0') resetMemoryCamera();
    else if (event.key === ' ') { memoryGraph.autoRotate = !memoryGraph.autoRotate; updateMemoryGraphHud(); }
    else if (event.key === 'ArrowLeft') memoryGraph.rotationY -= .09;
    else if (event.key === 'ArrowRight') memoryGraph.rotationY += .09;
    else if (event.key === 'ArrowUp') memoryGraph.rotationX = Math.max(-1.1, memoryGraph.rotationX - .08);
    else if (event.key === 'ArrowDown') memoryGraph.rotationX = Math.min(1.1, memoryGraph.rotationX + .08);
    else return;
    event.preventDefault();
  });
  memoryResizeObserver = new ResizeObserver(resizeMemoryCanvas); memoryResizeObserver.observe(canvas);
}

function speak(text, sentence = false) {
  if (!('speechSynthesis' in window)) return toast('当前系统没有可用的语音引擎');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text).replace(/\//g, ' or '));
  utterance.lang = 'en-GB';
  utterance.rate = sentence ? .88 : .78;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(voice => /^en-GB/i.test(voice.lang)) || voices.find(voice => /^en/i.test(voice.lang)) || null;
  utterance.onstart = () => $('#speakBtn')?.classList.add('speaking');
  utterance.onend = utterance.onerror = () => $('#speakBtn')?.classList.remove('speaking');
  speechSynthesis.speak(utterance);
}

function renderLibrary() {
  renderLibraryGuide();
  const decks = allDecks();
  $('#deckList').innerHTML = decks.map(deck => {
    const count = wordsForDeck(deck.id).length;
    const main = `<button class="deck-list-item ${selectedDeck === deck.id ? 'active' : ''}" style="--deck:${escapeHtml(deck.color || '#1da779')}" data-deck="${escapeHtml(deck.id)}"><i>${escapeHtml(deck.icon || '词')}</i><span><strong>${escapeHtml(deck.short || deck.name)}</strong><small>${count.toLocaleString()} 个词条</small></span><small aria-hidden="true">›</small></button>`;
    return state.customDecks.some(item => item.id === deck.id)
      ? `<div class="deck-list-row">${main}<button class="deck-manage-btn" data-manage-deck="${escapeHtml(deck.id)}" aria-label="管理词库 ${escapeHtml(deck.name)}" title="管理词库">•••</button></div>`
      : main;
  }).join('');
  $$('.deck-list-item').forEach(button => button.addEventListener('click', () => {
    selectedDeck = button.dataset.deck;
    state.selectedDeck = selectedDeck;
    libraryPage = 0;
    persist();
    renderLibrary();
  }));
  $$('.deck-manage-btn').forEach(button => button.addEventListener('click', () => openDeckManager(button.dataset.manageDeck)));
  const deck = deckFor(selectedDeck);
  const query = $('#wordSearch').value.trim().toLowerCase();
  let filtered = wordsForDeck(selectedDeck).filter(word => !query || `${word.word} ${word.meaning} ${word.phonetic}`.toLowerCase().includes(query));
  if (libraryFilter !== 'all') filtered = filtered.filter(word => wordStatus(word) === libraryFilter);
  $('#libraryTitle').textContent = deck.name;
  $('#libraryCount').textContent = `${filtered.length.toLocaleString()} 个词`;
  const isCustomDeck = state.customDecks.some(item => item.id === selectedDeck);
  $('#addWordBtn').disabled = !isCustomDeck;
  $('#exportDeckBtn').disabled = !isCustomDeck || !wordsForDeck(selectedDeck).length;
  const openIssues = state.cardIssues.filter(issue => issue.status !== 'resolved').length;
  $('#issueCenterCount').textContent = String(openIssues);
  $('#issueCenterBtn').classList.toggle('has-issues', openIssues > 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIBRARY_PAGE_SIZE));
  libraryPage = Math.min(Math.max(0, libraryPage), totalPages - 1);
  const visible = filtered.slice(libraryPage * LIBRARY_PAGE_SIZE, (libraryPage + 1) * LIBRARY_PAGE_SIZE);
  $('#wordTableBody').innerHTML = visible.map(word => {
    const status = wordStatus(word);
    const labels = { new: '未学习', learning: '学习中', mastered: '已掌握', suspended: '已暂停' };
    const card = state.cards[word.id];
    const due = status === 'suspended' ? '已暂停' : !card?.reps ? '—' : formatDue(card.due);
    return `<tr><td class="table-word"><strong>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.phonetic)}</small></td><td>${escapeHtml(word.pos)} ${escapeHtml(word.meaning)}</td><td><span class="status-chip ${status}">${labels[status]}</span></td><td>${due}</td><td><div class="row-actions"><button class="row-speak" data-speak="${escapeHtml(word.word)}" aria-label="朗读 ${escapeHtml(word.word)}">♪</button><button class="row-edit" data-edit-word="${escapeHtml(word.id)}" aria-label="编辑 ${escapeHtml(word.word)}">编辑</button><button class="row-edit" data-card-manage="${escapeHtml(word.id)}" aria-label="管理 ${escapeHtml(word.word)}">管理</button></div></td></tr>`;
  }).join('');
  $('#tableEmpty').classList.toggle('show', !filtered.length);
  const pager = $('#libraryPager');
  if (pager) {
    pager.innerHTML = [
      `<button class="pager-btn" id="pagerPrev" ${libraryPage === 0 ? 'disabled' : ''}>‹ 上一页</button>`,
      `<span class="pager-info">${filtered.length ? `${libraryPage + 1} / ${totalPages} 页 · ${filtered.length.toLocaleString()} 个词` : '0 个词'}</span>`,
      `<button class="pager-btn" id="pagerNext" ${libraryPage >= totalPages - 1 ? 'disabled' : ''}>下一页 ›</button>`
    ].join('');
    $('#pagerPrev')?.addEventListener('click', () => { if (libraryPage > 0) { libraryPage -= 1; renderLibrary(); } });
    $('#pagerNext')?.addEventListener('click', () => { if (libraryPage < totalPages - 1) { libraryPage += 1; renderLibrary(); } });
  }
  $$('.row-speak').forEach(button => button.addEventListener('click', () => speak(button.dataset.speak)));
  $$('.row-edit').forEach(button => button.addEventListener('click', () => openWordEditor(button.dataset.editWord)));
  $$('[data-card-manage]').forEach(button => button.addEventListener('click', () => openCardActions(button.dataset.cardManage)));
}

function renderLibraryGuide() {
  const guide = $('#libraryGuide');
  if (!guide) return;
  const shouldShow = !state.settings.libraryOnboardingSeen || !state.customDecks.length;
  guide.hidden = !shouldShow;
}

function populateWordDeckSelect(value = selectedDeck, disabled = false) {
  const select = $('#editWord_deck');
  if (!select) return;
  select.innerHTML = state.customDecks.map(deck => `<option value="${escapeHtml(deck.id)}">${escapeHtml(deck.name)}</option>`).join('');
  select.value = state.customDecks.some(deck => deck.id === value) ? value : (state.customDecks[0]?.id || '');
  select.disabled = disabled;
  select.closest('.form-field').hidden = disabled;
}

function openNewWordEditor(deckId = selectedDeck) {
  const deck = state.customDecks.find(item => item.id === deckId) || state.customDecks[0];
  if (!deck) {
    openModal('#newDeckModal');
    toast('请先新建一个自定义词库');
    return;
  }
  editingWordId = '';
  editingWordIsBuiltin = false;
  editingWordIsNew = true;
  ['word', 'phonetic', 'pos', 'meaning', 'example', 'zh', 'memory'].forEach(field => $(`#editWord_${field}`).value = '');
  $('#editWord_word').disabled = false;
  populateWordDeckSelect(deck.id, false);
  $('#wordEditorTitle').textContent = `向「${deck.name}」添加单词`;
  $('#deleteWordBtn').hidden = true;
  openModal('#wordEditorModal');
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportSelectedDeck() {
  const deck = state.customDecks.find(item => item.id === selectedDeck);
  if (!deck) return toast('内置词库无需导出；请选择自定义词库');
  const rows = wordsForDeck(deck.id).map(word => [word.word, word.phonetic, word.pos, word.meaning, word.example, word.zh, word.memory].map(csvCell).join(','));
  const content = `\uFEFF单词,音标,词性,中文释义,英文例句,例句翻译,记忆提示\n${rows.join('\n')}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = `${deck.name.replace(/[\\/:*?"<>|]/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast(`已导出「${deck.name}」的 ${rows.length} 个单词`);
}

function renderImportTargets() {
  const select = $('#importTargetDeck');
  if (!select) return;
  select.innerHTML = '<option value="new">新建词库（使用文件名）</option>' + state.customDecks.map(deck => `<option value="${escapeHtml(deck.id)}">导入到：${escapeHtml(deck.name)}</option>`).join('');
  if (state.customDecks.some(deck => deck.id === selectedDeck)) select.value = selectedDeck;
  $('#importNewDeckNameRow').hidden = select.value !== 'new';
}

const issueTypeLabels = { image: '图片不匹配', sentence: '联想句不自然', meaning: '释义有误', pronunciation: '音标或发音', other: '其他问题' };

function renderIssueCenter() {
  const list = $('#issueCenterList');
  if (!list) return;
  $$('#issueFilters button').forEach(button => button.classList.toggle('active', button.dataset.issueFilter === currentIssueFilter));
  const filtered = state.cardIssues
    .filter(issue => currentIssueFilter === 'all' || (currentIssueFilter === 'open' ? issue.status !== 'resolved' : issue.status === 'resolved'))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  $('#issueCenterSummary').textContent = `${state.cardIssues.filter(issue => issue.status !== 'resolved').length} 条待处理 · ${state.cardIssues.filter(issue => issue.status === 'resolved').length} 条已完成`;
  list.innerHTML = filtered.length ? filtered.map(issue => {
    const word = wordById(issue.wordId);
    const date = new Date(issue.createdAt);
    const when = Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月${date.getDate()}日`;
    const resolved = issue.status === 'resolved';
    return `<article class="issue-item ${resolved ? 'resolved' : ''}"><div><span>${escapeHtml(issueTypeLabels[issue.type] || issue.type)}</span><small>${escapeHtml(when)}</small></div><strong>${escapeHtml(word?.word || issue.word || '已删除单词')}</strong><p>${escapeHtml(issue.note || '未填写补充说明')}</p><div class="issue-actions"><button class="text-button" data-issue-edit="${escapeHtml(issue.id)}" ${word ? '' : 'disabled'}>编辑卡片</button><button class="text-button" data-issue-toggle="${escapeHtml(issue.id)}">${resolved ? '重新打开' : '标记已处理'}</button><button class="text-button danger-text" data-issue-delete="${escapeHtml(issue.id)}">删除</button></div></article>`;
  }).join('') : '<div class="backup-empty">当前筛选下没有内容问题。</div>';
  $$('[data-issue-edit]').forEach(button => button.addEventListener('click', () => {
    const issue = state.cardIssues.find(item => item.id === button.dataset.issueEdit);
    if (!issue) return;
    closeModals();
    setTimeout(() => openWordEditor(issue.wordId), 0);
  }));
  $$('[data-issue-toggle]').forEach(button => button.addEventListener('click', () => {
    const issue = state.cardIssues.find(item => item.id === button.dataset.issueToggle);
    if (!issue) return;
    issue.status = issue.status === 'resolved' ? 'open' : 'resolved';
    issue.resolvedAt = issue.status === 'resolved' ? new Date().toISOString() : '';
    persist(); renderIssueCenter(); renderLibrary();
  }));
  $$('[data-issue-delete]').forEach(button => button.addEventListener('click', () => {
    state.cardIssues = state.cardIssues.filter(item => item.id !== button.dataset.issueDelete);
    persist(); renderIssueCenter(); renderLibrary();
  }));
}

function openIssueCenter() {
  currentIssueFilter = 'open';
  renderIssueCenter();
  openModal('#issueCenterModal');
}

function openDeckManager(deckId) {
  const deck = state.customDecks.find(item => item.id === deckId);
  if (!deck) return;
  editingDeckId = deckId;
  $('#deckNameInput').value = deck.name;
  $('#deckManageCount').textContent = `包含 ${wordsForDeck(deckId).length} 个单词`;
  openModal('#deckManagerModal');
}

function openWordEditor(wordId) {
  const word = wordById(wordId);
  const raw = rawWordById(wordId);
  if (!word || !raw) return;
  editingWordId = wordId;
  editingWordIsBuiltin = !state.customWords.some(item => item.id === wordId);
  editingWordIsNew = false;
  const story = memoryStories.get(wordId);
  const override = state.wordOverrides[wordId] || {};
  const editable = {
    ...word,
    example: editingWordIsBuiltin ? (override.example ?? story?.sentence ?? raw.example ?? '') : (word.example || ''),
    zh: editingWordIsBuiltin ? (override.zh ?? raw.zh ?? '') : (word.zh || ''),
    memory: editingWordIsBuiltin ? (override.memory ?? story?.review?.reason ?? raw.memory ?? '') : (word.memory || '')
  };
  const fields = ['word', 'phonetic', 'pos', 'meaning', 'example', 'zh', 'memory'];
  fields.forEach(field => $(`#editWord_${field}`).value = editable[field] || '');
  $('#editWord_word').disabled = editingWordIsBuiltin;
  populateWordDeckSelect(word.deckId, editingWordIsBuiltin);
  $('#wordEditorTitle').textContent = editingWordIsBuiltin ? `编辑「${word.word}」` : '编辑自定义单词卡';
  $('#deleteWordBtn').textContent = editingWordIsBuiltin ? '恢复内置原文' : '删除这张卡';
  $('#deleteWordBtn').hidden = false;
  openModal('#wordEditorModal');
}

function cardHistoryFor(wordId) {
  return state.logs.filter(log => log.wordId === wordId).slice(-20).reverse();
}

function openCardActions(wordId = studyQueue[currentStudyIndex]?.id) {
  const word = wordById(wordId);
  if (!word) return;
  currentCardActionWordId = word.id;
  const flag = state.cardFlags[word.id] || {};
  const history = cardHistoryFor(word.id);
  const issues = state.cardIssues.filter(issue => issue.wordId === word.id && issue.status !== 'resolved');
  $('#cardActionsTitle').textContent = `管理「${word.word}」`;
  $('#cardActionsSummary').textContent = `${[word.pos, word.meaning].filter(Boolean).join(' ')}${issues.length ? ` · ${issues.length} 条待处理标记` : ''}`;
  $('#cardSuspendBtn').textContent = flag.suspended ? '恢复这张卡' : '暂停这张卡';
  const isCurrent = studyQueue[currentStudyIndex]?.id === word.id;
  $('#cardPostponeBtn').disabled = !isCurrent || studyQueue.length - currentStudyIndex <= 1;
  $('#cardHistorySummary').textContent = history.length ? `共 ${state.logs.filter(log => log.wordId === word.id).length} 次` : '暂无记录';
  const ratingLabels = { again: '重来', hard: '模糊', good: '记住了', easy: '太简单' };
  $('#cardHistoryList').innerHTML = history.length ? history.slice(0, 8).map(log => {
    const date = new Date(log.reviewedAt || log.timestamp);
    const when = Number.isNaN(date.getTime()) ? log.date : `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const seconds = Math.max(1, Math.round(Number(log.responseTimeMs || log.elapsedMs || 0) / 1000));
    return `<div><time>${when}</time><span class="history-rating ${escapeHtml(log.rating)}">${ratingLabels[log.rating] || log.rating}</span><small>${seconds} 秒 · 下次 ${escapeHtml(formatDue(log.nextDue || log.afterCard?.due))}</small></div>`;
  }).join('') : '<p class="backup-empty">这张卡还没有评分记录。</p>';
  $('#cardIssueType').value = 'image';
  $('#cardIssueNote').value = '';
  openModal('#cardActionsModal');
}

function removeLearningDataForWordIds(wordIds) {
  const ids = new Set(wordIds);
  ids.forEach(id => delete state.cards[id]);
  ids.forEach(id => delete state.wordOverrides[id]);
  ids.forEach(id => delete state.cardFlags[id]);
  state.cardIssues = state.cardIssues.filter(issue => !ids.has(issue.wordId));
  state.logs = state.logs.filter(log => !ids.has(log.wordId));
  Object.keys(state.keywordStats).forEach(key => {
    if (ids.has(key.split(':')[0])) delete state.keywordStats[key];
  });
  ['known', 'rejected', 'swaps'].forEach(group => {
    const profile = state.keywordProfile?.[group];
    if (!profile) return;
    ids.forEach(id => delete profile[id]);
  });
}

function formatDue(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '未安排';
  if (date.getTime() <= Date.now()) return '现在';
  if (todayKey(date) === todayKey()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (todayKey(date) === todayKey(tomorrow)) return '明天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function fsrsCalibrationSamples() {
  return state.logs.map(log => {
    const before = log.beforeCard;
    const reviewedAt = new Date(log.reviewedAt || log.timestamp).getTime();
    const lastReview = new Date(before?.last_review).getTime();
    const stability = Number(before?.stability);
    const elapsedDays = (reviewedAt - lastReview) / DAY;
    if (!Number.isFinite(stability) || stability <= 0 || !Number.isFinite(elapsedDays) || elapsedDays < .5) return null;
    return { wordId: log.wordId, stability, elapsedDays, recalled: log.rating !== 'again' ? 1 : 0 };
  }).filter(Boolean).slice(-3000);
}

function fsrsRecallProbability(elapsedDays, stability, scale = 1) {
  const adjusted = Math.max(.05, stability * scale);
  return Math.max(.001, Math.min(.999, Math.pow(1 + (19 / 81) * elapsedDays / adjusted, -.5)));
}

function fsrsCalibrationLoss(samples, scale) {
  if (!samples.length) return Infinity;
  return samples.reduce((sum, sample) => {
    const probability = fsrsRecallProbability(sample.elapsedDays, sample.stability, scale);
    return sum - (sample.recalled * Math.log(probability) + (1 - sample.recalled) * Math.log(1 - probability));
  }, 0) / samples.length;
}

function fsrsWorkloadProjection(scale = 1, weights = state.fsrsProfile?.weights) {
  const now = Date.now();
  const horizon = now + 30 * DAY;
  let due = 0;
  let intervalTotal = 0;
  let intervalCount = 0;
  Object.values(state.cards).forEach(card => {
    if (!card?.reps || !card.due) return;
    let simulated = serializableSnapshot(card);
    const scheduled = Math.max(0, Number(simulated.scheduled_days) || 0);
    const lastReview = new Date(simulated.last_review).getTime();
    if (scale !== 1 && Number.isFinite(Number(simulated.stability))) simulated.stability = Math.max(.05, Number(simulated.stability) * scale);
    if (scale !== 1 && Number.isFinite(lastReview) && scheduled > 0) {
      simulated.scheduled_days = Math.max(1, Math.round(scheduled * scale));
      simulated.due = new Date(lastReview + simulated.scheduled_days * DAY).toISOString();
    }
    for (let iteration = 0; iteration < 16; iteration += 1) {
      const dueAt = new Date(simulated.due).getTime();
      if (!Number.isFinite(dueAt) || dueAt > horizon) break;
      const reviewAt = new Date(Math.max(now, dueAt)).toISOString();
      due += 1;
      const next = window.englishAnki.schedule(simulated, {
        requestRetention: state.settings.desiredRetention,
        maximumInterval: state.settings.maximumInterval,
        weights,
        enableFuzz: false
      }, reviewAt).good.card;
      if (!next) break;
      if (Number(next.scheduled_days) > 0) { intervalTotal += Number(next.scheduled_days); intervalCount += 1; }
      simulated = serializableSnapshot(next);
    }
  });
  return { due, averageInterval: intervalCount ? intervalTotal / intervalCount : 0 };
}

function personalizedFsrsAnalysis() {
  const samples = fsrsCalibrationSamples();
  const uniqueWords = new Set(samples.map(sample => sample.wordId)).size;
  const eligible = samples.length >= 80 && uniqueWords >= 30;
  if (!eligible) {
    return {
      eligible: false,
      samples: samples.length,
      uniqueWords,
      scale: 1,
      baselineLoss: null,
      optimizedLoss: null,
      proposedWeights: null,
      baseline: null,
      optimized: null,
      reviewDifference: 0,
      confidence: '—'
    };
  }
  let bestScale = 1;
  let bestLoss = fsrsCalibrationLoss(samples, 1);
  for (let value = .55; value <= 1.8; value += .025) {
    const loss = fsrsCalibrationLoss(samples, value);
    if (loss < bestLoss) { bestLoss = loss; bestScale = value; }
  }
  bestScale = Math.max(.65, Math.min(1.55, Number(bestScale.toFixed(3))));
  const currentWeights = Array.isArray(state.fsrsProfile?.weights)
    ? state.fsrsProfile.weights.slice()
    : (window.englishAnki.defaultFsrsWeights || []).slice();
  const proposedWeights = currentWeights.map((value, index) => index < 4 ? Number((value * bestScale).toFixed(6)) : value);
  const baseline = fsrsWorkloadProjection(1, currentWeights);
  const optimized = fsrsWorkloadProjection(bestScale, proposedWeights);
  return {
    eligible,
    samples: samples.length,
    uniqueWords,
    scale: bestScale,
    baselineLoss: fsrsCalibrationLoss(samples, 1),
    optimizedLoss: bestLoss,
    proposedWeights,
    baseline,
    optimized,
    reviewDifference: optimized.due - baseline.due,
    confidence: samples.length >= 500 ? '高' : samples.length >= 200 ? '中' : '初步'
  };
}

function fsrsApplicationState(analysis) {
  const appliedScale = Number(state.fsrsProfile?.calibrationScale) || 1;
  const appliedAt = Date.parse(state.fsrsProfile?.optimizedAt);
  const sampleGap = Math.max(0, analysis.samples - (Number(state.fsrsProfile?.sampleSize) || 0));
  const sameScale = Math.abs(analysis.scale - appliedScale) < .025;
  const hasApplied = Number.isFinite(appliedAt);
  return {
    appliedScale,
    sampleGap,
    sameScale,
    hasApplied,
    waitingForSamples: hasApplied && sampleGap < 80,
    waiting: hasApplied && (sampleGap < 80 || sameScale)
  };
}

function renderFsrsOptimizer() {
  const box = $('#fsrsOptimizer');
  if (!box) return;
  const analysis = personalizedFsrsAnalysis();
  box.dataset.eligible = String(analysis.eligible);
  $('#fsrsSampleCount').textContent = `${analysis.samples} 条有效记录 · ${analysis.uniqueWords} 个词`;
  const needReviews = Math.max(0, 80 - analysis.samples);
  const needWords = Math.max(0, 30 - analysis.uniqueWords);
  if (!analysis.eligible) {
    $('#fsrsOptimizerCopy').textContent = `还需${needReviews ? `约 ${needReviews} 条跨日评分` : ''}${needReviews && needWords ? '、' : ''}${needWords ? `${needWords} 个不同单词` : ''}，达到门槛后才能避免过拟合。`;
    $('#fsrsImpact').innerHTML = '<span><small>当前状态</small><strong>继续积累数据</strong></span><i>→</i><span><small>优化条件</small><strong>80 条 / 30 词</strong></span>';
    $('#applyFsrsOptimizationBtn').disabled = true;
    return analysis;
  }
  const direction = analysis.reviewDifference > 0 ? `增加 ${analysis.reviewDifference} 张` : analysis.reviewDifference < 0 ? `减少 ${Math.abs(analysis.reviewDifference)} 张` : '基本不变';
  const applied = fsrsApplicationState(analysis);
  $('#fsrsOptimizerCopy').textContent = applied.waitingForSamples
    ? `已应用稳定度修正系数 ${applied.appliedScale.toFixed(2)}；新增 ${applied.sampleGap}/80 条跨日评分后再次优化。`
    : applied.waiting
      ? '已应用稳定度修正系数；当前参数仍匹配，无需重复应用。'
      : `校准置信度${analysis.confidence}。你的稳定度修正系数为 ${analysis.scale.toFixed(2)}，预计未来 30 天复习量${direction}。`;
  $('#fsrsImpact').innerHTML = `<span><small>当前参数</small><strong>${analysis.baseline.due} 张 / 30 天</strong><em>平均间隔 ${analysis.baseline.averageInterval.toFixed(1)} 天</em></span><i>→</i><span><small>个性化参数</small><strong>${analysis.optimized.due} 张 / 30 天</strong><em>平均间隔 ${analysis.optimized.averageInterval.toFixed(1)} 天</em></span>`;
  const alreadyMatched = Math.abs(analysis.scale - 1) < .025;
  $('#applyFsrsOptimizationBtn').disabled = alreadyMatched || applied.waiting;
  $('#applyFsrsOptimizationBtn').textContent = applied.waitingForSamples
    ? '已应用，等待新数据'
    : applied.waiting ? '已应用，参数仍匹配'
      : alreadyMatched ? '当前参数已经很匹配' : '备份并应用个性化参数';
  return analysis;
}

async function applyFsrsOptimization() {
  const analysis = personalizedFsrsAnalysis();
  const applied = fsrsApplicationState(analysis);
  if (!analysis.eligible || applied.waiting || Math.abs(analysis.scale - 1) < .025) return;
  if (!confirm(`将按 ${analysis.samples} 条有效记录应用稳定度系数 ${analysis.scale.toFixed(2)}。未来 30 天预计从 ${analysis.baseline.due} 张变为 ${analysis.optimized.due} 张。\n\n应用前会自动备份，是否继续？`)) return;
  if (!await window.englishAnki.backupData()) return toast('备份失败，已取消应用个性化参数');
  Object.values(state.cards).forEach(card => {
    if (!card?.reps || !Number.isFinite(Number(card.stability))) return;
    card.stability = Math.max(.05, Number(card.stability) * analysis.scale);
    if (Number(card.scheduled_days) > 0 && card.last_review) {
      card.scheduled_days = Math.max(1, Math.min(state.settings.maximumInterval, Math.round(Number(card.scheduled_days) * analysis.scale)));
      card.due = new Date(new Date(card.last_review).getTime() + card.scheduled_days * DAY).toISOString();
    }
  });
  state.fsrsProfile = {
    weights: analysis.proposedWeights,
    optimizedAt: new Date().toISOString(),
    calibrationScale: analysis.scale,
    sampleSize: analysis.samples,
    uniqueWords: analysis.uniqueWords
  };
  persist();
  refreshDataViews();
  toast('个性化 FSRS 参数已应用，原数据已自动备份');
}

function wordPerformanceSummaries() {
  const wordsById = new Map(allWords().map(word => [word.id, word]));
  const summaries = new Map();
  state.logs.forEach(log => {
    const word = wordsById.get(log.wordId);
    if (!word) return;
    const item = summaries.get(log.wordId) || {
      word,
      attempts: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      lastRating: '',
      lastReviewedAt: ''
    };
    item.attempts += 1;
    if (['again', 'hard', 'good', 'easy'].includes(log.rating)) item[log.rating] += 1;
    item.lastRating = log.rating || item.lastRating;
    item.lastReviewedAt = log.reviewedAt || log.timestamp || item.lastReviewedAt;
    summaries.set(log.wordId, item);
  });
  return [...summaries.values()].map(item => {
    const card = state.cards[item.word.id] || {};
    const errorRate = (item.again + item.hard * .45) / Math.max(1, item.attempts);
    const recentPenalty = item.lastRating === 'again' ? 3 : item.lastRating === 'hard' ? 1.2 : 0;
    const lowStabilityPenalty = Math.max(0, 3 - Math.min(3, Number(card.stability) || 0) / 7);
    return {
      ...item,
      card,
      errorRate,
      weaknessScore: item.again * 4 + item.hard * 1.6 + (Number(card.lapses) || 0) * 2.5 + recentPenalty + lowStabilityPenalty
    };
  });
}

function weakestWordEntries(limit = 12) {
  return wordPerformanceSummaries()
    .filter(item => wordIsAvailable(item.word) && item.attempts > 0 && (item.again > 0 || item.hard > 0 || item.errorRate >= .3))
    .sort((left, right) => right.weaknessScore - left.weaknessScore || right.errorRate - left.errorRate)
    .slice(0, limit);
}

function startWeakStudy() {
  const queue = weakestWordEntries(30).filter(item => wordIsAvailable(item.word)).map(item => item.word);
  if (!queue.length) return toast('目前还没有需要专项复习的薄弱词');
  clearTimeout(studyAdvanceTimer);
  currentStudyMode = 'weak';
  currentStudyLabel = '薄弱词专项复习';
  lastRatingUndo = null;
  studySessionStartedAt = Date.now();
  lastRestPromptAt = studySessionStartedAt;
  studyQueue = queue;
  studyQueueKinds = new Map(queue.map(word => [word.id, 'review']));
  currentStudyIndex = 0;
  initialQueueSize = queue.length;
  route('study', { start: false });
  $('#studyDeckLabel').textContent = currentStudyLabel;
  saveCurrentStudySession();
  showCurrentCard();
}

function renderActionStats() {
  const summaries = wordPerformanceSummaries();
  const weak = [...summaries]
    .filter(item => wordIsAvailable(item.word) && (item.again > 0 || item.hard > 0 || item.errorRate >= .3))
    .sort((left, right) => right.weaknessScore - left.weaknessScore);
  const weakest = weak.slice(0, 10);
  const againRank = [...summaries].filter(item => item.again > 0).sort((a, b) => b.again - a.again || b.weaknessScore - a.weaknessScore).slice(0, 10);
  const weakButtons = [$('#weakReviewBtn'), $('#weakReviewInlineBtn')].filter(Boolean);
  weakButtons.forEach(button => {
    button.disabled = !weak.length;
    button.setAttribute('aria-disabled', String(!weak.length));
  });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const forecast = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(start + index * DAY),
    confirmed: 0,
    projected: 0
  }));
  Object.entries(state.cards).forEach(([wordId, card]) => {
    if (state.cardFlags?.[wordId]?.suspended) return;
    if (!card?.reps || !card.due) return;
    const due = new Date(card.due).getTime();
    const index = due < start ? 0 : Math.floor((due - start) / DAY);
    if (index >= 0 && index < 7) forecast[index].confirmed += 1;
  });
  const pace = personalStudyPace();
  const repeatFactor = 1 + pace.againRate * .45;
  const unlimitedEstimate = Math.max(0, Math.floor(
    Math.max(15, Math.min(240, Number(state.settings.dailyStudyMinutes) || 45)) * 60
      / Math.max(1, pace.newSeconds * repeatFactor)
  ));
  const configuredNew = state.settings.dailyNew === -1
    ? Math.min(newWords(selectedDeck).length, unlimitedEstimate)
    : Math.max(0, Number(state.settings.dailyNew) || 0);
  const configuredNewLabel = state.settings.dailyNew === -1
    ? `无上限（按时间预算估算 ${configuredNew} 个）`
    : `${configuredNew} 个`;
  const projectionOffsets = [[1, 1], [3, .82], [6, .64]];
  for (let cohort = 0; cohort < 7; cohort += 1) {
    projectionOffsets.forEach(([offset, weight]) => {
      const day = cohort + offset;
      if (day < 7) forecast[day].projected += Math.round(configuredNew * weight);
    });
  }
  const forecastTotal = forecast.reduce((sum, day) => sum + day.confirmed + day.projected, 0);
  const confirmedTotal = forecast.reduce((sum, day) => sum + day.confirmed, 0);
  const projectedTotal = forecast.reduce((sum, day) => sum + day.projected, 0);
  const maxForecast = Math.max(1, ...forecast.map(day => day.confirmed + day.projected));
  const weekday = ['日', '一', '二', '三', '四', '五', '六'];
  $('#reviewForecast').innerHTML = forecast.map((day, index) => {
    const total = day.confirmed + day.projected;
    const confirmedHeight = day.confirmed / maxForecast * 100;
    const projectedHeight = day.projected / maxForecast * 100;
    return `<div class="forecast-day" title="已确定 ${day.confirmed} · 新词预计 ${day.projected}"><strong>${total}</strong><div class="forecast-stack"><i style="height:${confirmedHeight}%"></i><i style="height:${projectedHeight}%"></i></div><span>${index === 0 ? '今天' : `周${weekday[day.date.getDay()]}`}</span></div>`;
  }).join('');
  $('#forecastSummary').textContent = `已确定 ${confirmedTotal} 张＋按每日新词 ${configuredNewLabel} 预计新增 ${projectedTotal} 张。`;

  const ratingMeta = [
    ['again', '重来', 'var(--red)'],
    ['hard', '模糊', 'var(--orange)'],
    ['good', '记住了', 'var(--green)'],
    ['easy', '太简单', 'var(--blue)']
  ];
  const ratingCounts = Object.fromEntries(ratingMeta.map(([key]) => [key, state.logs.filter(log => log.rating === key).length]));
  const ratingTotal = Math.max(1, Object.values(ratingCounts).reduce((sum, value) => sum + value, 0));
  $('#ratingBreakdown').innerHTML = ratingMeta.map(([key, label, color]) => {
    const count = ratingCounts[key];
    const percent = Math.round(count / ratingTotal * 100);
    return `<div class="rating-breakdown-row" style="--rating-color:${color}"><span>${label}</span><div><i style="width:${percent}%"></i></div><strong>${count ? percent : 0}%</strong><small>${count} 次</small></div>`;
  }).join('');

  $('#weakestWords').innerHTML = weakest.length ? weakest.map((item, index) => `<div class="ranked-word"><span>${index + 1}</span><div><strong>${escapeHtml(item.word.word)}</strong><small>${escapeHtml(shortMeaning(item.word.meaning))}</small></div><em>失误 ${Math.round(item.errorRate * 100)}%</em><b>${item.again} 次重来</b></div>`).join('') : '<p class="empty-insight">还没有薄弱词。继续学习后会自动识别。</p>';
  $('#againRanking').innerHTML = againRank.length ? againRank.map((item, index) => `<div class="ranked-word"><span>${index + 1}</span><div><strong>${escapeHtml(item.word.word)}</strong><small>${escapeHtml(shortMeaning(item.word.meaning))}</small></div><em>${item.attempts} 次复习</em><b>${item.again} 次重来</b></div>`).join('') : '<p class="empty-insight">目前还没有“重来”记录。</p>';

  const decks = allDecks().filter(deck => wordsForDeck(deck.id).length);
  $('#deckStats').innerHTML = decks.map(deck => {
    const deckWords = wordsForDeck(deck.id);
    const ids = new Set(deckWords.map(word => word.id));
    const learned = deckWords.filter(word => state.cards[word.id]?.reps).length;
    const reviews = state.logs.filter(log => ids.has(log.wordId)).length;
    const pct = Math.round(learned / Math.max(1, deckWords.length) * 100);
    return `<div class="deck-stat-row"><i style="--deck:${escapeHtml(deck.color || '#1da779')}">${escapeHtml(deck.icon || '词')}</i><div><strong>${escapeHtml(deck.short || deck.name)}</strong><span><b style="width:${pct}%"></b></span></div><em>${learned}/${deckWords.length}</em><small>${reviews} 次复习</small></div>`;
  }).join('');

  const examPlan = examStudyPlan();
  const examCopy = examPlan && !examPlan.expired && examPlan.remaining ? ` 距考试 ${examPlan.days} 天，建议每日新学 ${examPlan.recommended} 个。` : '';
  const nextCopy = (weak.length
    ? `优先复习 ${weak.length} 个薄弱词，最需要关注「${weak[0].word.word}」。未来 7 天预计有 ${forecastTotal} 张卡片到期。`
    : forecastTotal
      ? `薄弱词表现稳定。未来 7 天预计有 ${forecastTotal} 张卡片到期，按计划复习即可。`
      : '当前没有积压或明显薄弱词，可以继续学习一组新词。') + examCopy;
  $('#nextActionCopy').textContent = nextCopy;
}

function renderStats() {
  const logs = state.logs;
  const activeDays = [...new Set(logs.map(log => log.date))];
  const statsWords = allWords();
  const mastered = statsWords.filter(word => wordStatus(word) === 'mastered').length;
  const learned = statsWords.filter(word => state.cards[word.id]?.reps).length;
  const totalMs = logs.reduce((sum, log) => sum + (log.elapsedMs || 0), 0);
  const avgSeconds = logs.length ? totalMs / logs.length / 1000 : 0;
  const retention = estimatedRetention();
  $('#statReviews').textContent = logs.length.toLocaleString();
  $('#statDays').innerHTML = `${activeDays.length} <i>天</i>`;
  $('#statHours').innerHTML = `${(totalMs / 3_600_000).toFixed(1)} <i>小时</i>`;
  $('#statAvgTime').textContent = `平均 ${activeDays.length ? Math.round(totalMs / 60_000 / activeDays.length) : 0} 分钟/天`;
  $('#statMastered').innerHTML = `${mastered.toLocaleString()} <i>词</i>`;
  $('#statMasterRate').textContent = `已学习 ${learned.toLocaleString()} · 掌握率 ${learned ? Math.round(mastered / learned * 100) : 0}%`;
  $('#retentionValue').textContent = `${retention}%`;
  $('#retentionRing').style.setProperty('--value', `${retention * 3.6}deg`);
  $('#retentionHint').textContent = logs.length ? `基于 ${learned} 张卡片的稳定度与距上次复习时间估算。` : '完成第一轮学习后，我们会估算你的记忆保留率。';
  const rating = !logs.length ? '蓄势待发' : avgSeconds <= 8 ? '闪电记忆' : avgSeconds <= 14 ? '高效专注' : avgSeconds <= 24 ? '稳步积累' : '深度思考';
  $('#speedRating').textContent = rating;
  $('#achievementTitle').textContent = logs.length ? `已完成 ${logs.length.toLocaleString()} 次主动回忆，平均每张 ${avgSeconds.toFixed(1)} 秒` : '开始第一组学习';
  $('#achievementCopy').textContent = logs.length ? `${learned.toLocaleString()} 个单词已进入 FSRS 复习循环，今天完成 ${todayLogs().length} 次。` : '完成一次学习后，这里会生成专属速度与记忆报告。';
  renderBarChart();
  renderHeatmap();
  renderActionStats();
  renderFsrsOptimizer();
}

function estimatedRetention() {
  const cards = Object.values(state.cards).filter(card => card.reps && card.last_review && card.stability);
  if (!cards.length) return 0;
  const now = Date.now();
  const total = cards.reduce((sum, card) => {
    const elapsed = Math.max(0, (now - new Date(card.last_review).getTime()) / DAY);
    return sum + Math.pow(1 + elapsed / (9 * Math.max(.1, card.stability)), -1);
  }, 0);
  return Math.round(total / cards.length * 100);
}

function renderBarChart() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const data = days.map(date => {
    const logs = state.logs.filter(log => log.date === todayKey(date));
    return { date, fresh: logs.filter(log => log.isNew).length, review: logs.filter(log => !log.isNew).length };
  });
  const max = Math.max(10, ...data.map(day => day.fresh + day.review));
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  $('#barChart').innerHTML = data.map(day => `<div class="bar-day" title="${day.fresh + day.review} 次"><i style="height:${day.fresh / max * 88}%"></i><i style="height:${day.review / max * 88}%"></i><span>周${weekdays[day.date.getDay()]}</span></div>`).join('');
}

function renderHeatmap() {
  const counts = {};
  state.logs.forEach(log => counts[log.date] = (counts[log.date] || 0) + 1);
  const max = Math.max(1, ...Object.values(counts));
  $('#heatmap').innerHTML = Array.from({ length: 28 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - (27 - i));
    const count = counts[todayKey(date)] || 0;
    const level = count ? Math.max(1, Math.ceil(count / max * 4)) : 0;
    return `<span class="heat-cell" data-level="${level}" title="${todayKey(date)} · ${count} 次"></span>`;
  }).join('');
}

function getStreak() {
  const days = new Set(state.logs.map(log => log.date));
  let count = 0;
  const cursor = new Date();
  if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(todayKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }
  return count;
}

function levelName() {
  const learned = Object.values(state.cards).filter(card => card.reps).length;
  if (learned >= 2000) return '词汇征服者';
  if (learned >= 1000) return '记忆进阶者';
  if (learned >= 300) return '稳定积累中';
  if (learned >= 50) return '节奏已建立';
  return '正在起步';
}

function setBackgroundInert(value) {
  ['.app-shell', '.titlebar', '.ambient'].forEach(selector => {
    $$(selector).forEach(element => { element.inert = value; });
  });
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  lastModalFocus = document.activeElement;
  setBackgroundInert(true);
  modal.classList.add('open');
  requestAnimationFrame(() => {
    if (!modal.classList.contains('open')) return;
    const target = $$('input:not([type="hidden"]), select, textarea, button:not(.modal-close):not([disabled]), [tabindex="0"]', modal)
      .find(element => element.offsetParent !== null) || modal.querySelector('.modal-close');
    target?.focus();
  });
}

function closeModals() {
  $$('.modal-backdrop').forEach(modal => modal.classList.remove('open'));
  setBackgroundInert(false);
  if (lastModalFocus?.isConnected) lastModalFocus.focus();
  lastModalFocus = null;
}

function parseDelimited(text, filename) {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/)[0] || '';
  const delimiter = filename.endsWith('.tsv') ? '\t' : (firstLine.includes('\t') && !firstLine.includes(',')) ? '\t' : ',';
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && value === '') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(value.trim());
      value = '';
    } else if (char === '\n') {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }
  row.push(value.trim());
  rows.push(row);
  const parsed = rows.filter(fields => fields.some(field => field !== ''));
  const headerHints = /^(音标|phonetic|词性|pos|释义|meaning|例句|example|翻译|记忆|memory)/i;
  const first = parsed[0] || [];
  if (/^(单词|word)$/i.test(String(first[0] || '').trim()) && first.slice(1).some(field => headerHints.test(String(field).trim()))) parsed.shift();
  return parsed.filter(row => row[0]).map((row, index) => ({
    id: `custom-${Date.now()}-${index}`, word: row[0], phonetic: row[1] || '', pos: row[2] || '', meaning: row[3] || row[1] || '',
    example: row[4] || '', zh: row[5] || '', memory: row[6] || '', tierName: '自定义', deckId: ''
  }));
}

function decodeImportText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return new TextDecoder().decode(buffer);
    }
  }
}

async function importFile(file) {
  const progress = $('#importProgress');
  const progressLabel = progress?.querySelector('span');
  if (progress) {
    progress.hidden = false;
    if (progressLabel) progressLabel.textContent = '正在读取文件…';
  }
  try {
    const buffer = await file.arrayBuffer();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (progressLabel) progressLabel.textContent = '正在解析并写入词库…';
    const imported = parseDelimited(decodeImportText(buffer), file.name.toLowerCase());
    if (!imported.length) return toast('没有识别到有效单词');
    const requestedDeck = $('#importTargetDeck')?.value || 'new';
    let targetDeck = state.customDecks.find(deck => deck.id === requestedDeck);
    if (!targetDeck) {
      const id = `deck-${Date.now()}`;
      const fallbackName = file.name.replace(/\.[^.]+$/, '');
      const name = $('#importNewDeckName')?.value.trim() || fallbackName;
      targetDeck = { id, name, short: name, desc: '自定义导入词库', color: '#2a9fa5', icon: '自', tier: null };
    }
    const existing = new Set(state.customWords.filter(word => word.deckId === targetDeck.id).map(word => word.word.trim().toLowerCase()));
    const seen = new Set();
    const unique = imported.filter(word => {
      const key = word.word.trim().toLowerCase();
      if (!key || existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const skipped = imported.length - unique.length;
    if (!unique.length) return toast('导入内容中的单词都已存在');
    unique.forEach(word => word.deckId = targetDeck.id);
    state.customWords.push(...unique);
    if (!state.customDecks.some(deck => deck.id === targetDeck.id)) state.customDecks.push(targetDeck);
    state.settings.libraryOnboardingSeen = true;
    selectedDeck = targetDeck.id;
    state.selectedDeck = selectedDeck;
    relatedVocabularyIndex = null;
    relatedWordCache.clear();
    persist(); closeModals(); route('library'); toast(`已导入 ${unique.length} 张单词卡${skipped ? `，跳过 ${skipped} 个重复词` : ''}`);
  } catch {
    toast('导入失败：无法读取文件');
  } finally {
    if (progress) progress.hidden = true;
  }
}

function downloadTemplate() {
  const content = '\uFEFF单词,音标,词性,中文释义,英文例句,例句翻译,记忆提示\nexample,/ɪɡˈzɑːmpəl/,n.,例子,This is an example.,这是一个例子。,ex + ample：拿出来的样本';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = '英语-Anki-词库导入模板.csv'; link.click(); URL.revokeObjectURL(link.href);
}

function toast(message) {
  const element = $('#toast'); element.textContent = message; element.classList.add('show');
  clearTimeout(element.timer); element.timer = setTimeout(() => element.classList.remove('show'), 2300);
}

function applyZoom() {
  const userZoom = Number(state.settings.zoom);
  const desired = Number.isFinite(userZoom) && userZoom > 0
    ? userZoom
    : (window.outerWidth <= 1100 || window.outerHeight <= 740 ? 1 : 1.15);
  const sizeLimit = Math.min(window.outerWidth / 980, window.outerHeight / 680);
  const factor = Math.max(1, Math.min(desired, sizeLimit));
  window.englishAnki.setZoomFactor(factor);
  return factor;
}

async function renderBackupList() {
  const box = $('#backupList');
  if (!box) return;
  let list = [];
  try {
    list = await window.englishAnki.listBackups();
  } catch {
    list = [];
  }
  if (!list.length) {
    box.innerHTML = '<div class="backup-empty">暂无备份。每次学习后会自动生成，也可以点“立即备份”。</div>';
    return;
  }
  box.innerHTML = list.map(item => {
    const time = new Date(item.time);
    const size = item.size > 1024 ? `${(item.size / 1024).toFixed(0)} KB` : `${item.size} B`;
    const label = `${time.getMonth() + 1}月${time.getDate()}日 ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    const invalid = item.valid === false;
    const integrity = invalid ? '校验失败'
      : item.integrity === 'verified' ? '完整性已验证'
        : item.integrity === 'legacy' ? '旧版明文备份'
          : '恢复时校验';
    const meta = invalid ? '文件不可恢复'
      : item.meta ? `${item.meta.learned || 0} 词 · ${item.meta.reviews || 0} 次评分`
        : '内容恢复时校验';
    return `<div class="backup-item ${invalid ? 'invalid' : ''}"><time>${label}</time><span>${size} · ${meta}</span><small class="backup-integrity ${escapeHtml(item.integrity || 'unverified')}">${integrity}</small><button class="text-button" data-restore="${escapeHtml(item.name)}" ${invalid ? 'disabled' : ''}>恢复</button></div>`;
  }).join('');
  $$('#backupList [data-restore]').forEach(button => button.addEventListener('click', async () => {
    const item = list.find(entry => entry.name === button.dataset.restore);
    if (item?.valid === false) return toast('恢复失败：备份完整性校验未通过');
    let inspection = { valid: true, integrity: item?.integrity || 'unverified', meta: item?.meta || null };
    if (!item?.meta || item.valid !== true) {
      inspection = await window.englishAnki.inspectBackup(button.dataset.restore);
      if (!inspection?.valid) return toast('恢复失败：备份文件无效');
    }
    const meta = inspection.meta || {};
    const preview = `包含 ${meta.learned || 0} 个已学习单词、${meta.reviews || 0} 次评分和 ${meta.customWords || 0} 个自定义词。`;
    if (!confirm(`恢复前预览：${preview}\n\n完整性：${inspection.integrity === 'verified' ? 'SHA-256 已验证' : '旧版兼容备份'}。\n当前数据会先自动备份，然后再恢复。是否继续？`)) return;
    const data = await window.englishAnki.restoreBackup(button.dataset.restore);
    if (!data) { toast('恢复失败：备份文件无效或当前数据备份失败'); return; }
    state = normalizeState(data);
    selectedDeck = state.selectedDeck || 'hebei-3000';
    relatedVocabularyIndex = null;
    relatedWordCache.clear();
    keywordFamiliarityCache.clear();
    resetStudySessionState();
    persist();
    document.body.classList.toggle('dark', state.settings.theme === 'dark');
    applyPerformanceMode();
    applyZoom();
    closeModals();
    refreshDataViews();
    toast('已从备份恢复');
  }));
}

async function renderBackupLocation() {
  const label = $('#backupLocationLabel');
  if (!label) return;
  try {
    const location = await window.englishAnki.backupLocation();
    label.textContent = location?.directory || '默认应用数据目录';
    label.title = label.textContent;
    $('#resetBackupDirBtn').disabled = !location?.custom;
  } catch {
    label.textContent = '备份目录读取失败';
  }
}

async function renderSyncStatus(provided) {
  const status = provided || await window.englishAnki.syncStatus();
  const label = $('#syncLocationLabel');
  if (!label) return status;
  label.textContent = status.directory || '尚未配置';
  label.title = status.directory || '';
  const messages = {
    disabled: '选择 OneDrive、坚果云或其他同步文件夹后启用',
    empty: '目录和本机都没有可同步数据',
    'local-only': '云端暂无数据，可以上传本机记录',
    'local-newer': '本机有新进度，等待上传',
    'remote-newer': '云端有新进度，等待拉取',
    synced: '本机与云端一致',
    conflict: '本机和云端都已修改，请手动选择保留哪一份',
    invalid: '云端同步文件校验失败，不会自动覆盖本机'
  };
  $('#syncStateLabel').textContent = messages[status.state] || status.state;
  $('#syncStateLabel').className = `sync-state ${status.state || 'disabled'}`;
  $('#syncAutoInput').checked = status.auto !== false;
  $('#resetSyncDirBtn').disabled = !status.configured;
  ['syncPullBtn', 'syncPushBtn', 'syncNowBtn'].forEach(id => { $(`#${id}`).disabled = !status.configured; });
  $('#syncPullBtn').disabled = !status.configured || !status.remoteMeta || status.state === 'invalid';
  return status;
}

function applyPulledSyncData(result) {
  if (!result?.data) return;
  state = normalizeState(result.data);
  selectedDeck = state.selectedDeck || 'hebei-3000';
  relatedVocabularyIndex = null;
  relatedWordCache.clear();
  keywordFamiliarityCache.clear();
  resetStudySessionState();
  document.body.classList.toggle('dark', state.settings.theme === 'dark');
  applyPerformanceMode();
  applyZoom();
  refreshDataViews();
}

function renderUpdateStatus(status) {
  if (!status || !$('#updateStatusCopy')) return;
  $('#currentVersionLabel').textContent = status.currentVersion || '—';
  if ('source' in status) $('#updateSourceInput').value = status.source || '';
  if ('auto' in status) $('#autoUpdateCheckInput').checked = status.auto !== false;
  const result = status.result || status;
  pendingUpdateResult = result?.available ? result : null;
  const button = $('#openUpdateBtn');
  button.hidden = !result?.available || !result.downloadUrl;
  if (result?.available) $('#updateStatusCopy').textContent = `发现 ${result.version}：${result.notes || '有新版本可用。'}`;
  else if (result?.ok === false) $('#updateStatusCopy').textContent = `检查失败：${result.error || '无法访问版本源'}`;
  else if (result?.reason === 'no-source') $('#updateStatusCopy').textContent = '未设置远程版本源；可在同步目录放置 english-anki-update.json。';
  else if (result?.checkedAt) $('#updateStatusCopy').textContent = `当前已是最新版本（${new Date(result.checkedAt).toLocaleString('zh-CN')} 检查）。`;
  else $('#updateStatusCopy').textContent = '尚未检查更新。';
}

async function loadIntegrationSettings() {
  try {
    const [sync, update] = await Promise.all([window.englishAnki.syncStatus(), window.englishAnki.updateStatus()]);
    await renderSyncStatus(sync);
    renderUpdateStatus(update);
  } catch (error) {
    $('#syncStateLabel').textContent = `读取失败：${error.message}`;
  }
}

function bindEvents() {
  const studyCard = $('#wordCard');
  let cardPointerFrame = 0;
  let pendingCardPointer = null;
  let cardPointerRect = null;
  const renderCardPointer = () => {
    cardPointerFrame = 0;
    const point = pendingCardPointer;
    pendingCardPointer = null;
    if (!point) return;
    const rect = cardPointerRect || studyCard.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (point.x - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (point.y - rect.top) / rect.height));
    studyCard.style.setProperty('--ry', `${(x - .5) * 12}deg`);
    studyCard.style.setProperty('--rx', `${(.5 - y) * 9}deg`);
    if (!performanceProfile.lite) {
      studyCard.style.setProperty('--mx', `${x * 100}%`);
      studyCard.style.setProperty('--my', `${y * 100}%`);
      studyCard.style.setProperty('--glare-angle', `${112 + (x - .5) * 24}deg`);
      studyCard.style.setProperty('--glare-strength', '.94');
    }
    studyCard.style.setProperty('--scene-x', `${(.5 - x) * 18}px`);
    studyCard.style.setProperty('--scene-y', `${(.5 - y) * 13}px`);
    studyCard.style.setProperty('--scene-ry', `${(.5 - x) * 4.5}deg`);
    studyCard.style.setProperty('--scene-rx', `${(y - .5) * 3.5}deg`);
    studyCard.style.setProperty('--word-x', `${(x - .5) * 28}px`);
    studyCard.style.setProperty('--word-y', `${(y - .5) * 20}px`);
    studyCard.style.setProperty('--word-rx', `${(.5 - y) * 8}deg`);
    studyCard.style.setProperty('--word-ry', `${(x - .5) * 12}deg`);
    studyCard.style.setProperty('--word-shadow-x', `${(.5 - x) * 18}px`);
    studyCard.style.setProperty('--word-shadow-y', `${(.5 - y) * 12}px`);
  };
  $$('[data-route]').forEach(button => button.addEventListener('click', () => route(button.dataset.route)));
  $('#startStudyBtn').addEventListener('click', () => route('study', { deckId: resolvedSelectedDeckId() }));
  $('#exitStudyBtn').addEventListener('click', () => route('home'));
  $('#cardToolsBtn').addEventListener('click', () => openCardActions());
  studyCard.addEventListener('pointerenter', () => {
    cardPointerRect = studyCard.getBoundingClientRect();
    studyCard.classList.add('is-pointer-tracking');
  });
  studyCard.addEventListener('pointermove', event => {
    const samples = event.getCoalescedEvents?.() || [event];
    const latest = samples[samples.length - 1] || event;
    pendingCardPointer = { x: latest.clientX, y: latest.clientY };
    if (!cardPointerFrame) cardPointerFrame = requestAnimationFrame(renderCardPointer);
  }, { passive: true });
  studyCard.addEventListener('pointerleave', () => {
    if (cardPointerFrame) cancelAnimationFrame(cardPointerFrame);
    cardPointerFrame = 0;
    pendingCardPointer = null;
    cardPointerRect = null;
    studyCard.classList.remove('is-pointer-tracking');
    studyCard.style.setProperty('--ry', '0deg');
    studyCard.style.setProperty('--rx', '0deg');
    studyCard.style.setProperty('--glare-angle', '112deg');
    studyCard.style.setProperty('--glare-strength', '.56');
    studyCard.style.setProperty('--scene-x', '0px');
    studyCard.style.setProperty('--scene-y', '0px');
    studyCard.style.setProperty('--scene-ry', '0deg');
    studyCard.style.setProperty('--scene-rx', '0deg');
    studyCard.style.setProperty('--word-x', '0px');
    studyCard.style.setProperty('--word-y', '0px');
    studyCard.style.setProperty('--word-rx', '0deg');
    studyCard.style.setProperty('--word-ry', '0deg');
    studyCard.style.setProperty('--word-shadow-x', '0px');
    studyCard.style.setProperty('--word-shadow-y', '0px');
  });
  $('#memoryMapBtn').addEventListener('click', event => {
    event.stopPropagation();
    const word = studyQueue[currentStudyIndex];
    route('memory', { wordId: word?.id });
  });
  ['keywordLinkPanel', 'scenePanel', 'keywordScenePanel'].forEach(id => {
    const panel = $('#' + id);
    if (!panel) return;
    panel.addEventListener('click', () => revealStudyPanel(panel));
    panel.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      revealStudyPanel(panel);
    });
  });
  $('#speakBtn').addEventListener('click', () => studyQueue[currentStudyIndex] && speak(studyQueue[currentStudyIndex].word));
  $('#relatedCloud').addEventListener('click', event => {
    const button = event.target.closest('[data-related-speak]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    speak(button.dataset.relatedSpeak);
  });
  $('#memoryResetBtn').addEventListener('click', resetMemoryCamera);
  $('#memoryZoomOutBtn').addEventListener('click', () => changeMemoryZoom(.86));
  $('#memoryZoomInBtn').addEventListener('click', () => changeMemoryZoom(1.16));
  $('#memoryFitBtn').addEventListener('click', resetMemoryCamera);
  $('#memoryRotateBtn').addEventListener('click', () => {
    memoryGraph.autoRotate = !memoryGraph.autoRotate;
    updateMemoryGraphHud();
  });
  $('#memoryFocusModeBtn').addEventListener('click', () => {
    memoryGraph.onlyStrong = !memoryGraph.onlyStrong;
    memoryGraph.hovered = null;
    hideMemoryHoverCard();
    updateMemoryGraphHud();
  });
  $('#memoryBackBtn').addEventListener('click', goBackMemoryWord);
  $('#memorySpeakBtn').addEventListener('click', () => memoryGraph.focusWord && speak(memoryGraph.focusWord.word));
  $('#memoryFocusLinks').addEventListener('click', event => {
    const button = event.target.closest('[data-memory-word-id]');
    if (!button) return;
    focusMemoryWord(words.find(word => word.id === button.dataset.memoryWordId));
  });
  $('#memorySearch').addEventListener('input', event => renderMemorySearchResults(event.currentTarget.value));
  $('#memorySearch').addEventListener('focus', event => {
    if (event.currentTarget.value.trim()) renderMemorySearchResults(event.currentTarget.value);
  });
  $('#memorySearch').addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); updateMemorySearchSelection(memoryGraph.searchIndex + 1); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); updateMemorySearchSelection(memoryGraph.searchIndex - 1); return; }
    if (event.key === 'Escape') { hideMemorySearchResults(); event.currentTarget.blur(); return; }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!memoryGraph.searchResults.length) renderMemorySearchResults(event.currentTarget.value);
    chooseMemorySearchResult();
  });
  $('#memorySearchResults').addEventListener('click', event => {
    const button = event.target.closest('[data-memory-search-id]');
    if (!button) return;
    chooseMemorySearchResult(words.find(word => word.id === button.dataset.memorySearchId));
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.memory-search-shell')) hideMemorySearchResults(); });
  $('#memoryStudyBtn').addEventListener('click', () => {
    const word = memoryGraph.focusWord;
    if (word) route('study', { deckId: word.deckId, wordId: word.id });
  });
  bindMemoryInteractions();
  $$('.rating-button').forEach(button => button.addEventListener('click', () => rateCard(button.dataset.rating)));
  $('#cardSuspendBtn').addEventListener('click', () => {
    const word = wordById(currentCardActionWordId);
    if (!word) return;
    const flag = state.cardFlags[word.id] || {};
    flag.suspended = !flag.suspended;
    flag.updatedAt = new Date().toISOString();
    state.cardFlags[word.id] = flag;
    const isCurrent = studyQueue[currentStudyIndex]?.id === word.id;
    if (flag.suspended && isCurrent) {
      const beforeLength = studyQueue.length;
      studyQueue = studyQueue.filter((item, index) => index < currentStudyIndex || item.id !== word.id);
      const removed = beforeLength - studyQueue.length;
      initialQueueSize = Math.max(currentStudyIndex, initialQueueSize - removed);
      lastRatingUndo = null;
      saveCurrentStudySession();
    }
    persist();
    closeModals();
    if (isCurrent && flag.suspended) showCurrentCard();
    if (currentRoute === 'library') renderLibrary();
    toast(flag.suspended ? `已暂停「${word.word}」，不会再进入学习队列` : `已恢复「${word.word}」的学习`);
  });
  $('#cardPostponeBtn').addEventListener('click', () => {
    const word = studyQueue[currentStudyIndex];
    if (!word || word.id !== currentCardActionWordId || studyQueue.length - currentStudyIndex <= 1) return;
    studyQueue.splice(currentStudyIndex, 1);
    studyQueue.push(word);
    lastRatingUndo = null;
    saveCurrentStudySession();
    closeModals();
    showCurrentCard();
    toast(`已把「${word.word}」移到今天稍后`);
  });
  $('#cardEditBtn').addEventListener('click', () => {
    const wordId = currentCardActionWordId;
    closeModals();
    setTimeout(() => openWordEditor(wordId), 0);
  });
  $('#cardIssueSaveBtn').addEventListener('click', () => {
    const word = wordById(currentCardActionWordId);
    if (!word) return;
    const type = $('#cardIssueType').value;
    const note = $('#cardIssueNote').value.trim();
    state.cardIssues.push({
      id: `issue-${Date.now()}`,
      wordId: word.id,
      word: word.word,
      type,
      note,
      status: 'open',
      createdAt: new Date().toISOString()
    });
    persist();
    $('#cardIssueNote').value = '';
    toast(`已记录「${word.word}」的内容问题`);
    openCardActions(word.id);
  });
  ['#weakReviewBtn', '#weakReviewInlineBtn'].forEach(id => $(id)?.addEventListener('click', startWeakStudy));
  $('#applyFsrsOptimizationBtn').addEventListener('click', applyFsrsOptimization);
  $('#themeBtn').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    document.body.classList.toggle('dark', state.settings.theme === 'dark'); persist();
  });
  $('#nextTipBtn').addEventListener('click', () => {
    const current = memoryTips.indexOf($('#memoryTip').textContent);
    $('#memoryTip').textContent = memoryTips[(current + 1) % memoryTips.length];
  });
  $('#wordSearch').addEventListener('input', () => { libraryPage = 0; renderLibrary(); });
  $$('#libraryFilters button').forEach(button => button.addEventListener('click', () => {
    libraryFilter = button.dataset.filter;
    $$('#libraryFilters button').forEach(item => item.classList.toggle('active', item === button)); libraryPage = 0; renderLibrary();
  }));
  $('#studySelectedDeck').addEventListener('click', () => route('study', { deckId: selectedDeck }));
  ['#importBtn', '#quickImportBtn'].forEach(id => $(id).addEventListener('click', () => { renderImportTargets(); openModal('#importModal'); }));
  $('#importTargetDeck').addEventListener('change', event => { $('#importNewDeckNameRow').hidden = event.currentTarget.value !== 'new'; });
  ['#newDeckBtn', '#guideNewDeckBtn'].forEach(id => $(id).addEventListener('click', () => {
    $('#newDeckNameInput').value = '';
    $('#newDeckDescInput').value = '';
    openModal('#newDeckModal');
  }));
  $('#dismissLibraryGuideBtn').addEventListener('click', () => { state.settings.libraryOnboardingSeen = true; persist(); renderLibraryGuide(); });
  $('#addWordBtn').addEventListener('click', () => openNewWordEditor(selectedDeck));
  $('#exportDeckBtn').addEventListener('click', exportSelectedDeck);
  $('#issueCenterBtn').addEventListener('click', openIssueCenter);
  $$('#issueFilters button').forEach(button => button.addEventListener('click', () => { currentIssueFilter = button.dataset.issueFilter; renderIssueCenter(); }));
  $('#createDeckBtn').addEventListener('click', () => {
    const name = $('#newDeckNameInput').value.trim();
    if (!name) return toast('请输入词库名称');
    if (state.customDecks.some(deck => deck.name.toLowerCase() === name.toLowerCase())) return toast('已经存在同名词库');
    const id = `deck-${Date.now()}`;
    const deck = { id, name, short: name, desc: $('#newDeckDescInput').value.trim() || '自定义词库', color: '#2a9fa5', icon: '自', tier: null };
    state.customDecks.push(deck);
    state.settings.libraryOnboardingSeen = true;
    selectedDeck = id;
    state.selectedDeck = id;
    persist();
    closeModals();
    route('library');
    setTimeout(() => openNewWordEditor(id), 0);
  });
  $('#settingsBtn').addEventListener('click', async () => {
    syncLimitControl($('#dailyNewMode'), $('#dailyNewInput'), state.settings.dailyNew);
    syncLimitControl($('#dailyReviewMode'), $('#dailyReviewInput'), state.settings.dailyReview);
    $('#workloadProtectionInput').checked = state.settings.workloadProtection !== false;
    $('#dailyStudyMinutesInput').value = String(state.settings.dailyStudyMinutes || 45);
    $('#performanceModeInput').value = state.settings.performanceMode || 'auto';
    $('#autoSpeakInput').checked = state.settings.autoSpeak;
    $('#restReminderEnabledInput').checked = state.settings.restReminderEnabled !== false;
    $('#restReminderMinutesInput').value = String(state.settings.restReminderMinutes || 25);
    $('#zoomInput').value = String(state.settings.zoom || 'auto');
    $('#desiredRetentionInput').value = String(state.settings.desiredRetention || .9);
    $('#maximumIntervalInput').value = String(state.settings.maximumInterval || 36500);
    $('#examDateInput').value = state.settings.examDate || '';
    $('#examDateInput').min = todayKey();
    updateExamPlanPreview();
    renderBackupList();
    renderBackupLocation();
    loadIntegrationSettings();
    openModal('#settingsModal');
  });
  function syncLimitControl(modeSelect, input, value) {
    const presets = new Set([...modeSelect.options].map(option => option.value).filter(v => v !== 'custom' && v !== 'unlimited'));
    if (value === -1 || value === Infinity) {
      modeSelect.value = 'unlimited';
      input.style.display = 'none';
    } else if (presets.has(String(value))) {
      modeSelect.value = String(value);
      input.style.display = 'none';
    } else {
      modeSelect.value = 'custom';
      input.value = value;
      input.style.display = '';
    }
  }
  function readLimitValue(modeSelect, input) {
    const mode = modeSelect.value;
    if (mode === 'unlimited') return -1;
    if (mode === 'custom') return Math.max(1, Math.min(1000, Math.round(Number(input.value) || 20)));
    return Number(mode);
  }
  $('#dailyNewMode').addEventListener('change', () => {
    $('#dailyNewInput').style.display = $('#dailyNewMode').value === 'custom' ? '' : 'none';
  });
  $('#dailyReviewMode').addEventListener('change', () => {
    $('#dailyReviewInput').style.display = $('#dailyReviewMode').value === 'custom' ? '' : 'none';
  });
  $('#examDateInput').addEventListener('input', updateExamPlanPreview);
  $('#applyExamPlanBtn').addEventListener('click', () => {
    const plan = updateExamPlanPreview();
    if (!plan?.recommended) return;
    syncLimitControl($('#dailyNewMode'), $('#dailyNewInput'), plan.recommended);
    toast(`已将每日新词调整为 ${plan.recommended} 个，保存设置后生效`);
  });
  $$('.modal-close').forEach(button => button.addEventListener('click', closeModals));
  $$('.modal-backdrop').forEach(modal => modal.addEventListener('mousedown', event => { if (event.target === modal) closeModals(); }));
  $('#saveDeckNameBtn').addEventListener('click', () => {
    const deck = state.customDecks.find(item => item.id === editingDeckId);
    const name = $('#deckNameInput').value.trim();
    if (!deck || !name) return toast('请输入词库名称');
    if (state.customDecks.some(item => item.id !== deck.id && item.name.toLowerCase() === name.toLowerCase())) return toast('已经存在同名词库');
    deck.name = name;
    deck.short = name;
    persist();
    closeModals();
    renderLibrary();
    toast('词库名称已更新');
  });
  $('#deleteDeckBtn').addEventListener('click', async () => {
    const deck = state.customDecks.find(item => item.id === editingDeckId);
    if (!deck || !confirm(`确定删除词库「${deck.name}」及其中所有单词吗？此操作会先自动备份。`)) return;
    if (!await window.englishAnki.backupData()) return toast('备份失败，已取消删除词库');
    const ids = state.customWords.filter(word => word.deckId === deck.id).map(word => word.id);
    state.customWords = state.customWords.filter(word => word.deckId !== deck.id);
    state.customDecks = state.customDecks.filter(item => item.id !== deck.id);
    removeLearningDataForWordIds(ids);
    selectedDeck = 'hebei-3000';
    state.selectedDeck = selectedDeck;
    persist();
    closeModals();
    renderLibrary();
    renderStats();
    toast(`已删除词库「${deck.name}」`);
  });
  $('#saveWordBtn').addEventListener('click', () => {
    const customWord = state.customWords.find(item => item.id === editingWordId);
    const raw = rawWordById(editingWordId);
    const nextWord = $('#editWord_word').value.trim();
    const meaning = $('#editWord_meaning').value.trim();
    if (!nextWord || !meaning) return toast('单词和中文释义不能为空');
    const targetDeckId = $('#editWord_deck').value;
    if (editingWordIsNew) {
      const deck = state.customDecks.find(item => item.id === targetDeckId);
      if (!deck) return toast('请选择一个自定义词库');
      const duplicate = state.customWords.some(item => item.deckId === deck.id && item.word.trim().toLowerCase() === nextWord.toLowerCase());
      if (duplicate) return toast('这个词库中已经有相同单词');
      const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const created = { id, deckId: deck.id, tierName: '自定义', number: wordsForDeck(deck.id).length + 1 };
      ['word', 'phonetic', 'pos', 'meaning', 'example', 'zh', 'memory'].forEach(field => created[field] = $(`#editWord_${field}`).value.trim());
      state.customWords.push(created);
      editingWordId = id;
      selectedDeck = deck.id;
      state.selectedDeck = deck.id;
      state.settings.libraryOnboardingSeen = true;
    } else if (customWord) {
      const duplicate = state.customWords.some(item => item.id !== customWord.id && item.deckId === targetDeckId && item.word.trim().toLowerCase() === nextWord.toLowerCase());
      if (duplicate) return toast('这个词库中已经有相同单词');
      customWord.deckId = targetDeckId;
      ['word', 'phonetic', 'pos', 'meaning', 'example', 'zh', 'memory'].forEach(field => customWord[field] = $(`#editWord_${field}`).value.trim());
    } else {
      if (!raw) return;
      const story = memoryStories.get(editingWordId);
      const defaults = {
        phonetic: raw.phonetic || '',
        pos: raw.pos || '',
        meaning: raw.meaning || '',
        example: story?.sentence || raw.example || '',
        zh: raw.zh || '',
        memory: story?.review?.reason || raw.memory || ''
      };
      const override = {};
      Object.keys(defaults).forEach(field => {
        const value = $(`#editWord_${field}`).value.trim();
        if (value !== defaults[field]) override[field] = value;
      });
      if (Object.keys(override).length) state.wordOverrides[editingWordId] = override;
      else delete state.wordOverrides[editingWordId];
    }
    persist();
    relatedVocabularyIndex = null;
    relatedWordCache.clear();
    closeModals();
    if (currentRoute === 'library') renderLibrary();
    if (currentRoute === 'study' && studyQueue[currentStudyIndex]?.id === editingWordId) {
      const refreshed = wordById(editingWordId);
      if (refreshed) studyQueue[currentStudyIndex] = refreshed;
      showCurrentCard();
    }
    toast(editingWordIsNew ? '单词已添加到自定义词库' : '单词卡已更新');
    editingWordIsNew = false;
  });
  $('#deleteWordBtn').addEventListener('click', async () => {
    const word = state.customWords.find(item => item.id === editingWordId);
    if (editingWordIsBuiltin) {
      const builtin = words.find(item => item.id === editingWordId);
      if (!builtin || !confirm(`确定恢复「${builtin.word}」的内置原文吗？你的评分记录不会删除。`)) return;
      delete state.wordOverrides[editingWordId];
      persist();
      relatedVocabularyIndex = null;
      relatedWordCache.clear();
      closeModals();
      if (currentRoute === 'library') renderLibrary();
      if (currentRoute === 'study' && studyQueue[currentStudyIndex]?.id === editingWordId) {
        const refreshed = wordById(editingWordId);
        if (refreshed) studyQueue[currentStudyIndex] = refreshed;
        showCurrentCard();
      }
      toast(`已恢复「${builtin.word}」的内置原文`);
      return;
    }
    if (!word || !confirm(`确定删除单词「${word.word}」及其学习记录吗？此操作会先自动备份。`)) return;
    if (!await window.englishAnki.backupData()) return toast('备份失败，已取消删除单词');
    state.customWords = state.customWords.filter(item => item.id !== word.id);
    removeLearningDataForWordIds([word.id]);
    persist();
    relatedVocabularyIndex = null;
    relatedWordCache.clear();
    closeModals();
    renderLibrary();
    renderStats();
    toast(`已删除单词「${word.word}」`);
  });
  $('#fileInput').addEventListener('change', event => event.target.files[0] && importFile(event.target.files[0]));
  const zone = $('#dropZone');
  ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', event => event.dataTransfer.files[0] && importFile(event.dataTransfer.files[0]));
  $('#downloadTemplate').addEventListener('click', downloadTemplate);
  $('#saveSettingsBtn').addEventListener('click', async () => {
    state.settings.dailyNew = readLimitValue($('#dailyNewMode'), $('#dailyNewInput'));
    state.settings.dailyReview = readLimitValue($('#dailyReviewMode'), $('#dailyReviewInput'));
    state.settings.workloadProtection = $('#workloadProtectionInput').checked;
    state.settings.dailyStudyMinutes = Math.max(15, Math.min(240, Math.round(Number($('#dailyStudyMinutesInput').value) || 45)));
    state.settings.performanceMode = ['auto', 'full', 'smooth'].includes($('#performanceModeInput').value) ? $('#performanceModeInput').value : 'auto';
    state.settings.autoSpeak = $('#autoSpeakInput').checked;
    state.settings.restReminderEnabled = $('#restReminderEnabledInput').checked;
    state.settings.restReminderMinutes = Math.max(10, Math.min(90, Math.round(Number($('#restReminderMinutesInput').value) || 25)));
    state.settings.zoom = $('#zoomInput').value;
    state.settings.desiredRetention = Math.max(.7, Math.min(.99, Number($('#desiredRetentionInput').value) || .9));
    state.settings.maximumInterval = Math.max(7, Math.min(36500, Math.round(Number($('#maximumIntervalInput').value) || 36500)));
    const examPlan = examStudyPlan($('#examDateInput').value);
    state.settings.examDate = examPlan?.expired ? '' : $('#examDateInput').value;
    try {
      await window.englishAnki.setSyncAuto($('#syncAutoInput').checked);
      await window.englishAnki.setUpdatePreferences({ source: $('#updateSourceInput').value.trim(), auto: $('#autoUpdateCheckInput').checked });
    } catch (error) {
      return toast(`设置未保存：${error.message}`);
    }
    applyPerformanceMode(true);
    const appliedZoom = applyZoom();
    const requestedZoom = Number(state.settings.zoom);
    const zoomLimited = Number.isFinite(requestedZoom) && requestedZoom > appliedZoom + .01;
    keywordFamiliarityCache.clear();
    persist(); closeModals(); renderHome();
    if (currentRoute === 'stats') renderStats();
    toast(zoomLimited ? `学习设置已保存；当前窗口下缩放限制为 ${Math.round(appliedZoom * 100)}%` : '学习设置已保存');
  });
  let resetArmed = false;
  let resetArmTimer = 0;
  $('#resetDataBtn').addEventListener('click', async () => {
    if (!resetArmed) {
      resetArmed = true;
      const button = $('#resetDataBtn');
      button.textContent = '再点一次确认清除（不可恢复）';
      button.classList.add('danger-armed');
      clearTimeout(resetArmTimer);
      resetArmTimer = setTimeout(() => {
        resetArmed = false;
        button.textContent = '清除学习记录并恢复示例词库';
        button.classList.remove('danger-armed');
      }, 4000);
      return;
    }
    resetArmed = false;
    clearTimeout(resetArmTimer);
    const button = $('#resetDataBtn');
    button.textContent = '清除学习记录并恢复示例词库';
    button.classList.remove('danger-armed');
    if (!await window.englishAnki.backupData()) return toast('备份失败，已取消清除学习记录');
    const settings = state.settings;
    state = { ...defaultState(), settings };
    selectedDeck = 'hebei-3000';
    state.selectedDeck = selectedDeck;
    relatedVocabularyIndex = null;
    relatedWordCache.clear();
    keywordFamiliarityCache.clear();
    resetStudySessionState();
    persist(); closeModals(); refreshDataViews();
    toast('学习记录已清除（已先自动备份）');
  });
  $('#exportBtn').addEventListener('click', async () => { if (await window.englishAnki.exportData(state)) toast('学习记录已导出'); });
  $('#importDataBtn').addEventListener('click', () => $('#importDataInput').click());
  $('#importDataInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const data = JSON.parse(text);
      if (!validImportedLearningData(data)) {
        toast(data?.format === 'english-anki-backup-v2'
          ? '这是备份文件，请到设置中的备份列表恢复'
          : '导入失败：文件不是有效的学习记录');
        return;
      }
      if (!confirm('导入将覆盖当前学习记录，是否继续？（建议先手动备份）')) return;
      if (!await window.englishAnki.backupData()) return toast('备份失败，已取消导入');
      state = normalizeState(data);
      selectedDeck = state.selectedDeck || 'hebei-3000';
      relatedVocabularyIndex = null;
      relatedWordCache.clear();
      keywordFamiliarityCache.clear();
      resetStudySessionState();
      persist();
      document.body.classList.toggle('dark', state.settings.theme === 'dark');
      applyPerformanceMode();
      applyZoom();
      closeModals();
      refreshDataViews();
      toast('学习记录已导入');
    } catch {
      toast('导入失败：无法读取该文件');
    }
  });
  $('#backupNowBtn').addEventListener('click', async () => {
    const ok = await window.englishAnki.backupData();
    toast(ok ? '已备份当前学习记录' : '备份失败');
    renderBackupList();
  });
  $('#chooseBackupDirBtn').addEventListener('click', async () => {
    const location = await window.englishAnki.chooseBackupDirectory();
    if (!location) return;
    await renderBackupLocation();
    await renderBackupList();
    toast(location.created ? '备份目录已更新，并已在新目录生成一份备份' : '备份目录已更新，但备份失败');
  });
  $('#resetBackupDirBtn').addEventListener('click', async () => {
    const location = await window.englishAnki.resetBackupDirectory();
    if (!location) return;
    await renderBackupLocation();
    await renderBackupList();
    toast(location.created ? '已恢复默认备份目录' : '已恢复默认备份目录，但备份失败');
  });
  $('#chooseSyncDirBtn').addEventListener('click', async () => {
    const status = await window.englishAnki.chooseSyncDirectory();
    if (!status) return;
    await renderSyncStatus(status);
    toast('同步目录已配置，请选择上传本机或使用云端数据');
  });
  $('#resetSyncDirBtn').addEventListener('click', async () => {
    const status = await window.englishAnki.resetSyncDirectory();
    await renderSyncStatus(status);
    toast('已停用文件夹同步，云端文件不会被删除');
  });
  $('#syncPushBtn').addEventListener('click', async () => {
    const status = await window.englishAnki.syncStatus();
    if ((status.state === 'conflict' || status.state === 'remote-newer') && !confirm('上传本机数据会覆盖云端同步文件。当前本机数据会保留备份，是否继续？')) return;
    if (!await window.englishAnki.backupData()) return toast('备份失败，已取消上传');
    const result = await window.englishAnki.pushSyncData();
    await renderSyncStatus(result);
    toast(result.ok ? '本机学习数据已上传到同步目录' : '上传失败，请检查同步目录');
  });
  $('#syncPullBtn').addEventListener('click', async () => {
    if (!confirm('将使用云端学习数据替换本机当前记录。本机数据会先自动备份，是否继续？')) return;
    const result = await window.englishAnki.pullSyncData();
    if (result.ok) applyPulledSyncData(result);
    await renderSyncStatus(result);
    toast(result.ok ? '已使用云端学习数据' : '拉取失败：云端文件无效或不可读取');
  });
  $('#syncNowBtn').addEventListener('click', async () => {
    const result = await window.englishAnki.autoSyncData();
    if (result.action === 'pulled') applyPulledSyncData(result);
    await renderSyncStatus(result);
    const messages = { pushed: '本机新进度已同步', pulled: '云端新进度已同步到本机', none: '本机与云端已经一致', conflict: '检测到冲突，请选择保留本机或云端', invalid: '云端文件校验失败，未执行同步' };
    toast(messages[result.action] || (result.ok ? '同步检查完成' : '同步需要你处理'));
  });
  $('#checkUpdateBtn').addEventListener('click', async () => {
    $('#updateStatusCopy').textContent = '正在检查更新…';
    try {
      await window.englishAnki.setUpdatePreferences({ source: $('#updateSourceInput').value.trim(), auto: $('#autoUpdateCheckInput').checked });
      const result = await window.englishAnki.checkForUpdates();
      renderUpdateStatus(result);
    } catch (error) {
      renderUpdateStatus({ ok: false, currentVersion: $('#currentVersionLabel').textContent, error: error.message });
    }
  });
  $('#openUpdateBtn').addEventListener('click', () => pendingUpdateResult?.downloadUrl && window.englishAnki.openUpdateDownload(pendingUpdateResult.downloadUrl));
  $('#continueStudyBtn').addEventListener('click', () => { lastRestPromptAt = Date.now(); closeModals(); saveCurrentStudySession(); });
  $('#breakFiveBtn').addEventListener('click', () => startBreak(5));
  $('#breakTenBtn').addEventListener('click', () => startBreak(10));
  $('#endBreakBtn').addEventListener('click', endBreak);
  $('#resumeContinueBtn').addEventListener('click', () => {
    if (!resumePending) return;
    const { session, deck, queue } = resumePending;
    resumePending = null;
    closeModals();
    selectedDeck = deck;
    state.selectedDeck = deck;
    studyQueue = queue;
    studyQueueKinds = new Map(queue.map(item => [item.id, state.cards[item.id]?.reps ? 'review' : 'new']));
    currentStudyIndex = session.index;
    initialQueueSize = queue.length;
    currentStudyMode = session.mode || 'normal';
    currentStudyLabel = session.label || '';
    lastRatingUndo = null;
    studySessionStartedAt = Number(session.sessionStartedAt) || Date.now();
    lastRestPromptAt = Number(session.lastRestPromptAt) || studySessionStartedAt;
    $('#studyDeckLabel').textContent = currentStudyLabel || deckFor(deck).name;
    showCurrentCard();
    persist();
  });
  $('#undoRatingBtn').addEventListener('click', undoLastRating);
  $('#resumeRestartBtn').addEventListener('click', () => {
    const { deck, wordId } = resumePending || {};
    resumePending = null;
    closeModals();
    window.englishAnki.clearStudySession();
    startStudy(deck || selectedDeck, wordId);
  });
  $('#resumeCloseBtn').addEventListener('click', () => {
    const { deck, wordId } = resumePending || {};
    resumePending = null;
    window.englishAnki.clearStudySession();
    startStudy(deck || selectedDeck, wordId);
  });
  $('#minimizeBtn').addEventListener('click', window.englishAnki.window.minimize);
  $('#maximizeBtn').addEventListener('click', window.englishAnki.window.maximize);
  $('#closeBtn').addEventListener('click', window.englishAnki.window.close);
  document.addEventListener('keydown', event => {
    const openDialog = $('.modal-backdrop.open');
    if (openDialog && event.key === 'Tab') {
      const focusable = $$('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]', openDialog).filter(element => element.offsetParent !== null);
      if (focusable.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    if (event.key === 'Escape') { if (openDialog) { event.preventDefault(); closeModals(); return; } if (currentRoute === 'study' || currentRoute === 'memory') route('home'); }
    if (openDialog) return;
    if (currentRoute !== 'study' || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undoLastRating(); return; }
    if (event.code === 'Space') {
      const active = document.activeElement;
      const nativeSpace = !!active && (/BUTTON|A|SELECT|INPUT|TEXTAREA/.test(active.tagName) || active.getAttribute('role') === 'button');
      if (!nativeSpace || active.disabled) {
        event.preventDefault();
        advanceReveal();
      }
    }
    if (event.key.toLowerCase() === 'v') { const word = studyQueue[currentStudyIndex]; if (word) speak(word.word); }
    const ratings = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
    if (ratings[event.key]) rateCard(ratings[event.key]);
  });
}

async function init() {
  const [builtinWords, releasePayload, storyPayload, overridePayload] = await Promise.all([
    window.englishAnki.loadBuiltinWords(),
    window.englishAnki.loadMemoryRelease(),
    window.englishAnki.loadMemoryStories(),
    window.englishAnki.loadMemoryStoryOverrides()
  ]);
  releaseInfo = releasePayload || {};
  // 词库不再按审核数量截断：3000 词全部可查看，
  // 未配插画的卡片由 story-image-error 占位降级展示。
  words = builtinWords;
  deckDefinitions[0] = {
    ...deckDefinitions[0],
    name: releaseInfo.title || deckDefinitions[0].name,
    short: releaseInfo.shortTitle || deckDefinitions[0].short,
    desc: releaseInfo.description || deckDefinitions[0].desc
  };
  const baseStories = new Map((storyPayload?.cards || []).map(story => [story.id, story]));
  const overrides = new Map((overridePayload?.cards || []).map(story => [story.id, story]));
  memoryStories = new Map(words.map(sourceWord => {
    const story = baseStories.get(sourceWord.id) || {};
    const override = overrides.get(sourceWord.id) || {};
    if (!story.anchor && !override.anchor) return null;
    if (!story.sentence && !override.sentence) return null;
    const merged = {
      ...sourceWord,
      ...story,
      ...override,
      scene: { ...(story.scene || {}), ...(override.scene || {}) },
      review: { ...(story.review || {}), ...(override.review || {}) }
    };
    // The 河北 3000-word list is the canonical index and spelling source.
    merged.id = sourceWord.id;
    merged.word = sourceWord.word;
    return [merged.id, merged];
  }).filter(Boolean));
  const loadedState = await window.englishAnki.loadData();
  state = normalizeState(loadedState);
  try {
    const corruptBackup = await window.englishAnki.dataCorruption?.();
    if (corruptBackup) setTimeout(() => toast(`检测到损坏的学习数据，原文件已保留为 ${corruptBackup}`), 900);
  } catch {}
  try {
    const syncResult = await window.englishAnki.autoSyncData();
    if (syncResult?.data) state = normalizeState(syncResult.data);
    if (syncResult?.action === 'conflict') setTimeout(() => toast('云端与本机数据都已变化，请到设置中选择保留哪一份'), 700);
  } catch {}
  selectedDeck = state.selectedDeck || 'hebei-3000';
  window.englishAnki.onBeforeClose?.(() => {
    clearTimeout(saveTimer);
    Promise.resolve(window.englishAnki.saveData(state))
      .catch(() => {})
      .finally(() => window.englishAnki.confirmClose());
  });
  applyZoom();
  let zoomResizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(zoomResizeFrame);
    zoomResizeFrame = requestAnimationFrame(applyZoom);
  });
  document.body.classList.toggle('dark', state.settings.theme === 'dark');
  applyPerformanceMode();
  bindEvents();
  renderHome();
  if (!loadedState || loadedState.version !== 4) persist(false);
  try {
    const update = await window.englishAnki.updateStatus();
    if (update?.result?.available) setTimeout(() => toast(`发现新版本 ${update.result.version}，可在设置中查看`), 1000);
  } catch {}
}

init().catch(error => {
  console.error(error);
  document.body.innerHTML = `<div style="padding:50px;font-family:sans-serif"><h2>应用启动失败</h2><p>${escapeHtml(error.message)}</p></div>`;
});

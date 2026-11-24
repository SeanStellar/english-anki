import { fsrs, generatorParameters, Rating, createEmptyCard } from 'ts-fsrs';

const defaultFsrsWeights = generatorParameters().w.slice();
const schedulerCache = new Map();

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

export function createFsrsApi() {
  return {
    defaultFsrsWeights: defaultFsrsWeights.slice(),
    createCard: () => createEmptyCard(new Date()),
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
    }
  };
}
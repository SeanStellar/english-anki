const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadFunctions } = require('./load-renderer-functions.cjs');
function scenario({ cards = {}, words = [], logs = [], settings = {} } = {}) {
  const state = { cards, settings: { dailyNew: 20, dailyReview: -1, workloadProtection: false, dailyStudyMinutes: 45, ...settings } };
  const api = loadFunctions(['dueReviewWords', 'newWords', 'planFor', 'describeEmptyStudy'], {
    state, defaultDeckId: () => 'main', wordsForDeck: deck => words.filter(w => w.deck === deck),
    wordIsAvailable: word => !word.suspended, todayLogs: () => logs,
    personalStudyPace: () => ({ newSeconds: 28, reviewSeconds: 10, againRate: 0, sampleSize: 0 })
  });
  return { api, state };
}
const past = () => new Date(Date.now() - 120000).toISOString();
const future = () => new Date(Date.now() + 120000).toISOString();
const word = (id, deck = 'main', suspended = false) => ({ id, deck, suspended, number: id.charCodeAt(0) });
test('same-day due relearning returns even if review quota is exhausted', () => {
  const x = scenario({ words: [word('a'), word('b')], cards: { a: { reps: 1, due: past() }, b: { reps: 2, due: past() } }, logs: [{ wordId: 'a', isNew: false }], settings: { dailyReview: 1 } });
  const plan = x.api.planFor('main');
  assert.deepEqual(Array.from(plan.reviews, w => w.id), ['a']);
  assert.equal(plan.meta.repeatDue, 1); assert.equal(plan.meta.reviewDeferred, 1);
});
test('future cards remain excluded, unrelated words and suspended cards never enter the deck', () => {
  const x = scenario({ words: [word('a'), word('b', 'other'), word('c', 'main', true), word('d')], cards: { a: { reps: 1, due: future() }, b: { reps: 1, due: past() }, c: { reps: 1, due: past() }, d: { reps: 2, due: past() } }, logs: [{ wordId: 'a', isNew: true }] });
  assert.deepEqual(Array.from(x.api.planFor('main').queue, w => w.id), ['d']);
});
test('today newly learned due again bypasses exhausted review limit without duplicating cards', () => {
  const x = scenario({ words: [word('a')], cards: { a: { reps: 1, due: past() } }, logs: [{ wordId: 'a', isNew: true }], settings: { dailyReview: 0 } });
  assert.deepEqual(Array.from(x.api.planFor('main').queue, w => w.id), ['a']);
});
test('daily new and review limits still apply globally across decks', () => {
  const x = scenario({ words: [word('a'), word('b')], cards: { a: { reps: 1, due: past() } }, logs: [{ wordId: 'elsewhere', isNew: true }, { wordId: 'other-review', isNew: false }], settings: { dailyNew: 1, dailyReview: 1 } });
  const p = x.api.planFor('main'); assert.equal(p.queue.length, 0); assert.equal(p.meta.reviewDeferred, 1); assert.equal(p.meta.newQuotaDeferred, 1);
  const text = x.api.describeEmptyStudy(p, 0); assert.match(text.title, /没有安排/); assert.match(text.detail, /复习上限/); assert.match(text.detail, /新词上限/);
});
test('empty messages distinguish no due cards from a completed session and workload protection', () => {
  const x = scenario({ words: [word('a')], settings: { dailyNew: 20, workloadProtection: true, dailyStudyMinutes: 15 }, logs: [{ wordId:'old', isNew:false, elapsedMs: 900000 }] });
  const p=x.api.planFor('main');assert.equal(p.queue.length,0);assert.match(x.api.describeEmptyStudy(p,0).detail,/负荷保护/);
  const y=scenario();assert.match(y.api.describeEmptyStudy(y.api.planFor('main'),0).title,/没有安排/);assert.match(y.api.describeEmptyStudy(y.api.planFor('main'),2).title,/本轮学习完成/);
});

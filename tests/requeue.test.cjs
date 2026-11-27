const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fsrs, generatorParameters, Rating, createEmptyCard } = require('ts-fsrs');
const { loadFunctions } = require('./load-renderer-functions.cjs');

const api = loadFunctions(['requeueOffsetForRating']);
const offset = (rating, card) => api.requeueOffsetForRating(rating, card);
const scheduler = fsrs(generatorParameters({ enable_short_term: true, enable_fuzz: false }));
const start = new Date('2026-11-27T10:00:00Z');
const newCardRatings = scheduler.repeat(createEmptyCard(start), start);

test('new card ratings place the card back inside the session queue', () => {
  assert.equal(offset('again', newCardRatings[Rating.Again].card), 4);
  assert.equal(offset('hard', newCardRatings[Rating.Hard].card), 7);
  assert.equal(offset('good', newCardRatings[Rating.Good].card), 10);
  assert.equal(offset('easy', newCardRatings[Rating.Easy].card), 0);
});

test('hard on a learning card after several again ratings still requeues (regression)', () => {
  let card = createEmptyCard(start);
  let at = start;
  for (let index = 0; index < 3; index += 1) {
    card = scheduler.repeat(card, at)[Rating.Again].card;
    at = new Date(card.due);
  }
  assert.ok(card.reps > 0, 'card no longer counts as new');
  const hard = scheduler.repeat(card, at)[Rating.Hard].card;
  assert.equal(hard.scheduled_days, 0);
  assert.equal(offset('hard', hard), 7);
});

test('review cards leave the session queue on hard, good and easy', () => {
  let card = createEmptyCard(start);
  let at = start;
  card = scheduler.repeat(card, at)[Rating.Good].card;
  at = new Date(card.due);
  card = scheduler.repeat(card, at)[Rating.Good].card;
  at = new Date(card.due);
  const ratings = scheduler.repeat(card, at);
  assert.ok(ratings[Rating.Hard].card.scheduled_days > 0);
  assert.equal(offset('hard', ratings[Rating.Hard].card), 0);
  assert.equal(offset('good', ratings[Rating.Good].card), 0);
  assert.equal(offset('easy', ratings[Rating.Easy].card), 0);
  assert.equal(offset('again', ratings[Rating.Again].card), 4);
});

test('good requeues only while the card is still inside learning steps', () => {
  const firstGood = newCardRatings[Rating.Good].card;
  assert.equal(firstGood.state, 1);
  assert.equal(firstGood.scheduled_days, 0);
  assert.equal(offset('good', firstGood), 10);
  const graduated = scheduler.repeat(firstGood, new Date(firstGood.due))[Rating.Good].card;
  assert.equal(offset('good', graduated), 0);
});

test('easy and unknown ratings never requeue', () => {
  assert.equal(offset('easy', { scheduled_days: 0, state: 1 }), 0);
  assert.equal(offset('unknown', { scheduled_days: 0, state: 1 }), 0);
  assert.equal(offset('hard', null), 0);
});
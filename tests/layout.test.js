import { test } from 'node:test';
import assert from 'node:assert/strict';
import { untilNextOnset } from '../public/lib/layout.js';

test('a platform ends where the next onset of the same pattern starts', () => {
  const ends = untilNextOnset([
    { pat: '4', on: 0, off: 1 },
    { pat: '4', on: 1 / 16, off: 1 + 1 / 16 },
    { pat: '4', on: 1 / 2, off: 1.5 },
  ]);
  assert.deepEqual(ends, [1 / 16, 1 / 2, 1.5]);
});

test('other patterns do not cut a platform short', () => {
  const ends = untilNextOnset([
    { pat: '3', on: 0, off: 1 },
    { pat: '4', on: 0.25, off: 0.5 },
  ]);
  assert.deepEqual(ends, [1, 0.5]);
});

test('events on the same onset (jux copies, chords) share the same end', () => {
  const ends = untilNextOnset([
    { pat: '4', on: 0, off: 1 },
    { pat: '4', on: 0, off: 1 },
    { pat: '4', on: 0.125, off: 1.125 },
  ]);
  assert.deepEqual(ends, [0.125, 0.125, 1.125]);
});

test('a short event keeps its own end when the next onset is later', () => {
  const ends = untilNextOnset([
    { pat: '4', on: 0, off: 0.1 },
    { pat: '4', on: 0.5, off: 0.6 },
  ]);
  assert.deepEqual(ends, [0.1, 0.6]);
});

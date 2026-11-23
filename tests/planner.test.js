import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCourse, heroHeight } from '../public/lib/planner.js';

const opts = { clear: 3, hop: 4, gravity: 1280 };

test('flat ground with nothing ahead keeps the hero on the ground', () => {
  const course = buildCourse([], [], opts);
  assert.equal(heroHeight(5.3, course, opts.gravity), 0);
});

test('the jump apex sits exactly on the onset, clearing the tower', () => {
  const course = buildCourse([{ on: 2, height: 20 }], [], opts);
  assert.equal(heroHeight(2, course, opts.gravity), 23);
  assert.ok(heroHeight(1.95, course, opts.gravity) < 23);
  assert.ok(heroHeight(2.05, course, opts.gravity) < 23);
  assert.equal(heroHeight(2.5, course, opts.gravity), 0);
});

test('obstacles closer than one jump keep the hero airborne between them', () => {
  const course = buildCourse([{ on: 1, height: 20 }, { on: 1.125, height: 20 }], [], opts);
  assert.ok(heroHeight(1.0625, course, opts.gravity) > 0);
});

test('the hero rides a platform at its height and falls off after its end', () => {
  const course = buildCourse([], [{ on: 3, off: 3.5, height: 40 }], opts);
  assert.equal(heroHeight(3.25, course, opts.gravity), 40);
  assert.equal(heroHeight(3, course, opts.gravity), 44);
  assert.ok(heroHeight(3.55, course, opts.gravity) < 40);
  assert.equal(heroHeight(4, course, opts.gravity), 0);
});

test('the highest overlapping platform carries the hero', () => {
  const course = buildCourse([], [{ on: 0, off: 1, height: 20 }, { on: 0, off: 1, height: 50 }], opts);
  assert.equal(heroHeight(0.5, course, opts.gravity), 50);
});

test('a tower taller than the platform still gets jumped from the platform', () => {
  const course = buildCourse([{ on: 0.5, height: 60 }], [{ on: 0, off: 1, height: 30 }], opts);
  assert.equal(heroHeight(0.5, course, opts.gravity), 63);
  assert.equal(heroHeight(0.25, course, opts.gravity), 30);
});

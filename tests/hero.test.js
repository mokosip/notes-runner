import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCourse, newHero, stepHero } from '../public/lib/planner.js';

const opts = { clear: 3, hop: 4, gravity: 3556, snap: 8, stumbleMs: 400, recover: 1000 };

function run(course, from, to, dc, { swapAt, swapTo } = {}) {
  const hero = newHero(from);
  const modes = new Set();
  let c = from;
  let now = 0;
  let current = course;
  while (c < to) {
    c += dc;
    now += 16;
    if (swapAt !== undefined && c >= swapAt) current = swapTo;
    stepHero(hero, c, now, current, opts);
    modes.add(hero.mode);
  }
  return { hero, modes };
}

test('steep planned arcs at coarse frame steps never count as a surprise', () => {
  const course = buildCourse([{ on: 1, height: 40 }], [{ on: 1.5, off: 2, height: 90 }], opts);
  const { modes } = run(course, 0, 3, 0.03);
  assert.deepEqual([...modes], ['normal']);
});

test('the hero follows the plan exactly while nothing changes', () => {
  const course = buildCourse([{ on: 1, height: 20 }], [], opts);
  const hero = newHero(0.9);
  stepHero(hero, 1, 0, course, opts);
  assert.equal(hero.y, 23);
});

test('an obstacle appearing right in front of the hero makes it stumble at floor level', () => {
  const empty = buildCourse([], [], opts);
  const surprise = buildCourse([{ on: 1.02, height: 30 }], [], opts);
  const { hero, modes } = run(empty, 0.9, 1.02, 0.005, { swapAt: 1, swapTo: surprise });
  assert.ok(modes.has('stumble'));
  assert.equal(hero.mode, 'stumble');
  assert.equal(hero.y, 0);
});

test('an obstacle removed mid-jump lets the hero fall instead of teleporting down', () => {
  const tower = buildCourse([{ on: 1, height: 40 }], [], opts);
  const empty = buildCourse([], [], opts);
  const hero = newHero(0.8);
  for (const c of [0.85, 0.9, 0.95, 1]) stepHero(hero, c, 0, tower, opts);
  const top = hero.y;
  stepHero(hero, 1.005, 16, empty, opts);
  assert.equal(hero.mode, 'fall');
  assert.ok(hero.y > 0 && hero.y < top);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inBlast, stepBomb } from '../public/lib/bomb.js';

const GROUND = 200;
const G = 500;
const xAt = (bc) => bc * 100;

function fly(bomb, surfaces, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) stepBomb(bomb, dt, xAt, surfaces, GROUND, G);
  return bomb;
}

test('a thrown bomb lands on the ground and stops', () => {
  const bomb = fly({ bc: 1, y: 180, vx: 1, vy: -150, resting: false }, [], 2);
  assert.equal(bomb.resting, true);
  assert.equal(bomb.y, GROUND);
  const restX = bomb.bc;
  fly(bomb, [], 0.5);
  assert.equal(bomb.bc, restX);
});

test('a bomb falling onto a platform rests on its top', () => {
  const platform = { l: 100, r: 400, t: 150 };
  const bomb = fly({ bc: 2, y: 120, vx: 0, vy: 0, resting: false }, [platform], 1);
  assert.equal(bomb.y, 150);
  assert.equal(bomb.resting, true);
});

test('a bomb passes under a surface that is above it', () => {
  const high = { l: 100, r: 400, t: 150 };
  const bomb = fly({ bc: 2, y: 170, vx: 0, vy: 0, resting: false }, [high], 1);
  assert.equal(bomb.y, GROUND);
});

test('a resting bomb falls down when its surface is gone', () => {
  const platform = { l: 100, r: 400, t: 150 };
  const bomb = fly({ bc: 2, y: 120, vx: 0, vy: 0, resting: false }, [platform], 1);
  fly(bomb, [], 1);
  assert.equal(bomb.y, GROUND);
  assert.equal(bomb.resting, true);
});

test('the blast reaches boxes whose nearest point is within the radius', () => {
  const box = { l: 110, r: 116, t: 180, b: 199 };
  assert.equal(inBlast(box, 100, 195, 10), true);
  assert.equal(inBlast(box, 100, 195, 9), false);
  assert.equal(inBlast({ l: 98, r: 102, t: 204, b: 208 }, 100, 198, 6), true);
});

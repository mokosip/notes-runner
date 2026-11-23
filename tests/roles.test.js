import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, mapField } from '../public/lib/roles.js';

const config = {
  rules: [
    { match: { s: /^(bd|kick)/ }, role: 'hurdle' },
    { match: { pat: 'd4' }, role: 'bg' },
    { match: { note: true, sustain: [0.5, 99] }, role: 'bg' },
    { match: { note: true }, role: 'platform' },
    { match: { crush: false, s: 'hh' }, role: 'coin' },
  ],
};

test('vrole in the pattern beats every rule', () => {
  assert.equal(classify({ s: 'bd', vrole: 'platform' }, config), 'platform');
});

test('unknown vrole falls back to the rules', () => {
  assert.equal(classify({ s: 'bd', vrole: 'banana' }, config), 'hurdle');
});

test('first matching rule wins', () => {
  assert.equal(classify({ s: 'kick', pat: '4' }, config), 'hurdle');
  assert.equal(classify({ s: 'superpiano', note: 3, sustain: 1 }, config), 'bg');
  assert.equal(classify({ s: 'superpiano', note: 3, sustain: 0.2 }, config), 'platform');
});

test('pat matches with or without the d prefix', () => {
  assert.equal(classify({ s: 'arpy', pat: '4' }, config), 'bg');
  assert.equal(classify({ s: 'arpy', pat: '14' }, config), 'ignore');
});

test('false requires the field to be absent', () => {
  assert.equal(classify({ s: 'hh' }, config), 'coin');
  assert.equal(classify({ s: 'hh', crush: 4 }, config), 'ignore');
});

test('mapField scales linearly, clamps, and takes the first present field', () => {
  const spec = { from: ['note', 'n'], in: [0, 24], out: [10, 70] };
  assert.equal(mapField(spec, { n: 12 }), 40);
  assert.equal(mapField(spec, { note: 48, n: 0 }), 70);
  assert.equal(mapField(spec, { note: -5 }), 10);
});

test('mapField uses the default when no field is present', () => {
  assert.equal(mapField({ from: 'gain', in: [0, 2], out: [4, 16], default: 9 }, {}), 9);
  assert.equal(mapField({ from: 'gain', in: [0, 2], out: [4, 16] }, {}), 10);
});

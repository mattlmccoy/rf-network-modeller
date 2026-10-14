import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { bankCombos, candidates, describeMoves, moveCount } from './enumerate.ts';

test('bank combos follow o7_joint.py combos() order and size', () => {
  assert.deepEqual(bankCombos(2), [counts(0, 0, 1), counts(0, 0, 2), counts(0, 1, 0), counts(0, 1, 1), counts(0, 2, 0), counts(1, 0, 0), counts(1, 0, 1), counts(1, 1, 0), counts(2, 0, 0)]);
  assert.equal(bankCombos(4).length, 34);
});

test('series (2 slots) × shunt (4 slots) within the stock is 209 candidates', () => {
  assert.equal(candidates([{ id: 'ser', slots: 2 }, { id: 'sh', slots: 4 }], DEFAULT_STOCK, counts()).length, 209);
});

test('parts reserved by unsearched banks are not available', () => {
  const free = candidates([{ id: 'ser', slots: 2 }], counts(1, 0, 0), counts());
  const reserved = candidates([{ id: 'ser', slots: 2 }], counts(1, 0, 0), counts(1, 0, 0));
  assert.equal(free.length, 1);
  assert.equal(reserved.length, 0);
});

test('two-groups-in-series picks use twice the parts', () => {
  const all = candidates([{ id: 'b', slots: 2 }], counts(2, 0, 0), counts(), true);
  assert.ok(all.some((c) => c.picks.b.nSeries === 2 && c.picks.b.counts[100] === 1));
  assert.ok(!all.some((c) => c.picks.b.nSeries === 2 && c.picks.b.counts[100] === 2));
});

test('moves count parts removed and added; the description names them', () => {
  const current = { ser: { counts: counts(0, 1, 1), nSeries: 1 as const }, sh: { counts: counts(2, 0, 0), nSeries: 1 as const } };
  const pick = { ser: { counts: counts(0, 1, 1), nSeries: 1 as const }, sh: { counts: counts(1, 1, 1), nSeries: 1 as const } };
  assert.equal(moveCount(current, pick), 3);
  assert.deepEqual(describeMoves({ ser: 'Series bank', sh: 'Shunt bank' }, current, pick), ['Series bank: no change', 'Shunt bank: remove 1×100; add 1×50 + 1×30']);
});

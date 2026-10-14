import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN, cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { o7Chain, o7State } from '../chain/presets.ts';
import type { Block } from '../chain/types.ts';
import { blockSummary, displayUnit, fmtZ, partsText, tagSummary, toDisplay } from './units.ts';

const chain = o7Chain('capfree');
const get = (id: string): Block => findBlock(chain, id) as Block;

test('display units by parameter, with primitives by kind', () => {
  assert.deepEqual(displayUnit(get('Ls'), 'L'), { scale: 1e-9, unit: 'nH' });
  assert.deepEqual(displayUnit(get('branch'), 'd'), { scale: 0.01, unit: '%' });
  assert.deepEqual(displayUnit({ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: { value: 1e-10, badge: 'typed', free: false, lo: 0, hi: 1 } }, 'value'), { scale: 1e-12, unit: 'pF' });
  assert.equal(toDisplay(300e-9, { scale: 1e-9, unit: 'nH' }), 300);
});

test('impedance text distinguishes open and invalid from numbers', () => {
  assert.equal(fmtZ(cx(7.244, -18.004)), '7.24 − j18.00 Ω');
  assert.equal(fmtZ(OPEN), 'open');
  assert.equal(fmtZ(cx(Number.NaN, Number.NaN)), 'invalid');
});

test('block and part summaries', () => {
  assert.equal(partsText(counts(1, 1, 1)), '1×100 + 1×50 + 1×30');
  assert.equal(partsText(counts()), 'empty');
  assert.equal(blockSummary(get('ser')), '1×50 + 1×30 = 80 pF');
  assert.equal(blockSummary(get('Ls')), '300 nH');
  assert.equal(blockSummary(get('branch')), 'measured, loop on');
});

test('a sweep tag reads as bank values and the loop state', () => {
  assert.equal(tagSummary(chain, o7State(counts(1, 0, 1), counts(2, 0, 1), false)), 'Series bank 130 pF · Shunt bank 230 pF · loop off');
});

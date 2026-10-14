import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN, cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { o7Chain, o7State } from '../chain/presets.ts';
import type { Block } from '../chain/types.ts';
import { blockSummary, designEquals, displayUnit, fmtZ, paramCommit, partsText, tagSummary, toDisplay } from './units.ts';

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

test('card summaries round fitted values to 4 significant figures', () => {
  const l: Block = { id: 'l', label: 'l', type: 'inductor', L: { value: 586.84826e-9, badge: 'fit', free: true, lo: 0, hi: 1 }, R: 0 };
  assert.equal(blockSummary(l), '586.8 nH');
});

test('a commit equal to the displayed value is skipped, so focusing a fitted field never retypes it (final review C1)', () => {
  const p = { value: 586.84842617e-9, badge: 'fit' as const, free: true, lo: 0, hi: 1 };
  const u = { scale: 1e-9, unit: 'nH' };
  assert.equal(paramCommit(p, u, toDisplay(p.value, u)), null);
  assert.equal(paramCommit(p, u, 500), 500 * 1e-9);
  assert.equal(designEquals({ N_p: 3, N_s: 15, N_c: 4, strap: false }, { N_p: 3, N_s: 15, N_c: 4, strap: false }), true);
  assert.equal(designEquals({ N_p: 3, N_s: 15, N_c: 4, strap: false }, { N_p: 3, N_s: 16, N_c: 4, strap: false }), false);
});

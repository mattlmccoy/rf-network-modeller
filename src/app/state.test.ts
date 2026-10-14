import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain } from '../chain/presets.ts';
import type { Sweep } from '../io/sweep.ts';
import { getParam } from '../fit/params.ts';
import { type AppState, emptyState, reducer, snapshotState, uniqueSweepId, variantChain } from './state.ts';
import { loadFixtureSweep } from '../testutil.ts';

const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
const base: AppState = {
  ...emptyState(),
  chain: o7Chain('capfree'),
  variants: DEFAULT_VARIANTS,
  sweeps: { capfree },
  fits: {
    [DEFAULT_VARIANTS[0].name]: { refs: O7_REFS, x: [330, 92, 1.07, 1.2, 0.49], source: 'test' },
    [DEFAULT_VARIANTS[1].name]: { refs: O7_REFS, x: [250, 108, 1.1, 1.17, 0.49], source: 'test' },
  },
};
const ls = { blockId: 'Ls', key: 'L' as const };

test("variantChain applies each variant's fitted values; a variant without a fit uses the typed chain", () => {
  assert.equal(getParam(variantChain(base, 0), ls).value, 330 * 1e-9);
  assert.equal(getParam(variantChain(base, 1), ls).value, 250 * 1e-9);
  assert.equal(getParam(variantChain(base, 2), ls).value, 300e-9);
});

test('typing a value applies it to every variant and drops it from every fit (review focus 2)', () => {
  const s = reducer(base, { type: 'setParam', ref: ls, value: 410e-9 });
  for (const i of [0, 1, 2]) assert.equal(getParam(variantChain(s, i), ls).value, 410e-9);
  assert.equal(getParam(s.chain, ls).badge, 'typed');
  assert.ok(Object.values(s.fits).every((f) => !f.refs.some((r) => r.blockId === 'Ls' && r.key === 'L')));
  assert.equal(getParam(variantChain(s, 0), { blockId: 'Lb', key: 'L' }).value, 92e-9);
});

test('removing a block drops its fitted values and clears the selection', () => {
  const s = reducer({ ...base, selected: 'Ls' }, { type: 'remove', id: 'Ls' });
  assert.equal(findBlock(s.chain, 'Ls'), undefined);
  assert.equal(s.selected, null);
  assert.ok(Object.values(s.fits).every((f) => f.refs.every((r) => r.blockId !== 'Ls') && f.x.length === f.refs.length));
  variantChain(s, 0);
});

test('a loaded sweep is tagged with the circuit as it is; applySweepState restores that circuit', () => {
  const sweep: Sweep = { id: 'x', name: 'x.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  const s1 = reducer(base, { type: 'addSweep', sweep, label: 'x' });
  assert.deepEqual(s1.tagged.at(-1)?.state, snapshotState(base.chain));
  assert.equal(s1.activeSweep, 'x');
  const s2 = reducer(s1, { type: 'patchBlock', id: 'sh', patch: { counts: counts(2, 0, 0) } });
  const s3 = reducer(s2, { type: 'applySweepState', sweepId: 'x' });
  assert.deepEqual((findBlock(s3.chain, 'sh') as { counts: unknown }).counts, counts(1, 1, 1));
});

test('include, active and remove; a sweep a measured branch uses keeps its data (review focus 5)', () => {
  const sweep: Sweep = { id: 'x', name: 'x.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  let s = reducer(base, { type: 'addSweep', sweep, label: 'x' });
  s = reducer(s, { type: 'toggleInclude', sweepId: 'x' });
  assert.equal(s.tagged.at(-1)?.include, false);
  s = reducer(s, { type: 'removeSweep', sweepId: 'x' });
  assert.equal(s.sweeps.x, undefined);
  assert.equal(s.activeSweep, null);
  const t = reducer({ ...base, tagged: [{ sweepId: 'capfree', label: 'cap-free', state: {}, include: false }] }, { type: 'removeSweep', sweepId: 'capfree' });
  assert.ok(t.sweeps.capfree);
  assert.equal(t.tagged.length, 0);
});

test('uniqueSweepId sanitizes file names and avoids collisions', () => {
  assert.equal(uniqueSweepId({}, 'noAIT 80/200.s1p'), 'noAIT-80-200');
  assert.equal(uniqueSweepId({ 'a-b': capfree }, 'a b.s1p'), 'a-b-2');
});

test('fitted values for blocks that no longer exist are ignored, and structural patches drop them', () => {
  const dangling: AppState = { ...base, fits: { [DEFAULT_VARIANTS[0].name]: { refs: [...O7_REFS, { blockId: 'gone', key: 'L' }], x: [330, 92, 1.07, 1.2, 0.49, 5], source: 'test' } } };
  assert.equal(getParam(variantChain(dangling, 0), ls).value, 330 * 1e-9);
  const s = reducer(base, { type: 'patchBlock', id: 'shuntArm', patch: { chain: [] } });
  assert.ok(Object.values(s.fits).every((f) => f.refs.every((r) => r.blockId !== 'sh') && f.x.length === f.refs.length));
});

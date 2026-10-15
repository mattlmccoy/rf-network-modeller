import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain } from '../chain/presets.ts';
import type { Sweep } from '../io/sweep.ts';
import { getParam } from '../fit/params.ts';
import { type AppState, emptyState, reducer, reservedIds, snapshotState, uniqueSweepId, variantChain } from './state.ts';
import { newBlock } from './chainEdit.ts';
import { loadFixtureSweep } from '../testutil.ts';
import { structureKey } from '../present/circuit.ts';

const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
const base: AppState = {
  ...emptyState(),
  chain: o7Chain('capfree'),
  variants: DEFAULT_VARIANTS,
  sweeps: { capfree },
  fits: {
    [DEFAULT_VARIANTS[0].name]: { refs: O7_REFS, x: [330, 92, 1.07, 1.2, 0.49], source: 'test', converged: null, rms: null, illDetermined: [] },
    [DEFAULT_VARIANTS[1].name]: { refs: O7_REFS, x: [250, 108, 1.1, 1.17, 0.49], source: 'test', converged: null, rms: null, illDetermined: [] },
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
  const t = reducer({ ...base, tagged: [{ sweepId: 'capfree', label: 'cap-free', state: {}, include: false, structure: '' }] }, { type: 'removeSweep', sweepId: 'capfree' });
  assert.ok(t.sweeps.capfree);
  assert.equal(t.tagged.length, 0);
});

test('uniqueSweepId sanitizes file names and avoids collisions', () => {
  assert.equal(uniqueSweepId({}, 'noAIT 80/200.s1p'), 'noAIT-80-200');
  assert.equal(uniqueSweepId({ 'a-b': capfree }, 'a b.s1p'), 'a-b-2');
});

test('fitted values for blocks that no longer exist are ignored, and structural patches drop them', () => {
  const dangling: AppState = { ...base, fits: { [DEFAULT_VARIANTS[0].name]: { refs: [...O7_REFS, { blockId: 'gone', key: 'L' }], x: [330, 92, 1.07, 1.2, 0.49, 5], source: 'test', converged: null, rms: null, illDetermined: [] } } };
  assert.equal(getParam(variantChain(dangling, 0), ls).value, 330 * 1e-9);
  const s = reducer(base, { type: 'patchBlock', id: 'shuntArm', patch: { chain: [] } });
  assert.ok(Object.values(s.fits).every((f) => f.refs.every((r) => r.blockId !== 'sh') && f.x.length === f.refs.length));
});

test('new block ids never reuse an id that a sweep tag or a fit still refers to (final review I4)', () => {
  let s = reducer(base, { type: 'insertInto', containerId: 'shuntArm', arm: 0, block: newBlock(base.chain, 'capBank') });
  assert.ok(findBlock(s.chain, 'bank1'));
  s = reducer(s, { type: 'patchBlock', id: 'bank1', patch: { counts: counts(3, 0, 0) } });
  s = reducer(s, { type: 'addSweep', sweep: { id: 'mine', name: 'mine.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] }, label: 'mine' });
  s = reducer(s, { type: 'remove', id: 'bank1' });
  assert.ok(reservedIds(s).includes('bank1'));
  assert.equal(newBlock(s.chain, 'capBank', '', reservedIds(s)).id, 'bank2');
});

test('addSweep tags the sweep with the circuit structure; retagSweep re-tags it with the current circuit', () => {
  const sweep: Sweep = { id: 'n', name: 'n.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  let s = reducer(base, { type: 'addSweep', sweep, label: 'n' });
  assert.equal(s.tagged.at(-1)?.structure, structureKey(base.chain));
  s = reducer(s, { type: 'setCircuitState', state: { ser: { counts: counts(2, 0, 0) } } });
  s = reducer(s, { type: 'retagSweep', sweepId: 'n' });
  assert.deepEqual((s.tagged.at(-1)?.state.ser as { counts: unknown }).counts, counts(2, 0, 0));
});

test('setCircuitState applies bank picks and skips blocks that are gone; setFits replaces the fits', () => {
  const s = reducer(base, { type: 'setCircuitState', state: { ser: { counts: counts(1, 0, 0), nSeries: 1 }, gone: { loop: true } } });
  const ser = findBlock(s.chain, 'ser');
  assert.ok(ser?.type === 'capBank' && ser.counts[100] === 1);
  assert.deepEqual(reducer(base, { type: 'setFits', fits: {} }).fits, {});
});

test('emptyState plans for 500 W', () => {
  assert.equal(emptyState().powerW, 500);
});

test('setPower takes a finite positive power and ignores anything else (review focus 1)', () => {
  assert.equal(reducer(base, { type: 'setPower', watts: 300 }).powerW, 300);
  for (const w of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(reducer(base, { type: 'setPower', watts: w }).powerW, 500);
});

test('setTModel stores or clears the transformer model', () => {
  const tm = { variant: 'v', unit: { n: 5, L_leak: 1e-6, f_pri: 0, L_m: 1e-6, G_core: 1e-4, R1: 1, R2: 9, C_w: 0, N_p: 3, N_c: 4 }, load: { C: 7e-12, G_cube: 0, G_fix: 0 }, rmsRel: 0.05 };
  const s = reducer(base, { type: 'setTModel', tmodel: tm });
  assert.deepEqual(s.tmodel, tm);
  assert.equal(reducer(s, { type: 'setTModel', tmodel: null }).tmodel, null);
  assert.equal(emptyState().tmodel, null);
});

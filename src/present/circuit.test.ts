import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { O7_FILES, o7Chain, o7State } from '../chain/presets.ts';
import { applyState, updateBlock } from '../chain/state.ts';
import { insertAfter, newBlock } from '../app/chainEdit.ts';
import { type AppState, emptyState, reducer } from '../app/state.ts';
import { loadFixtureSweep } from '../testutil.ts';
import { activeIsMeasured, sameState, snapshotState, structureKey, trust, trustText } from './circuit.ts';

const chain = o7Chain('capfree');
const key = structureKey(chain);
const tag = (series: number[], shunt: number[], loop: boolean, id: string) => ({
  sweepId: id, state: o7State(counts(series[0], series[1], series[2]), counts(shunt[0], shunt[1], shunt[2]), loop), include: true, structure: key,
});
// The five tagged O7 builds of 2026-10-13 (spec §7.1 example): 130/230, 100/200, 80/200, 80/200 + loop, 80/180 + loop.
const tags = [tag([1, 0, 1], [2, 0, 1], false, 'a'), tag([1, 0, 0], [2, 0, 0], false, 'b'), tag([0, 1, 1], [2, 0, 0], false, 'c'), tag([0, 1, 1], [2, 0, 0], true, 'd'), tag([0, 1, 1], [1, 1, 1], true, 'e')];

test('structureKey ignores bank parts, the loop flag, labels and recommender settings', () => {
  let c = applyState(chain, o7State(counts(2, 0, 0), counts(0, 0, 1), false));
  c = updateBlock(c, 'ser', { label: 'renamed', slots: 7, searchable: false });
  assert.equal(structureKey(c), key);
});

test('structureKey changes when a value is retyped, a part is added, or a param is freed only in badge', () => {
  const ls = updateBlock(chain, 'Ls', { L: { value: 410e-9, badge: 'typed', free: true, lo: 150e-9, hi: 700e-9 } });
  assert.notEqual(structureKey(ls), key);
  assert.notEqual(structureKey(insertAfter(chain, 'Ls', newBlock(chain, 'inductor'))), key);
  const badgeOnly = updateBlock(chain, 'Ls', { L: { value: 300e-9, badge: 'fit', free: false, lo: 0, hi: 1 } });
  assert.equal(structureKey(badgeOnly), key, 'badge, free and bounds do not change the circuit');
});

test('sameState normalises the o7State and snapshotState shapes', () => {
  const s = o7State(counts(0, 1, 1), counts(1, 1, 1), true);
  assert.ok(sameState(chain, s, snapshotState(applyState(chain, s))));
  assert.ok(!sameState(chain, s, o7State(counts(0, 1, 1), counts(1, 1, 1), false)));
});

test('trust: measured, within, beyond (spec §7.3)', () => {
  assert.equal(trust(chain, tags), 'measured', 'the preset is the 80/180 + loop build');
  assert.equal(trust(updateBlock(chain, 'ser', { counts: counts(1, 0, 0) }), tags), 'within', '100 pF lies inside 80–130 pF');
  assert.equal(trust(updateBlock(chain, 'ser', { counts: counts(2, 0, 0) }), tags), 'beyond', '200 pF is above every series build');
  assert.equal(trust(updateBlock(chain, 'sh', { counts: counts(1, 0, 1) }), tags), 'beyond', '130 pF is below every shunt build');
  const ls = updateBlock(chain, 'Ls', { L: { value: 410e-9, badge: 'typed', free: true, lo: 150e-9, hi: 700e-9 } });
  assert.equal(trust(ls, tags), 'beyond', 'a retyped value is a different circuit');
  assert.equal(trust(chain, []), 'beyond', 'no sweeps: everything is a prediction');
  assert.equal(trust(chain, tags.filter((t) => !t.state.branch.loop)), 'beyond', 'loop on was never measured in these tags');
  assert.equal(trust(chain, tags.map((t) => ({ ...t, include: false }))), 'beyond', 'excluded sweeps do not count');
});

test('activeIsMeasured needs the active sweep itself to match, and is false once it is removed', () => {
  assert.ok(activeIsMeasured(chain, tags, 'e'));
  assert.ok(!activeIsMeasured(chain, tags, 'a'));
  assert.ok(!activeIsMeasured(chain, tags, null));
  const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const s: AppState = { ...emptyState(), chain, sweeps: { capfree, e: { ...capfree, id: 'e' } }, tagged: [{ ...tags[4], label: 'e' }], activeSweep: 'e' };
  const after = reducer(s, { type: 'removeSweep', sweepId: 'e' });
  assert.ok(!activeIsMeasured(after.chain, after.tagged, after.activeSweep));
});

test('trustText says nothing for measured and words the rest by level', () => {
  assert.equal(trustText('measured', 'builder'), null);
  assert.equal(trustText('within', 'beginner'), '(prediction: not measured yet)');
  assert.equal(trustText('beyond', 'engineer'), "Beyond anything you've measured: the model is extrapolating");
  assert.equal(trustText('within', 'builder'), "Within what you've measured");
});

test('entering transformer turns on a project saved without them keeps every sweep measured (Plan 3B review C1)', () => {
  const plain = updateBlock(chain, 'branch', { transformer: undefined });
  const key3a = structureKey(plain);
  const tags3a = tags.map((t) => ({ ...t, structure: key3a }));
  const withTurns = updateBlock(plain, 'branch', { transformer: { nP: 3, nS: 15, nC: 4 } });
  assert.equal(structureKey(withTurns), key3a, 'turns change flux, not impedance');
  assert.equal(trust(withTurns, tags3a), 'measured');
  assert.ok(activeIsMeasured(withTurns, tags3a, 'e'));
});

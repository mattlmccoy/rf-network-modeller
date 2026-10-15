import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { O7_FILES, cdChain } from '../chain/presets.ts';
import { findBlock } from '../chain/state.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { type AppState, emptyState } from '../app/state.ts';
import { snapshotState, structureKey } from '../present/circuit.ts';
import { ROOT, loadFixtureSweep } from '../testutil.ts';
import { fromProjectJson, toProjectJson } from './file.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const cd: AppState = (() => {
  const chain = cdChain();
  return { ...emptyState(), chain, sweeps: { cd: loadFixtureSweep('cd', O7_FILES.cdNet) }, tagged: [{ sweepId: 'cd', label: 'cd', state: snapshotState(chain), include: true, structure: structureKey(chain) }], activeSweep: 'cd' };
})();
const T = '2026-10-15T00:00:00.000Z';

test('save then open gives the same project: the O7 example and a C+D project (spec §9)', () => {
  assert.deepEqual(fromProjectJson(toProjectJson(ex, T)).state, ex);
  assert.deepEqual(fromProjectJson(toProjectJson(cd, T)).state, cd);
});

test('unbounded parameters survive the file: ±Infinity is written as null and read back', () => {
  const back = fromProjectJson(toProjectJson(cd, T)).state;
  const ls = findBlock(back.chain, 'Ls');
  assert.ok(ls?.type === 'inductor');
  assert.equal(ls.L.lo, Number.NEGATIVE_INFINITY);
  assert.equal(ls.L.hi, Number.POSITIVE_INFINITY);
  assert.match(toProjectJson(cd, T), /"lo":null/);
});

test('open reports what is wrong, never crashes', () => {
  const good = (): Record<string, any> => JSON.parse(toProjectJson(ex, T));
  const bad = (mut: (j: Record<string, any>) => void): string => { const j = good(); mut(j); return JSON.stringify(j); };
  assert.throws(() => fromProjectJson('{nope'), /isn't a modeller project: it is not valid JSON/);
  assert.throws(() => fromProjectJson(bad((j) => { j.format = 'rfnm/0'; })), /its format is "rfnm\/0"/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.sweeps['o7-80-200'].gamma.pop(); })), /sweep "o7-80-200" has (\d+) frequencies but \d+ points/);
  assert.throws(() => fromProjectJson(bad((j) => { delete j.project.tagged[0].structure; })), /a tagged sweep is malformed/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.tagged[0].sweepId = 'missing'; })), /refers to a missing sweep/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.activeSweep = 'missing'; })), /its shown sweep is missing/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.primary = 9; })), /cable assumption is out of range/);
});

test('open rejects fits and blocks that would crash the workbench (review I5)', () => {
  const good = (): Record<string, any> => JSON.parse(toProjectJson(ex, T));
  const bad = (mut: (j: Record<string, any>) => void): string => { const j = good(); mut(j); return JSON.stringify(j); };
  assert.throws(() => fromProjectJson(bad((j) => { const k = Object.keys(j.project.fits)[0]; delete j.project.fits[k].refs; })), /a fit is malformed/);
  assert.throws(() => fromProjectJson(bad((j) => { const k = Object.keys(j.project.fits)[0]; j.project.fits[k].x.pop(); })), /a fit is malformed/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.chain.blocks.push({ id: 'S9', label: '', type: 'shunt' }); })), /block "S9" is malformed/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.chain.blocks.push({ id: 'Q', label: '', type: 'gizmo' }); })), /a block in the circuit is malformed/);
  const withSweeps = bad((j) => { const k = Object.keys(j.project.fits)[0]; j.project.fits[k].sweeps = ['o7-80-200']; });
  assert.doesNotThrow(() => fromProjectJson(withSweeps), 'a fit may record the sweeps it was made from');
});

test('a Plan 3A file without a transformer model opens with none; a malformed one is rejected', () => {
  const j = JSON.parse(toProjectJson(ex, T));
  delete j.project.tmodel;
  assert.equal(fromProjectJson(JSON.stringify(j)).state.tmodel, null);
  j.project.tmodel = { variant: 'x', unit: 'nope', load: {}, rmsRel: 0.1 };
  assert.throws(() => fromProjectJson(JSON.stringify(j)), /its transformer model is malformed/);
});

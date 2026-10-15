import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { updateBlock } from '../chain/state.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { defaultGrid, evalGrid } from '../app/grid.ts';
import { emptyState } from '../app/state.ts';
import { ROOT, readFixtureJson } from '../testutil.ts';
import { fPriAtPower, fPriSolutions, fitBranchTModel, transformerView } from './transformer.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const grid = evalGrid(ex.chain, ex.sweeps);

test('O7 with the shipped T-model at 500 W: flux 0.47–6.31 mT and loop 4.5–60 V over leakage split 0–0.5', () => {
  const v = transformerView(ex, grid, 500);
  assert.equal(v.kind, 'ranges');
  if (v.kind !== 'ranges') return;
  const r = v.ranges[0];
  assert.ok(Math.abs(r.bMin - 0.47) < 0.01 && Math.abs(r.bMax - 6.31) < 0.01, `B ${r.bMin}–${r.bMax}`);
  assert.ok(Math.abs(r.vMin - 4.5) < 0.05 && Math.abs(r.vMax - 60.0) < 0.1, `V ${r.vMin}–${r.vMax}`);
  assert.equal(v.split.length, 1, 'the measured pair absorbs everything and cannot be split');
  assert.ok(Math.abs(v.split[0].watts - 500) < 0.5);
});

test('a scope reading can fit more than one leakage split; all are reported, and an impossible one gives none (review focus 4)', () => {
  const v = transformerView(ex, grid, 300);
  assert.ok(v.kind === 'ranges' && v.loopV);
  const two = fPriSolutions(v.loopV, 20);
  assert.equal(two.length, 2, JSON.stringify(two));
  assert.ok(Math.abs(two[0] - 0.18) < 0.01 && two[1] > 0.4 && two[1] < 0.5, JSON.stringify(two));
  for (const fp of two) assert.ok(Math.abs(v.loopV(fp) - 20) < 1e-6);
  assert.deepEqual(fPriSolutions(v.loopV, 1e6), []);
});

test('no turns asks for them; a missing, other-assumption or other-turns T-model asks for a refit (review focus 3)', () => {
  const noTurns = { ...ex, chain: updateBlock(ex.chain, 'branch', { transformer: undefined }) };
  assert.equal(transformerView(noTurns, grid, 500).kind, 'needs-turns');
  assert.equal(transformerView({ ...ex, tmodel: null }, grid, 500).kind, 'needs-tmodel');
  assert.equal(transformerView({ ...ex, primary: 1 }, grid, 500).kind, 'needs-tmodel');
  const turns = { ...ex, chain: updateBlock(ex.chain, 'branch', { transformer: { nP: 3, nS: 18, nC: 4 } }) };
  assert.equal(transformerView(turns, grid, 500).kind, 'needs-tmodel');
});

test('a network built from stacks reports each stack (C+D)', () => {
  const v = transformerView({ ...emptyState(), chain: cdChain() }, defaultGrid(), 500);
  assert.equal(v.kind, 'ranges');
  if (v.kind !== 'ranges') return;
  assert.equal(v.source, 'stacks');
  assert.ok(v.ranges.length === 1 && Number.isFinite(v.ranges[0].bMax) && v.ranges[0].bMax > 0);
});

test('fitting the T-model in the browser reproduces the Python fit on the O7 cap-free sweep', () => {
  const t = fitBranchTModel(ex);
  const py = readFixtureJson<{ tmodel: { rms_rel: number } }>('tmodel_short.json').tmodel;
  assert.deepEqual([t.variant, t.unit.n, t.unit.N_p, t.unit.N_c], [ex.variants[0].name, 5, 3, 4]);
  assert.ok(Math.abs(t.rmsRel / py.rms_rel - 1) < 0.02, `rms ${t.rmsRel} vs Python ${py.rms_rel}`);
});

test('a T-model fitted to another sweep, or with no sweep recorded, asks for a refit (Plan 3B review I4)', () => {
  const moved = { ...ex, chain: updateBlock(ex.chain, 'branch', { sweepId: 'o7-130-230' }) };
  assert.equal(transformerView(moved, grid, 500).kind, 'needs-tmodel');
  const legacy = { ...ex, tmodel: ex.tmodel && { ...ex.tmodel, sweepId: undefined as unknown as string } };
  assert.equal(transformerView(legacy, grid, 500).kind, 'needs-tmodel');
  assert.equal(ex.tmodel?.sweepId, 'capfree');
});

test("the measured part's own power is reported, not the first block that dissipates (Plan 3B review I5)", () => {
  const lossy = { ...ex, chain: updateBlock(ex.chain, 'ser', { esr: 0.2 }) };
  const v = transformerView(lossy, grid, 500);
  assert.ok(v.kind === 'ranges' && v.branchW !== null);
  assert.ok(v.branchW > 400 && v.branchW < 499, `branch ${v.branchW} W`);
  assert.ok(v.split.some((x) => x.label === 'Series bank' && x.watts > 1));
});

test('the stated range is the true minimum and maximum over 0–0.5, not six samples (Plan 3B review I7)', () => {
  const v = transformerView(ex, grid, 500);
  assert.ok(v.kind === 'ranges');
  const e = v.extent[0];
  assert.ok(Math.abs(e.bMin - 0.075) < 0.01 && Math.abs(e.vMin - 0.715) < 0.02, JSON.stringify(e));
  assert.ok(Math.abs(e.bMax - 6.31) < 0.01 && Math.abs(e.vMax - 60.0) < 0.1, JSON.stringify(e));
  assert.equal(v.ranges[0].points.length, 6, 'the Engineer table keeps six rows');
});

test('a scope reading is compared at the power it was taken at, since loop voltage scales with √P (Plan 3B review I3)', () => {
  const at500 = transformerView(ex, grid, 500);
  const at300 = transformerView(ex, grid, 300);
  assert.ok(at500.kind === 'ranges' && at500.loopV && at300.kind === 'ranges' && at300.loopV);
  const viaPlan = fPriAtPower(at500.loopV, 20, 300, 500);
  const direct = fPriSolutions(at300.loopV, 20);
  assert.equal(viaPlan.length, direct.length);
  viaPlan.forEach((fp, i) => assert.ok(Math.abs(fp - direct[i]) < 1e-6, `${fp} vs ${direct[i]}`));
});

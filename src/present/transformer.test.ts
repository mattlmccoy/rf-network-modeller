import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { updateBlock } from '../chain/state.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { defaultGrid, evalGrid } from '../app/grid.ts';
import { emptyState } from '../app/state.ts';
import { ROOT, readFixtureJson } from '../testutil.ts';
import { fitBranchTModel, solveFPri, transformerView } from './transformer.ts';

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

test('a measured loop voltage solves the leakage split; an impossible reading says so (review focus 4)', () => {
  const v = transformerView(ex, grid, 500);
  assert.ok(v.kind === 'ranges' && v.loopV);
  const ok = solveFPri(v.loopV, 20);
  assert.ok('fPri' in ok && ok.fPri > 0 && ok.fPri < 0.5, JSON.stringify(ok));
  assert.ok('error' in solveFPri(v.loopV, 1e6));
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

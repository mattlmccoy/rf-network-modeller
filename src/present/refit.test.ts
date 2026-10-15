import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { O7_LOOP_REF, O7_REFS } from '../chain/presets.ts';
import { refName } from '../fit/params.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { reducer } from '../app/state.ts';
import { ROOT } from '../testutil.ts';
import { refitAll, refitRefs, refitVariant } from './refit.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('refit fits the free values and converges on the five O7 sweeps (spec §8.1)', () => {
  const refs = refitRefs(ex);
  assert.equal(refs.length, 6);
  const f = refitVariant(ex, 0, refs);
  assert.equal(f.converged, true);
  assert.ok(f.rms !== null && f.rms < 0.1, `rms ${f.rms}`);
  assert.equal(f.source, 'in-app refit (5 sweeps)');
  const ls = f.x[f.refs.findIndex((r) => r.blockId === 'Ls' && r.key === 'L')];
  assert.ok(ls > 550 && ls < 650, `wiring L ${ls} nH`);
});

test('a failing refit returns its reason and no fits, so the caller keeps the previous ones', async () => {
  const broken = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[0], sweepId: 'missing' }] };
  const r = await refitAll(broken, () => {}, async () => {});
  assert.ok('error' in r);
});

test('nothing marked free and no fits: refitAll says there is nothing to refit', async () => {
  const bare = { ...ex, fits: {}, chain: { ...ex.chain, blocks: [ex.chain.blocks[0]] } };
  assert.deepEqual(await refitAll(bare, () => {}, async () => {}), { error: 'Nothing to refit: no value is marked free to fit.' });
});

test('refit fits exactly the values marked free: the O7 six, and unticking one removes it (review I2)', () => {
  assert.deepEqual(refitRefs(ex).map(refName).sort(), [...O7_REFS, O7_LOOP_REF].map(refName).sort());
  const s = reducer(ex, { type: 'setFree', ref: { blockId: 'Ls', key: 'L' }, free: false });
  assert.ok(!refitRefs(s).some((r) => r.blockId === 'Ls'));
  const t = reducer(ex, { type: 'setParam', ref: { blockId: 'Lb', key: 'L' }, value: 90e-9 });
  assert.ok(refitRefs(t).some((r) => r.blockId === 'Lb'), 'a retyped value that is still ticked free is refitted');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { ROOT } from '../testutil.ts';
import { refitAll, refitRefs, refitVariant } from './refit.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('refit reuses the current fits\' parameters and converges on the five O7 sweeps (spec §8.1)', () => {
  const refs = refitRefs(ex);
  assert.equal(refs.length, 6);
  const f = refitVariant(ex, 0, refs);
  assert.equal(f.converged, true);
  assert.ok(f.rms !== null && f.rms < 0.1, `rms ${f.rms}`);
  assert.equal(f.source, 'in-app refit (5 sweeps)');
  assert.ok(f.x[0] > 550 && f.x[0] < 650, `wiring L ${f.x[0]} nH`);
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

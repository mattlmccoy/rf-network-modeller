import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_VARIANTS, O7_FILES } from '../chain/presets.ts';
import { evaluateVariants } from './evaluate.ts';
import { type ExampleManifest, exampleState } from './example.ts';
import { evalGrid } from './grid.ts';
import { reducer } from './state.ts';
import { ROOT, assertClose, pair, readFixtureJson } from '../testutil.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const texts = Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)]));
const fx = readFixtureJson<{ variants: { fit3: { x: number[] }; loop: { q: number; pred_80_180_loop: number[] } }[] }>('o7_fit.json');

test('the example manifest carries the captured Python fits', () => {
  assert.equal(m.fits.length, DEFAULT_VARIANTS.length);
  m.fits.forEach((f, i) => {
    assert.equal(f.variant, DEFAULT_VARIANTS[i].name);
    assert.deepEqual(f.x, fx.variants[i].fit3.x);
    assert.equal(f.q, fx.variants[i].loop.q);
  });
});

test('the example sweeps are byte-identical to the fixtures', () => {
  assert.equal(read(`public/examples/o7/${m.capFree}`), read(`fixtures/sweeps/${O7_FILES.capFree}`));
  assert.equal(read('public/examples/o7/80-180-loop.s1p'), read(`fixtures/sweeps/${O7_FILES.s80_180_loop}`));
});

test('the example opens at 80/180 + loop and lands where the Python predicted', () => {
  const s = exampleState(m, texts);
  const r = evaluateVariants(s, evalGrid(s.chain, s.sweeps));
  r.forEach((v, i) => {
    assert.equal(v.error, null);
    assertClose(v.landing?.z ?? { re: Number.NaN, im: 0 }, pair(fx.variants[i].loop.pred_80_180_loop), 1e-9, `variant ${i}`);
  });
  assert.deepEqual(r.map((v) => v.landing?.inWindow), [true, true, false]);
});

test('an invalid circuit becomes a message for every variant, not a crash (review focus 1)', () => {
  const s = exampleState(m, texts);
  const broken = reducer(s, { type: 'patchBlock', id: 'shuntArm', patch: { chain: [] } });
  const r = evaluateVariants(broken, evalGrid(broken.chain, broken.sweeps));
  assert.ok(r.every((v) => v.error !== null && /empty/.test(v.error) && v.landing === null));
});

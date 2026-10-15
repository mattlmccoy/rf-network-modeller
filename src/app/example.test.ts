import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_VARIANTS, O7_FILES } from '../chain/presets.ts';
import { evaluateVariants, measuredLanding } from './evaluate.ts';
import { cx } from '../engine/complex.ts';
import { gammaFromZ, nearestIndex } from '../io/sweep.ts';
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

test('the measured landing is null when the sweep has no point near 13.56 MHz (final review I2)', () => {
  const s = exampleState(m, texts);
  const real = measuredLanding(s.sweeps['o7-80-200']);
  assertClose(real?.z ?? cx(Number.NaN), cx(5.0263, 4.3027), 1e-3);
  assert.ok(Math.abs((real?.f ?? 0) - 13.5622e6) < 100);
  const f = Array.from({ length: 10 }, (_, i) => 1e6 + i * 1e6);
  assert.equal(measuredLanding({ id: 'n', name: 'n', f, gamma: f.map(() => gammaFromZ(cx(20, 5))) }), null);
  const coarse = measuredLanding({ id: 'c', name: 'c', f: [13e6, 14.5e6], gamma: [cx(0.1), cx(0.2)] });
  assert.equal(coarse?.f, 13e6);
});

test('points where a measured branch is read outside its sweep are marked per frequency (final review I5)', () => {
  const s = exampleState(m, texts);
  const g = evalGrid(s.chain, s.sweeps);
  const k = (f: number): number => nearestIndex(g, f);
  const base = evaluateVariants(s, g)[0];
  assert.equal(base.clamped[k(13.56e6)], false);
  assert.equal(base.clamped[g.length - 1], true);
  const big = reducer(s, { type: 'setParam', ref: { blockId: 'branch', key: 'd' }, value: 0.5 });
  const r = evaluateVariants(big, g)[0];
  assert.equal(r.clamped[k(13.56e6)], false);
  assert.equal(r.clamped[k(17e6)], true);
});

test('the example ships the Python T-model for the first cable assumption, and the O7 pair knows its turns', () => {
  const s = exampleState(m, texts);
  const tm = readFixtureJson<{ tmodel: { unit: unknown; load: unknown } }>('tmodel_short.json').tmodel;
  assert.equal(s.tmodel?.variant, DEFAULT_VARIANTS[0].name);
  assert.deepEqual(s.tmodel?.unit, tm.unit);
  assert.deepEqual(s.tmodel?.load, tm.load);
  const b = s.chain.blocks.flatMap((x) => (x.type === 'shunt' ? x.chain : [x])).find((x) => x.id === 'branch');
  assert.ok(b?.type === 'measuredBranch');
  assert.deepEqual(b.transformer, { nP: 3, nS: 15, nC: 4 });
});

test('the example fits record the sweeps they were made from; 80/180 + loop stays a blind check (tools/capture_fixtures.py:222-223, reviewer pass M5)', () => {
  const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, readFileSync(new URL(`public/examples/o7/${f}`, ROOT), 'utf8')])));
  for (const f of Object.values(ex.fits)) assert.deepEqual(f.sweeps, ['o7-130-230', 'o7-100-200', 'o7-80-200', 'o7-80-200-loop']);
});

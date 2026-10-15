import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { zFromGamma } from '../io/sweep.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { ROOT } from '../testutil.ts';
import { combine, landingNearF0, nearF0Index, verdictOf, verdictText, windowDistance } from './verdict.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const measured = (id: string) => {
  const sw = ex.sweeps[id];
  return verdictOf(landingNearF0(sw.f, sw.gamma.map((g) => zFromGamma(g)), ex.window), ex.window);
};

test('O7 model: two cable assumptions give some room, the third is outside, so the majority says some room (spec §7.1)', () => {
  const vs = evaluateVariants(ex, evalGrid(ex.chain, ex.sweeps)).map((r) => verdictOf(r.landing, ex.window));
  assert.deepEqual(vs.map((v) => v.state), ['some', 'some', 'outside']);
  assert.deepEqual(combine(vs.map((v) => v.state)), { state: 'some', agree: 2, total: 3 });
});

test('O7 measured: 80/180 + loop has little room (0.82 % up); 80/200 is outside with reactance too low', () => {
  const v = measured('o7-80-180-loop');
  assert.equal(v.state, 'little');
  assert.ok(v.roomUp !== null && Math.abs(v.roomUp - 0.82) < 0.01);
  assert.deepEqual(measured('o7-80-200').off, ['xLow']);
  assert.deepEqual(measured('o7-130-230').off, ['rHigh', 'xHigh']);
});

test('a sweep with no point near 13.56 MHz gives no landing, so the verdict is unknown (review focus 2)', () => {
  const f = Array.from({ length: 50 }, (_, i) => 1e6 + i * 0.2e6);
  assert.equal(nearF0Index(f), null);
  assert.equal(landingNearF0(f, f.map(() => cx(10, 20)), AIT_WINDOW), null);
  assert.equal(verdictOf(null, AIT_WINDOW).state, 'unknown');
  assert.equal(nearF0Index([]), null);
});

test('room thresholds: below 1 % is little, below 2.5 % some, otherwise plenty', () => {
  const l = (roomUp: number) => ({ z: cx(10, 20), f: 13.56e6, inWindow: true, roomUp, roomDown: 1 });
  assert.deepEqual([0.99, 1, 2.49, 2.5].map((r) => verdictOf(l(r), AIT_WINDOW).state), ['little', 'some', 'some', 'plenty']);
});

test('combine: the majority wins; with no majority the worst state wins, and unknown is worst', () => {
  assert.equal(combine(['plenty', 'plenty', 'outside']).state, 'plenty');
  assert.equal(combine(['plenty', 'some', 'outside']).state, 'outside');
  assert.equal(combine(['plenty', 'some', 'unknown']).state, 'unknown');
  assert.deepEqual(combine([]), { state: 'unknown', agree: 0, total: 0 });
});

test('windowDistance is the distance in ohms to the window rectangle', () => {
  assert.equal(windowDistance(cx(10, 20), AIT_WINDOW), 0);
  assert.equal(windowDistance(cx(2, 30), AIT_WINDOW), 3);
  assert.equal(windowDistance(cx(0, 0), AIT_WINDOW), Math.hypot(5, 6));
  assert.equal(windowDistance(cx(Number.POSITIVE_INFINITY, 0), AIT_WINDOW), Number.POSITIVE_INFINITY);
});

test('verdict wording by level; Beginner shows no ohms; Builder notes when the assumptions disagree', () => {
  const out = verdictOf({ z: cx(5.03, 4.3), f: 13.56e6, inWindow: false, roomUp: -99, roomDown: -99 }, AIT_WINDOW);
  assert.equal(verdictText(out, 'beginner'), "The tuner can't match this (reactance too low)");
  const little = verdictOf({ z: cx(7.8, 27.9), f: 13.56e6, inWindow: true, roomUp: 0.82, roomDown: 1.04 }, AIT_WINDOW);
  assert.equal(verdictText(little, 'beginner'), 'Matches, but with little room: warming up may push it out');
  assert.equal(verdictText(little, 'builder', { state: 'little', agree: 2, total: 3 }), 'The tuner can match it, with little room (room to drift up 0.8 %) (depends on the cable assumption)');
  assert.equal(verdictText(verdictOf(null, AIT_WINDOW), 'engineer'), "Can't tell yet");
});

test('a landing with no impedance (the recommender\'s empty band) is unknown, never a crash (review fix)', () => {
  const l = { z: undefined as unknown as ReturnType<typeof cx>, f: Number.NaN, inWindow: false, roomUp: -99, roomDown: -99 };
  assert.equal(verdictOf(l, AIT_WINDOW).state, 'unknown');
  assert.equal(windowDistance(undefined as unknown as ReturnType<typeof cx>, AIT_WINDOW), Number.POSITIVE_INFINITY);
});

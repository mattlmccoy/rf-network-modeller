import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { ROOT } from '../testutil.ts';
import { agreementFor, agreementText, capUnsettled, combineGrades, gradeOf } from './agreement.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('O7 80/180 + loop: reactance off 9.9 / 11.0 / 16.4 ohm, so rough, rough, off; the majority is rough (spec §7.2)', () => {
  const a = agreementFor(ex, evalGrid(ex.chain, ex.sweeps));
  assert.ok(a);
  assert.deepEqual(a.perVariant.map((g) => g.grade), ['rough', 'rough', 'off']);
  const dx = a.perVariant.map((g) => g.dX ?? Number.NaN);
  [-9.9, -11.0, -16.4].forEach((want, i) => assert.ok(Math.abs(dx[i] - want) < 0.1, `variant ${i}: ${dx[i]}`));
  assert.equal(a.combined, 'rough');
});

test('the model is evaluated in the sweep\'s own state, not the current circuit', () => {
  const grid = evalGrid(ex.chain, ex.sweeps);
  const moved = { ...ex, chain: { ...ex.chain, blocks: ex.chain.blocks.map((b) => (b.id === 'ser' && b.type === 'capBank' ? { ...b, counts: { 100: 2, 50: 0, 30: 0 } } : b)) } };
  assert.deepEqual(agreementFor(moved, grid)?.perVariant.map((g) => g.grade), ['rough', 'rough', 'off']);
});

test('grade bands: 3 ohm agrees, 12 ohm rough, beyond is off; missing data is unknown', () => {
  assert.equal(gradeOf(cx(10, 20), cx(13, 17)).grade, 'agrees');
  assert.equal(gradeOf(cx(10, 20), cx(10, 32)).grade, 'rough');
  assert.equal(gradeOf(cx(10, 20), cx(10, 32.01)).grade, 'off');
  assert.equal(gradeOf(null, cx(1, 1)).grade, 'unknown');
  assert.equal(gradeOf(cx(1, 1), cx(Number.NaN, 1)).grade, 'unknown');
});

test('combineGrades takes the majority, else the worst; an unsettled fit caps agrees at rough', () => {
  assert.equal(combineGrades(['agrees', 'agrees', 'off']), 'agrees');
  assert.equal(combineGrades(['agrees', 'rough', 'off']), 'off');
  assert.equal(combineGrades(['agrees', 'rough', 'unknown']), 'unknown');
  assert.equal(capUnsettled('agrees', true), 'rough');
  assert.equal(capUnsettled('off', true), 'off');
});

test('no active tagged sweep: nothing to compare', () => {
  assert.equal(agreementFor({ ...ex, activeSweep: null }, evalGrid(ex.chain, ex.sweeps)), null);
});

test('agreement wording carries the near-edge warning for rough and the unsettled note', () => {
  const a = { perVariant: [{ grade: 'rough' as const, dR: -0.57, dX: -9.89 }], combined: 'rough' as const, unsettled: true, inSample: false };
  assert.equal(agreementText(a, 'beginner', 0), "The model is close, not exact. The last refit didn't settle.");
  assert.equal(agreementText(a, 'builder', 0),
    "Roughly: resistance −0.6 Ω, reactance −9.9 Ω (model minus sweep). A miss this size can change which suggestion is best and whether it lands in the tuner's good range near the edge, so treat the ranking as a direction. The last refit didn't settle.");
});

test('a sweep the fit was made from reads as "fit to this sweep", never as a blind check (review I1)', () => {
  const grid = evalGrid(ex.chain, ex.sweeps);
  assert.equal(agreementFor(ex, grid)?.inSample, false, 'the imported fits record their sweeps, and 80/180 + loop is not one of them');
  const fitted = { ...ex, fits: Object.fromEntries(Object.entries(ex.fits).map(([k, f]) => [k, { ...f, sweeps: ['o7-80-180-loop'] }])) };
  const a = agreementFor(fitted, grid);
  assert.ok(a?.inSample);
  assert.match(agreementText(a, 'builder', 0), /^Fit to this sweep \(it is part of the fit\): /);
});

test('agreement combines only the fitted cable assumptions when any is fitted (fix review I2)', () => {
  const v0 = ex.variants[0].name;
  const a = agreementFor({ ...ex, fits: { [v0]: ex.fits[v0] } }, evalGrid(ex.chain, ex.sweeps));
  assert.ok(a);
  assert.equal(a.combined, a.perVariant[0].grade);
});

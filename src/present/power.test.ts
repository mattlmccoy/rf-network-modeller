import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { defaultGrid, evalGrid } from '../app/grid.ts';
import { emptyState } from '../app/state.ts';
import { ROOT } from '../testutil.ts';
import { counts } from '../blocks/ht50.ts';
import { updateBlock } from '../chain/state.ts';
import { capStress, powerText, roundSafe, safePower } from './power.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const grid = evalGrid(ex.chain, ex.sweeps);

test('O7 at 500 W: the 100 pF shunt part is current-limited at 111.5 % (worst cable assumption); safe to about 400 W', () => {
  const cs = capStress(ex, grid, 500);
  assert.equal(cs.rows.length, 5);
  assert.deepEqual([cs.limiting?.blockId, cs.limiting?.pf, cs.limiting?.limit, cs.limiting?.flag], ['sh', 100, 'current', 'red']);
  assert.ok(cs.worstPct !== null && Math.abs(cs.worstPct - 111.5) < 0.2, `worst ${cs.worstPct}`);
  assert.equal(cs.safeW, safePower(500, cs.worstPct));
  assert.equal(powerText(cs, 'beginner'), 'At 500 W the 100 pF part in the Shunt bank would carry 111 % of its rated current. The capacitors are safe up to about 400 W.');
});

test('stress scales with the square root of power: at 300 W the same build is within its ratings', () => {
  const cs = capStress(ex, grid, 300);
  assert.ok(cs.worstPct !== null && Math.abs(cs.worstPct - 111.5 * Math.sqrt(0.6)) < 0.3);
  assert.equal(cs.limiting?.flag, 'amber');
  assert.equal(powerText(cs, 'beginner'), 'The capacitors are within their ratings at 300 W. The capacitors are safe up to about 400 W.');
  assert.match(powerText(cs, 'builder'), /^At 300 W the worst capacitor \(the 100 pF part in the Shunt bank\) is at 86 % of its rated current\./);
});

test('a drive that fails says "Can\'t tell" and gives no safe power (review focus 2)', () => {
  const blank = { ...emptyState(), chain: { name: 'blank', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] } };
  const cs = capStress(blank, defaultGrid(), 500);
  assert.equal(cs.safeW, null);
  assert.ok(cs.errors.length > 0);
  assert.match(powerText(cs, 'builder'), /^Can't tell: /);
});

test('safePower: V and I scale with √P, so P_max = P (100 / worst %)²; unknown without a rated part', () => {
  assert.ok(Math.abs((safePower(500, 111.5) ?? 0) - 402.18) < 0.01);
  assert.equal(safePower(500, null), null);
});

test('an unrated capacitor carrying current is never shown as healthy (Plan 3B review I6)', () => {
  const custom = { ...ex, chain: updateBlock(ex.chain, 'sh', { customPf: 100.5, counts: counts(0, 1, 1) }) };
  const cs = capStress(custom, grid, 300);
  assert.equal(cs.unrated.length, 1);
  assert.equal(cs.unrated[0].pf, 100.5);
  const text = powerText(cs, 'beginner');
  assert.match(text, /The 100.5 pF custom part has no rating, so it isn't checked\./);
  assert.doesNotMatch(text, /^The capacitors are within their ratings/);
});

test('the safe power rounds down to 10 W, since it is a limit', () => {
  assert.deepEqual([402, 405, 409.9, 410].map(roundSafe), [400, 400, 400, 410]);
});

test('stress leaves out unfitted cable assumptions when any is fitted; with none fitted it is labelled an estimate (reviewer pass C1)', () => {
  const v0 = ex.variants[0].name;
  const one = capStress({ ...ex, fits: { [v0]: ex.fits[v0] } }, grid, 500);
  const alone = capStress({ ...ex, variants: [ex.variants[0]], fits: { [v0]: ex.fits[v0] } }, grid, 500);
  assert.equal(one.worstPct, alone.worstPct);
  assert.equal(one.estimate, false);
  const none = capStress({ ...ex, fits: {} }, grid, 500);
  assert.equal(none.estimate, true);
  assert.match(powerText(none, 'builder'), /^Estimate \(not fitted to a sweep of this circuit\): /);
});

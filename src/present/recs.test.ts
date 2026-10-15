import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import type { Landing } from '../recommend/landing.ts';
import { type Recommendation, type RecommendOutput, recommend } from '../recommend/recommend.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { variantChain } from '../app/state.ts';
import { ROOT } from '../testutil.ts';
import { noChangeNeeded, picksState, shapeRecs, stressFlag } from './recs.ts';
import { newSweepStatus, tryChangeStatus } from './guide.ts';

const land = (re: number, im: number, inWindow: boolean, roomUp = 1.5): Landing => ({ z: cx(re, im), f: 13.56e6, inWindow, roomUp: inWindow ? roomUp : -99, roomDown: inWindow ? 1 : -99 });
const rec = (moves: number, stress: number | null, ls: Landing[]): Recommendation => ({
  candidate: { picks: { ser: { counts: counts(moves, 0, 0), nSeries: 1 } } }, landings: ls, inCount: ls.filter((l) => l.inWindow).length, roomScore: 1, moves, maxStressPct: stress, movesText: [`move ${moves}`],
});
const out = (ranked: Recommendation[], all: Recommendation[] = ranked): RecommendOutput => ({ ranked, all, current: {} });

test('the current build ranking first means nothing in stock beats it; every row red adds the power note', () => {
  const inside = [land(10, 20, true), land(10, 20, true), land(2, 2, false)];
  const v = shapeRecs(out([rec(0, 111, inside), rec(2, 129, inside)]), AIT_WINDOW);
  assert.ok(v.rows[0].isCurrent);
  assert.deepEqual(v.notes, ['nothing-beats', 'all-red']);
  assert.equal(v.rows[0].verdict, 'some');
  assert.equal(v.currentStressPct, 111);
});

test('nothing ranks: say so and list the three closest by median distance outside the window', () => {
  const far = (d: number) => rec(d, 50, [land(17 + d, 20, false), land(17 + d, 20, false), land(17 + d, 20, false)]);
  const v = shapeRecs(out([], [far(9), far(1), far(5), far(3)]), AIT_WINDOW);
  assert.deepEqual(v.notes, ['none-fit']);
  assert.deepEqual(v.closest.map((r) => r.movesText[0]), ['move 1', 'move 3', 'move 5']);
});

test('no stock at all: none-fit with no closest list and no crash (review focus 4)', () => {
  assert.deepEqual(shapeRecs(out([], []), AIT_WINDOW), { rows: [], closest: [], notes: ['none-fit'], currentStressPct: null });
});

test('stress flags at 80 and 100 percent; unknown stays unknown; at most five rows', () => {
  assert.deepEqual([null, 79.9, 80, 99.9, 100].map(stressFlag), ['unknown', 'ok', 'amber', 'amber', 'red']);
  const many = Array.from({ length: 8 }, (_, i) => rec(i + 1, 10, [land(10, 20, true)]));
  assert.equal(shapeRecs(out(many), AIT_WINDOW).rows.length, 5);
});

test('"No change needed" needs plenty of room and capacitor stress under 100 % (spec §8.1)', () => {
  assert.ok(noChangeNeeded('plenty', 60));
  assert.ok(!noChangeNeeded('plenty', 111));
  assert.ok(!noChangeNeeded('plenty', null));
  assert.ok(!noChangeNeeded('some', 10));
});

test('picksState turns picks into circuit-state overrides', () => {
  assert.deepEqual(picksState({ ser: { counts: counts(1, 0, 0), nSeries: 1 } }), { ser: { counts: counts(1, 0, 0), nSeries: 1 } });
});

test('O7 example: four rows rank, the current build is first and over its rating at 500 W', () => {
  const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
  const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
  const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
  const o = recommend({ fitted: ex.variants.map((variant, i) => ({ variant, chain: variantChain(ex, i) })), sweeps: ex.sweeps, grid: evalGrid(ex.chain, ex.sweeps), window: ex.window, stock: ex.stock, stressWatts: ex.powerW });
  const v = shapeRecs(o, ex.window);
  assert.equal(v.rows.length, 4);
  assert.ok(v.rows[0].isCurrent && v.notes.includes('nothing-beats'));
  assert.ok(v.currentStressPct !== null && v.currentStressPct > 100);
});

test('guide steps: confirm, then load, then the rest open together', () => {
  assert.deepEqual(newSweepStatus(false, false), ['current', 'waiting', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(newSweepStatus(true, false), ['done', 'current', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(newSweepStatus(true, true), ['done', 'done', 'current', 'current', 'current']);
});

test('try-a-change steps: pick, then change; the result opens once something changed', () => {
  assert.deepEqual(tryChangeStatus(false, false), ['current', 'waiting', 'waiting']);
  assert.deepEqual(tryChangeStatus(true, false), ['done', 'current', 'waiting']);
  assert.deepEqual(tryChangeStatus(true, true), ['done', 'done', 'current']);
  assert.deepEqual(tryChangeStatus(false, true), ['done', 'done', 'current']);
});

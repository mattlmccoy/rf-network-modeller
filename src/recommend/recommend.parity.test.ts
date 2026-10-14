import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { applyState } from '../chain/state.ts';
import { fromFitVars } from '../fit/params.ts';
import { recommend } from './recommend.ts';
import { assertClose, assertNear, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface Cand { series: number[]; shunt: number[]; landings: number[][]; room_up: number[]; room_down: number[]; n_in: number; moves: number }
interface Fx { variants: { fit3: { x: number[] }; loop: { q: number } }[]; recommend: { count: number; candidates: Cand[]; top12: number[][][] } }
const fx = readFixtureJson<Fx>('o7_fit.json');
const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
// Python's own fitted loop-state models (3-sweep fit + shift), current build 80/200, so this checks recommend alone.
const fitted = fx.variants.map((v, i) => ({
  variant: DEFAULT_VARIANTS[i],
  chain: applyState(fromFitVars(fromFitVars(o7Chain('capfree'), O7_REFS, v.fit3.x), [O7_LOOP_REF], [v.loop.q]), o7State(counts(0, 1, 1), counts(2, 0, 0), true)),
}));
const out = recommend({ fitted, sweeps: { capfree: capFree }, grid: capFree.f, window: AIT_WINDOW, stock: DEFAULT_STOCK, searchIds: ['ser', 'sh'] });
const triple = (c: Record<number, number>): number[] => [c[100], c[50], c[30]];

test('enumerates the same candidates in the same order as the Python', () => {
  assert.equal(out.all.length, fx.recommend.count);
  out.all.forEach((r, k) => {
    assert.deepEqual(triple(r.candidate.picks.ser.counts), fx.recommend.candidates[k].series);
    assert.deepEqual(triple(r.candidate.picks.sh.counts), fx.recommend.candidates[k].shunt);
  });
});

test('landings, drift room, variants in window and moves match per candidate', () => {
  out.all.forEach((r, k) => {
    const want = fx.recommend.candidates[k];
    r.landings.forEach((l, v) => {
      assertClose(l.z, pair(want.landings[v]), 1e-9, `cand ${k} variant ${v}`);
      assertNear(l.roomUp, want.room_up[v], 1e-12, `room up cand ${k} variant ${v}`);
      assertNear(l.roomDown, want.room_down[v], 1e-12, `room down cand ${k} variant ${v}`);
    });
    assert.equal(r.inCount, want.n_in);
    assert.equal(r.moves, want.moves);
  });
});

test('the ranked top 12 equals the Python ranking', () => {
  assert.deepEqual(out.ranked.slice(0, 12).map((r) => [triple(r.candidate.picks.ser.counts), triple(r.candidate.picks.sh.counts)]), fx.recommend.top12);
});

test('80/180 is in the window for the two good cable variants (the 10-13 re-pick)', () => {
  const r = out.all.find((x) => triple(x.candidate.picks.ser.counts).join() === '0,1,1' && triple(x.candidate.picks.sh.counts).join() === '1,1,1');
  assert.ok(r);
  assert.deepEqual(r.landings.map((l) => l.inWindow), [true, true, false]);
});

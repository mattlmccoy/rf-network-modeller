import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, cdChain, o7Chain, o7State } from '../chain/presets.ts';
import { applyState } from '../chain/state.ts';
import type { Context } from '../chain/types.ts';
import { fromFitVars } from '../fit/params.ts';
import { drive, reports } from './drive.ts';
import { fluxRangeBranch, fluxRangeStacks, solveFPri } from './flux.ts';
import { nearestIndex } from '../io/sweep.ts';
import { assertNear, loadFixtureSweep, readFixtureJson } from '../testutil.ts';

const cdCtx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };

test('T-model flux range: 6 points from f_pri 0 to 0.5; the f_pri = 0 point equals a plain drive', () => {
  const [range] = fluxRangeStacks(cdChain(), cdCtx, 13.56e6, 100);
  assert.equal(range.points.length, 6);
  assert.equal(range.points[5].fPri, 0.5);
  const plain = reports(cdChain(), drive(cdChain(), cdCtx, 13.56e6, 100)).get('stack')?.unit;
  assertNear(range.points[0].bPk_mT, plain?.b_pk_mT ?? NaN, 1e-12);
  assert.ok(range.bMin <= range.bMax);
});

test('measured-branch flux comes from the stage-1 T-model driven by the branch voltage', () => {
  const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const fx = readFixtureJson<{ variants: { fit2: { x: number[] } }[] }>('o7_fit.json');
  const tm = readFixtureJson<{ tmodel: { unit: Unit; load: PlateLoad } }>('tmodel_short.json').tmodel;
  const chain = applyState(fromFitVars(o7Chain('capfree'), O7_REFS, fx.variants[0].fit2.x), o7State(counts(0, 1, 1), counts(1, 1, 1), false));
  const ctx: Context = { variant: DEFAULT_VARIANTS[0], sweeps: { capfree: capFree } };
  const r = fluxRangeBranch(drive(chain, ctx, capFree.f[nearestIndex(capFree.f, 13.56e6)], 100), 'branch', tm.unit, tm.load);
  assert.equal(r.points.length, 6);
  assert.ok(r.points.every((p) => Number.isFinite(p.bPk_mT) && p.bPk_mT > 0));
});

test('solveFPri inverts a monotone loop-voltage curve and reports an unreachable reading', () => {
  const r = solveFPri((x) => 10 - 4 * x, 8.6);
  assert.ok('fPri' in r && Math.abs(r.fPri - 0.35) < 1e-9);
  const bad = solveFPri((x) => 10 - 4 * x, 20);
  assert.ok('error' in bad && /model structure/.test(bad.error));
});

test('solveFPri on the real C+D path returns a split that reproduces the reading', () => {
  const loopAt = (fp: number): number => fluxRangeStacks(cdChain(), cdCtx, 13.56e6, 100, fp, 2)[0].points[1].vLoopRms;
  const target = loopAt(0.33);
  const r = solveFPri(loopAt, target);
  assert.ok('fPri' in r, JSON.stringify(r));
  if ('fPri' in r) assertNear(loopAt(r.fPri), target, 1e-6);
});

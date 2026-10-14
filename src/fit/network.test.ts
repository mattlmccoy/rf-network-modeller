import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { evaluate } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { type StateOverrides, type TaggedSweep, applyState } from '../chain/state.ts';
import type { Context } from '../chain/types.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { fitNetwork, networkResidual } from './network.ts';
import { fromFitVars } from './params.ts';
import { assertNear, gauss, loadFixtureSweep, mulberry32 } from '../testutil.ts';

const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
const variant = DEFAULT_VARIANTS[0];
const all = { capfree: capFree };
const ctx: Context = { variant, sweeps: all };
const truth = [330, 92, 1.07, 1.2, 0.49];
const st130 = o7State(counts(1, 0, 1), counts(2, 0, 1), false);
const st100 = o7State(counts(1, 0, 0), counts(2, 0, 0), false);

function synth(id: string, state: StateOverrides, f: number[], noise = 0, seed = 1): Sweep {
  const rnd = mulberry32(seed);
  const z = evaluate(applyState(fromFitVars(o7Chain('capfree'), O7_REFS, truth), state), ctx, f);
  return { id, name: id, f, gamma: z.map((zz) => { const g = gammaFromZ(zz); return cx(g.re + noise * gauss(rnd), g.im + noise * gauss(rnd)); }) };
}
const tag = (sweep: Sweep, state: StateOverrides, include = true): TaggedSweep => ({ sweep, state, include });

test('recovers known parameters from noise-free synthetic sweeps', () => {
  const fit = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all,
    sweeps: [tag(synth('a', st130, capFree.f), st130), tag(synth('b', st100, capFree.f), st100)] });
  fit.x.forEach((v, i) => assertNear(v, truth[i], 1e-4, `param ${i}`));
  assert.ok(fit.rms < 1e-8, `rms ${fit.rms}`);
});

test('noisy synthetic sweeps (|ΔΓ| rms 0.01): every parameter within 3 standard errors', () => {
  const sigma = 0.01 / Math.SQRT2;
  const fit = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all,
    sweeps: [tag(synth('a', st130, capFree.f, sigma, 7), st130), tag(synth('b', st100, capFree.f, sigma, 11), st100)] });
  // If this fails with these seeds, report the z-scores; do not change the seeds to make it pass.
  fit.x.forEach((v, i) => assert.ok(Math.abs(v - truth[i]) <= 3 * fit.stderr[i], `param ${i}: ${v} vs ${truth[i]} ± ${fit.stderr[i]}`));
});

test('a sweep on a different grid is interpolated, not index-matched (review focus 4)', () => {
  const half = capFree.f.slice(0, -1).map((f, i) => (f + capFree.f[i + 1]) / 2);
  const res = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(synth('h', st130, half), st130)] });
  assert.ok(Math.max(...res(truth).map(Math.abs)) < 1e-12);
});

test('excluded sweeps do not enter the residual', () => {
  const a = synth('a', st130, capFree.f);
  const one = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(a, st130)] });
  const two = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(a, st130), tag(synth('b', st100, capFree.f), st100, false)] });
  assert.deepEqual(two([300, 150, 1, 1, 1]), one([300, 150, 1, 1, 1]));
});

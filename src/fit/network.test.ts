import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { evaluate } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { type StateOverrides, type TaggedSweep, applyState } from '../chain/state.ts';
import { type Chain, type Context, param } from '../chain/types.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { fitNetwork, networkResidual } from './network.ts';
import { FitError } from './lm.ts';
import { fromFitVars, getParam } from './params.ts';
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

test('fitting a primitive C or L recovers it in pF / nH fit units (final review I4)', () => {
  const f = Array.from({ length: 200 }, (_, i) => 12.05e6 + i * 12e3);
  const cases = [['C', 100e-12, 80e-12, 10e-12, 500e-12], ['L', 300e-9, 250e-9, 10e-9, 2e-6]] as const;
  for (const [kind, truth, start, lo, hi] of cases) {
    const mk = (v: number): Chain => ({ name: 'p', blocks: [
      { id: 'coax', label: 'coax', type: 'coax' },
      { id: 'x', label: 'x', type: 'primitive', kind, value: param(v, 'typed', true, lo, hi) },
      { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(5) }] },
    ] });
    const meas: Sweep = { id: 'm', name: 'm', f, gamma: evaluate(mk(truth), ctx, f).map((z) => gammaFromZ(z)) };
    const fit = fitNetwork({ chain: mk(start), refs: [{ blockId: 'x', key: 'value' }], sweeps: [{ sweep: meas, state: {}, include: true }], variant, allSweeps: all });
    const got = getParam(fit.chain, { blockId: 'x', key: 'value' }).value;
    assert.ok(Math.abs(got / truth - 1) < 1e-6, `${kind}: fitted ${got}, truth ${truth}`);
  }
});

test('a fit with no usable residual is a FitError, not a perfect fit (final review I5)', () => {
  const a = synth('a', st130, capFree.f);
  assert.throws(() => fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(a, st130, false)] }), FitError);
  const outOfBand: Sweep = { id: 'o', name: 'o', f: [1e6, 2e6], gamma: [cx(0.1), cx(0.2)] };
  assert.throws(() => fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(outOfBand, st130)] }), FitError);
});

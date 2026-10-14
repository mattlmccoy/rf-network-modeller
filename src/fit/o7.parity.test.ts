import assert from 'node:assert/strict';
import test from 'node:test';
import type { Complex } from '../engine/complex.ts';
import { type Counts, counts } from '../blocks/ht50.ts';
import { evaluate } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { type TaggedSweep, applyState } from '../chain/state.ts';
import type { Sweep } from '../io/sweep.ts';
import { fitNetwork } from './network.ts';
import { fmt, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface V { variant: string; length: number; fit2: { rms: number; pred_80_200: number[] }; loop: { pred_80_180_loop: number[] } }
const fx = readFixtureJson<{ k0: number; variants: V[] }>('o7_fit.json');
const S = {
  capfree: loadFixtureSweep('capfree', O7_FILES.capFree),
  s130: loadFixtureSweep('s130', O7_FILES.s130_230),
  s100: loadFixtureSweep('s100', O7_FILES.s100_200),
  s80: loadFixtureSweep('s80', O7_FILES.s80_200),
  s80L: loadFixtureSweep('s80L', O7_FILES.s80_200_loop),
};
const all = { capfree: S.capfree };
const tag = (sweep: Sweep, series: Counts, shunt: Counts, loop: boolean): TaggedSweep => ({ sweep, state: o7State(series, shunt, loop), include: true });
const within = (a: Complex, b: Complex, ohm: number, msg: string): void =>
  assert.ok(Math.abs(a.re - b.re) <= ohm && Math.abs(a.im - b.im) <= ohm, `${msg}: TypeScript ${fmt(a)} vs Python ${fmt(b)}`);

fx.variants.forEach((v, i) => {
  test(`fit parity vs o7_joint.py / o7_loopstate.py: ${v.variant} m`, () => {
    const variant = DEFAULT_VARIANTS[i];
    assert.equal(variant.cable.length, v.length);
    const f0 = [S.capfree.f[fx.k0]];
    const two = [tag(S.s130, counts(1, 0, 1), counts(2, 0, 1), false), tag(S.s100, counts(1, 0, 0), counts(2, 0, 0), false)];
    const f2 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: two, variant, allSweeps: all });
    const p80 = evaluate(applyState(f2.chain, o7State(counts(0, 1, 1), counts(2, 0, 0), false)), { variant, sweeps: all }, f0)[0];
    within(p80, pair(v.fit2.pred_80_200), 0.5, '80/200 from the 2-sweep fit');
    assert.ok(Math.abs(f2.rms - v.fit2.rms) <= 0.05 * v.fit2.rms, `rms ${f2.rms} vs Python ${v.fit2.rms}`);

    const three = [...two, tag(S.s80, counts(0, 1, 1), counts(2, 0, 0), false)];
    const f3 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: three, variant, allSweeps: all });
    const loop = fitNetwork({ chain: f3.chain, refs: [O7_LOOP_REF], sweeps: [tag(S.s80L, counts(0, 1, 1), counts(2, 0, 0), true)], variant, allSweeps: all, x0: [20] });
    const p180 = evaluate(applyState(loop.chain, o7State(counts(0, 1, 1), counts(1, 1, 1), true)), { variant, sweeps: all }, f0)[0];
    within(p180, pair(v.loop.pred_80_180_loop), 0.5, '80/180 + loop from the 3-sweep fit + loop shift');
  });
});

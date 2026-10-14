import { sub } from '../engine/complex.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile } from '../chain/compile.ts';
import { type TaggedSweep, applyState } from '../chain/state.ts';
import type { BranchCache, Chain, Context, Variant } from '../chain/types.ts';
import { type Sweep, bandIndices, gammaFromZ } from '../io/sweep.ts';
import { illDetermined, levenbergMarquardt, paramStats } from './lm.ts';
import { type ParamRef, fromFitVars, refName, toFitVars } from './params.ts';

/** Fit band of o7_joint.py: 12.0 < f < 14.6 MHz. */
export const FIT_BAND: [number, number] = [12.0e6, 14.6e6];

export interface NetworkFitInput {
  chain: Chain;
  refs: ParamRef[];
  sweeps: TaggedSweep[];
  variant: Variant;
  allSweeps: Record<string, Sweep>;
  band?: [number, number];
  x0?: number[];
  maxIter?: number;
}

export interface NetworkFit {
  chain: Chain;
  x: number[];
  cost: number;
  rms: number;
  rmsPerSweep: number[];
  stderr: number[];
  illDetermined: [string, string][];
  converged: boolean;
  iterations: number;
}

/** Γ_model − Γ_meas over the band for every included sweep in its own state: real parts, then imaginary parts. */
export function networkResidual(input: NetworkFitInput): (x: number[]) => number[] {
  const band = input.band ?? FIT_BAND;
  const cache: BranchCache = new Map();
  const used = input.sweeps.filter((s) => s.include);
  const idx = used.map((s) => bandIndices(s.sweep.f, band[0], band[1]));
  return (x) => {
    const chain = fromFitVars(input.chain, input.refs, x);
    const ctx: Context = { variant: input.variant, sweeps: input.allSweeps, cache };
    const out: number[] = [];
    used.forEach((t, k) => {
      const c = compile(applyState(chain, t.state), ctx);
      const re: number[] = [];
      const im: number[] = [];
      for (const i of idx[k]) {
        const d = sub(gammaFromZ(inputImpedance(c.net, t.sweep.f[i])), t.sweep.gamma[i]);
        re.push(d.re);
        im.push(d.im);
      }
      out.push(...re, ...im);
    });
    return out;
  };
}

/** √(mean |ΔΓ|²) over stacked real and imaginary residuals (o7_joint.py: sqrt(mean(fun²)·2)). */
const rmsOf = (r: number[]): number => Math.sqrt((2 * r.reduce((a, v) => a + v * v, 0)) / Math.max(r.length, 1));

export function fitNetwork(input: NetworkFitInput): NetworkFit {
  const res = networkResidual(input);
  const start = toFitVars(input.chain, input.refs);
  const r = levenbergMarquardt(res, input.x0 ?? start.x, { lo: start.lo, hi: start.hi, maxIter: input.maxIter ?? 200 });
  const stats = paramStats(r.jac, r.residual);
  const band = input.band ?? FIT_BAND;
  let off = 0;
  const rmsPerSweep = input.sweeps.filter((s) => s.include).map((s) => {
    const m = 2 * bandIndices(s.sweep.f, band[0], band[1]).length;
    const part = r.residual.slice(off, off + m);
    off += m;
    return rmsOf(part);
  });
  return {
    chain: fromFitVars(input.chain, input.refs, r.x, 'fit'),
    x: r.x,
    cost: r.cost,
    rms: rmsOf(r.residual),
    rmsPerSweep,
    stderr: stats.stderr,
    illDetermined: illDetermined(stats.corr).map(([a, b]): [string, string] => [refName(input.refs[a]), refName(input.refs[b])]),
    converged: r.converged,
    iterations: r.iterations,
  };
}

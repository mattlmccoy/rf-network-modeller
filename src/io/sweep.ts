import { type Complex, ONE, OPEN, add, cx, div, isFiniteC, scale, sub } from '../engine/complex.ts';

export const Z0 = 50;

/** A measured one-port sweep at the AIT-out plane. */
export interface Sweep {
  id: string;
  name: string;
  f: number[];
  gamma: Complex[];
}

export function zFromGamma(g: Complex, z0 = Z0): Complex {
  const d = sub(ONE, g);
  if (d.re === 0 && d.im === 0) return OPEN;
  return scale(div(add(ONE, g), d), z0);
}

export function gammaFromZ(z: Complex, z0 = Z0): Complex {
  if (!isFiniteC(z)) return ONE;
  return div(sub(z, cx(z0)), add(z, cx(z0)));
}

/** Index of the first grid point nearest `target` (np.argmin(abs(f - target))). */
export function nearestIndex(f: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < f.length; i += 1) if (Math.abs(f[i] - target) < Math.abs(f[best] - target)) best = i;
  return best;
}

/** np.interp: linear inside, exact at nodes, clamped to the end values outside. */
export function interpClamp(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const slope = (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]);
  return slope * (x - xs[lo]) + ys[lo];
}

/** Indices with lo < f < hi (strict, as the Python band masks). */
export function bandIndices(f: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  f.forEach((x, i) => {
    if (x > lo && x < hi) out.push(i);
  });
  return out;
}

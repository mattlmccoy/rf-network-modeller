import { SingularMatrixError, solveReal } from '../engine/linsolve.ts';

export type Residual = (x: number[]) => number[];

export interface LmOptions {
  lo?: number[];
  hi?: number[];
  maxIter?: number;
  ftol?: number;
  xtol?: number;
  relStep?: number;
}

export interface LmResult {
  x: number[];
  cost: number;
  residual: number[];
  jac: number[][];
  iterations: number;
  converged: boolean;
}

const clamp = (x: number[], lo: number[], hi: number[]): number[] => x.map((v, i) => Math.min(hi[i], Math.max(lo[i], v)));
const half2 = (r: number[]): number => 0.5 * r.reduce((a, v) => a + v * v, 0);
const normal = (J: number[][], n: number): number[][] =>
  Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => J.reduce((s, row) => s + row[a] * row[b], 0)));

/** Central-difference Jacobian (one-sided at a bound), m × n. */
export function jacobian(res: Residual, x: number[], lo: number[], hi: number[], relStep = 1e-6, r0?: number[]): number[][] {
  const base = r0 ?? res(x);
  const cols = x.map((xi, j) => {
    const h = relStep * Math.max(Math.abs(xi), 1);
    const up = Math.min(hi[j], xi + h);
    const dn = Math.max(lo[j], xi - h);
    const span = up - dn;
    if (span === 0) return base.map(() => 0);
    const xu = x.slice();
    xu[j] = up;
    const xd = x.slice();
    xd[j] = dn;
    const ru = up === xi ? base : res(xu);
    const rd = dn === xi ? base : res(xd);
    return ru.map((v, i) => (v - rd[i]) / span);
  });
  return base.map((_, i) => cols.map((c) => c[i]));
}

/** Projected Levenberg–Marquardt: minimises ½Σr² inside the box [lo, hi]. */
export function levenbergMarquardt(res: Residual, x0: number[], opt: LmOptions = {}): LmResult {
  const n = x0.length;
  const lo = opt.lo ?? x0.map(() => -Infinity);
  const hi = opt.hi ?? x0.map(() => Infinity);
  const maxIter = opt.maxIter ?? 200;
  const ftol = opt.ftol ?? 1e-12;
  const xtol = opt.xtol ?? 1e-10;
  const relStep = opt.relStep ?? 1e-6;
  let x = clamp(x0, lo, hi);
  let r = res(x);
  let cost = half2(r);
  let J = jacobian(res, x, lo, hi, relStep, r);
  let lambda = 1e-3;
  let converged = false;
  let it = 0;
  for (; it < maxIter && !converged; it += 1) {
    const A = normal(J, n);
    const g = Array.from({ length: n }, (_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
    // Active set: a parameter on a bound whose descent direction (−g) points outward stays fixed this iteration,
    // so its clamped step cannot corrupt the step of the parameters coupled to it.
    const free = x.map((_, i) => i).filter((i) => !((x[i] <= lo[i] && g[i] > 0) || (x[i] >= hi[i] && g[i] < 0)));
    if (!free.length) {
      converged = true; // pinned in a corner of the box with every descent direction pointing outward
      break;
    }
    const dmax = Math.max(...free.map((i) => A[i][i]), 1e-300);
    let accepted = false;
    for (let tries = 0; tries < 12 && !accepted; tries += 1) {
      const M = free.map((i) => free.map((j) => (i === j ? A[i][i] + lambda * Math.max(A[i][i], 1e-12 * dmax) : A[i][j])));
      const step = x.map(() => 0);
      try {
        solveReal(M, free.map((i) => -g[i])).forEach((s, k) => {
          step[free[k]] = s;
        });
      } catch (e) {
        if (e instanceof SingularMatrixError) {
          lambda *= 10;
          continue;
        }
        throw e;
      }
      const xn = clamp(x.map((v, i) => v + step[i]), lo, hi);
      const rn = res(xn);
      const cn = half2(rn);
      if (Number.isFinite(cn) && cn < cost) {
        const dx = Math.hypot(...xn.map((v, i) => v - x[i]));
        converged = cost - cn <= ftol * cost || dx <= xtol * (Math.hypot(...x) + xtol);
        x = xn;
        r = rn;
        cost = cn;
        lambda = Math.max(lambda / 3, 1e-15);
        accepted = true;
      } else {
        lambda *= 4;
      }
    }
    if (!accepted) {
      converged = true; // no step improves the cost: at a (bounded) minimum
      break;
    }
    J = jacobian(res, x, lo, hi, relStep, r);
  }
  return { x, cost, residual: r, jac: J, iterations: it, converged };
}

export interface ParamStats {
  stderr: number[];
  corr: number[][];
}

/** Approximate standard errors and correlations from s²(JᵀJ)⁻¹ with s² = Σr²/(m − n). */
export function paramStats(J: number[][], residual: number[]): ParamStats {
  const m = residual.length;
  const n = J[0]?.length ?? 0;
  const A = normal(J, n);
  const s2 = residual.reduce((s, v) => s + v * v, 0) / Math.max(m - n, 1);
  let cov: number[][];
  try {
    cov = Array.from({ length: n }, (_, j) => solveReal(A, A.map((_, i) => (i === j ? 1 : 0)))); // columns of A⁻¹; A is symmetric
  } catch (e) {
    if (!(e instanceof SingularMatrixError)) throw e;
    return { stderr: Array(n).fill(Infinity), corr: A.map((row, i) => row.map((_, j) => (i === j ? 1 : Number.NaN))) };
  }
  const stderr = cov.map((row, i) => Math.sqrt(Math.max(row[i] * s2, 0)));
  const corr = cov.map((row, i) => row.map((v, j) => v / Math.sqrt(cov[i][i] * cov[j][j])));
  return { stderr, corr };
}

/** Parameter pairs with |correlation| > limit or an undefined correlation (spec §7: limit 0.95). */
export function illDetermined(corr: number[][], limit = 0.95): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < corr.length; i += 1) {
    for (let j = i + 1; j < corr.length; j += 1) {
      const c = corr[i][j];
      if (!Number.isFinite(c) || Math.abs(c) > limit) out.push([i, j]);
    }
  }
  return out;
}

import { type Complex, abs, div, mul, sub } from './complex.ts';

export class SingularMatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SingularMatrixError';
  }
}

const PIVOT_FLOOR = 1e-14;

/** Solves A x = b for a dense complex matrix by Gaussian elimination with scaled partial pivoting. Inputs are not modified. */
export function solveLinear(A: Complex[][], b: Complex[]): Complex[] {
  const n = b.length;
  const m = A.map((row) => row.slice());
  const r = b.slice();
  const s = m.map((row) => row.reduce((mx, v) => Math.max(mx, abs(v)), 0));
  const zeroRow = s.findIndex((v) => v === 0);
  if (zeroRow >= 0) throw new SingularMatrixError(`row ${zeroRow} is all zero (a floating node)`);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    let best = -1;
    for (let i = k; i < n; i += 1) {
      const v = abs(m[i][k]) / s[i];
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > PIVOT_FLOOR)) throw new SingularMatrixError(`matrix is singular at column ${k}`);
    if (p !== k) {
      [m[k], m[p]] = [m[p], m[k]];
      [r[k], r[p]] = [r[p], r[k]];
      [s[k], s[p]] = [s[p], s[k]];
    }
    for (let i = k + 1; i < n; i += 1) {
      if (m[i][k].re === 0 && m[i][k].im === 0) continue;
      const factor = div(m[i][k], m[k][k]);
      for (let j = k; j < n; j += 1) m[i][j] = sub(m[i][j], mul(factor, m[k][j]));
      r[i] = sub(r[i], mul(factor, r[k]));
    }
  }
  const x: Complex[] = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let acc = r[i];
    for (let j = i + 1; j < n; j += 1) acc = sub(acc, mul(m[i][j], x[j]));
    x[i] = div(acc, m[i][i]);
  }
  return x;
}

/** Real-valued counterpart of solveLinear, used by the least-squares fitter. */
export function solveReal(A: number[][], b: number[]): number[] {
  const n = b.length;
  const m = A.map((row) => row.slice());
  const r = b.slice();
  const s = m.map((row) => row.reduce((mx, v) => Math.max(mx, Math.abs(v)), 0));
  const zeroRow = s.findIndex((v) => v === 0);
  if (zeroRow >= 0) throw new SingularMatrixError(`row ${zeroRow} is all zero`);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    let best = -1;
    for (let i = k; i < n; i += 1) {
      const v = Math.abs(m[i][k]) / s[i];
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > PIVOT_FLOOR)) throw new SingularMatrixError(`matrix is singular at column ${k}`);
    if (p !== k) {
      [m[k], m[p]] = [m[p], m[k]];
      [r[k], r[p]] = [r[p], r[k]];
      [s[k], s[p]] = [s[p], s[k]];
    }
    for (let i = k + 1; i < n; i += 1) {
      if (m[i][k] === 0) continue;
      const factor = m[i][k] / m[k][k];
      for (let j = k; j < n; j += 1) m[i][j] -= factor * m[k][j];
      r[i] -= factor * r[k];
    }
  }
  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let acc = r[i];
    for (let j = i + 1; j < n; j += 1) acc -= m[i][j] * x[j];
    x[i] = acc / m[i][i];
  }
  return x;
}

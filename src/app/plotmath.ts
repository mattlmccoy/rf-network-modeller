import { type Complex, abs, cx } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { gammaFromZ } from '../io/sweep.ts';

export interface XY {
  x: number;
  y: number;
}

/** Canvas position of a reflection coefficient on a Smith chart of the given centre and radius. */
export const smithXY = (g: Complex, cx0: number, cy0: number, radius: number): XY => ({ x: cx0 + g.re * radius, y: cy0 - g.im * radius });

/** Γ along the AIT window's boundary (R = rLo, X = xHi, R = rHi, X = xLo) as a closed loop, for shading on the Smith chart. */
export function windowOutline(w: Window, perEdge = 48): Complex[] {
  const lin = (a: number, b: number, i: number): number => a + ((b - a) * i) / perEdge;
  const z: Complex[] = [];
  for (let i = 0; i <= perEdge; i += 1) z.push(cx(w.rLo, lin(w.xLo, w.xHi, i)));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(lin(w.rLo, w.rHi, i), w.xHi));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(w.rHi, lin(w.xHi, w.xLo, i)));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(lin(w.rHi, w.rLo, i), w.xLo));
  return z.map((zz) => gammaFromZ(zz));
}

export const s11dB = (z: Complex): number => 20 * Math.log10(Math.max(abs(gammaFromZ(z)), 1e-12));

export function vswr(z: Complex): number {
  const m = abs(gammaFromZ(z));
  return m >= 1 ? Number.POSITIVE_INFINITY : (1 + m) / (1 - m);
}

/** Symmetric R/X axis extent: the largest finite |value| + 5 %, kept within 50–500 Ω so resonances do not flatten the plot. */
export function rxExtent(values: number[]): number {
  const m = values.reduce((acc, v) => (Number.isFinite(v) ? Math.max(acc, Math.abs(v)) : acc), 0);
  return Math.min(500, Math.max(50, m * 1.05));
}

/** Indices of f inside [lo, hi]. */
export const spanIndices = (f: number[], lo: number, hi: number): number[] => f.map((_, i) => i).filter((i) => f[i] >= lo && f[i] <= hi);

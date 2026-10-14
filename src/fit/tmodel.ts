import { type Complex, abs, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, unitInputZ } from '../engine/transformer.ts';
import { levenbergMarquardt } from './lm.ts';

export interface TModelOptions {
  n: number;
  fPri: number;
  nP: number;
  nC: number;
  k1?: number;
  fLo?: number;
  fHi?: number;
}

export interface TModelFit {
  unit: Unit;
  load: PlateLoad;
  rmsRel: number;
  cost: number;
  nRes: number;
}

/** Starting points of calib.fit_one_port: (L_leak, L_m, C, Rs, G_core). */
export const TMODEL_STARTS: number[][] = [
  [0.4e-6, 0.3e-6, 19e-12, 0.5, 1e-3], [1.0e-6, 1.2e-6, 20e-12, 1.5, 5e-4], [0.2e-6, 0.15e-6, 25e-12, 0.3, 2e-3],
  [0.4e-6, 0.2e-6, 15e-12, 0.5, 1e-3], [0.6e-6, 0.5e-6, 19e-12, 1.0, 1e-3], [1.1e-6, 0.7e-6, 3e-12, 1.0, 5e-4],
  [2.0e-6, 2.0e-6, 5e-12, 1.0, 3e-4], [0.6e-6, 0.4e-6, 6e-12, 0.8, 5e-4],
];

function build(x: number[], o: TModelOptions): { unit: Unit; load: PlateLoad } {
  const [ll, lm, c, rs, g] = x.map(Math.exp);
  const k1 = o.k1 ?? 0.7;
  return {
    unit: { n: o.n, L_leak: ll, f_pri: o.fPri, L_m: lm, G_core: g, R1: k1 * rs, R2: (1 - k1) * rs * o.n ** 2, C_w: 0, N_p: o.nP, N_c: o.nC },
    load: { C: c, G_cube: 0, G_fix: 0 },
  };
}

/** T-model fit to cap-free one-port data at a fixed leakage split (calib.fit_one_port without fit_g_sec). */
export function fitTModel(f: number[], z: Complex[], o: TModelOptions): TModelFit {
  const lo = o.fLo ?? 2e6;
  const hi = o.fHi ?? 25e6;
  const idx = f.map((_, i) => i).filter((i) => f[i] >= lo && f[i] <= hi);
  const wts = idx.map((i) => 1 / Math.sqrt(abs(z[i]) ** 2 + 1));
  const res = (x: number[]): number[] => {
    const { unit, load } = build(x, o);
    const re: number[] = [];
    const im: number[] = [];
    idx.forEach((i, k) => {
      const e = sub(unitInputZ(unit, load, f[i]), z[i]);
      re.push(e.re * wts[k]);
      im.push(e.im * wts[k]);
    });
    return [...re, ...im];
  };
  let best: { x: number[]; cost: number } | null = null;
  for (const s of TMODEL_STARTS) {
    const r = levenbergMarquardt(res, s.map(Math.log), { maxIter: 300 });
    if (best === null || r.cost < best.cost) best = { x: r.x, cost: r.cost };
  }
  const b = best as { x: number[]; cost: number };
  const nRes = 2 * idx.length;
  return { ...build(b.x, o), cost: b.cost, nRes, rmsRel: Math.sqrt((2 * b.cost) / nRes) };
}

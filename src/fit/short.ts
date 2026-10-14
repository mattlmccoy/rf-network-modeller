import { cx, sub } from '../engine/complex.ts';
import { type Cable, deembed } from '../engine/coax.ts';
import type { Variant } from '../chain/types.ts';
import { type Sweep, zFromGamma } from '../io/sweep.ts';
import { levenbergMarquardt } from './lm.ts';

export interface ShortOptions {
  length: number;
  fitLength: boolean;
  vf?: number;
  z0?: number;
  band?: [number, number];
}

export interface ShortFit {
  length: number;
  L: number;
  rms: number;
}

/** Jumper inductance (and optionally cable length) from a sweep with the coax jumpers shorted at the board (spec §7 stage 0). */
export function fitShort(s: Sweep, o: ShortOptions): ShortFit {
  const [lo, hi] = o.band ?? [2e6, 25e6];
  const idx = s.f.map((_, i) => i).filter((i) => s.f[i] >= lo && s.f[i] <= hi);
  const z = idx.map((i) => zFromGamma(s.gamma[i]));
  const cable = (len: number): Cable => ({ length: len, vf: o.vf ?? 0.7, z0: o.z0 ?? 50, alpha13: 0 });
  const res = (len: number, lnH: number): number[] => {
    const re: number[] = [];
    const im: number[] = [];
    idx.forEach((i, k) => {
      const f = s.f[i];
      const e = sub(deembed(z[k], cable(len), f), cx(0, 2 * Math.PI * f * lnH * 1e-9));
      re.push(e.re);
      im.push(e.im);
    });
    return [...re, ...im];
  };
  const r = o.fitLength
    ? levenbergMarquardt((x) => res(x[0], x[1]), [1.3, 300], { lo: [0.5, 0], hi: [3, 2000] })
    : levenbergMarquardt((x) => res(o.length, x[0]), [300], { lo: [0], hi: [2000] });
  const length = o.fitLength ? r.x[0] : o.length;
  const lnH = o.fitLength ? r.x[1] : r.x[0];
  return { length, L: lnH * 1e-9, rms: Math.sqrt((2 * r.cost) / r.residual.length) };
}

export const variantFromShort = (name: string, fit: ShortFit, vf = 0.7): Variant => ({ name, cable: { length: fit.length, vf, z0: 50, alpha13: 0 }, Lj: fit.L });

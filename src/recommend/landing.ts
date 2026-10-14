import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { nearestIndex } from '../io/sweep.ts';

export const F0 = 13.56e6;
export const NOT_IN_WINDOW = -99;
/** Drift-room search segment (o7_joint.py `seg`: 12.5 < f < 14.6 MHz). */
export const ROOM_SEG: [number, number] = [12.5e6, 14.6e6];

export const inWindow = (z: Complex, w: Window): boolean => z.re >= w.rLo && z.re <= w.rHi && z.im >= w.xLo && z.im <= w.xHi;

export interface Landing {
  z: Complex;
  f: number;
  inWindow: boolean;
  roomUp: number;
  roomDown: number;
}

/** Landing at the grid point nearest 13.56 MHz and the contiguous in-window band around it, in % of 13.56 MHz (spec §9). */
export function landing(f: number[], z: Complex[], w: Window, seg: [number, number] = ROOM_SEG): Landing {
  const k0 = nearestIndex(f, F0);
  const inSeg = (i: number): boolean => f[i] > seg[0] && f[i] < seg[1];
  if (!(inSeg(k0) && inWindow(z[k0], w))) return { z: z[k0], f: f[k0], inWindow: false, roomUp: NOT_IN_WINDOW, roomDown: NOT_IN_WINDOW };
  let hi = k0;
  while (hi + 1 < f.length && inSeg(hi + 1) && inWindow(z[hi + 1], w)) hi += 1;
  let lo = k0;
  while (lo - 1 >= 0 && inSeg(lo - 1) && inWindow(z[lo - 1], w)) lo -= 1;
  return { z: z[k0], f: f[k0], inWindow: true, roomUp: ((f[hi] - F0) / F0) * 100, roomDown: ((F0 - f[lo]) / F0) * 100 };
}

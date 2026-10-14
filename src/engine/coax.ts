import { type Complex, add, cosh, cx, div, inv, isFiniteC, mul, scale, sinh, sub, tanh } from './complex.ts';
import type { Y2 } from './twoport.ts';

export const C0 = 299792458.0;
export const F_REF = 13.56e6;

/** Coax between the AIT output (the VNA calibration plane) and the network input (rfchain.Cable). */
export interface Cable {
  length: number;
  vf: number;
  z0: number;
  alpha13: number;
}

/** γl: attenuation alpha13·sqrt(f/13.56 MHz) [Np] plus jβl (rfchain._gl). */
export const gammaL = (c: Cable, f: number): Complex =>
  cx(c.alpha13 * Math.sqrt(f / F_REF), (2 * Math.PI * f * c.length) / (c.vf * C0));

/** Impedance at the cable input for a load zLoad at the far end (rfchain.embed). An open load is allowed. */
export function embed(zLoad: Complex, c: Cable, f: number): Complex {
  const t = tanh(gammaL(c, f));
  const z0 = cx(c.z0);
  if (!isFiniteC(zLoad)) return div(z0, t);
  return mul(z0, div(add(zLoad, mul(z0, t)), add(z0, mul(zLoad, t))));
}

/** Far-end load from the cable-input impedance (rfchain.deembed). */
export function deembed(zIn: Complex, c: Cable, f: number): Complex {
  const t = tanh(gammaL(c, f));
  const z0 = cx(c.z0);
  return mul(z0, div(sub(zIn, mul(z0, t)), sub(z0, mul(zIn, t))));
}

/** Ground-referenced 2-port admittance of the line: y11 = y22 = coth(γl)/Z0, y12 = y21 = -csch(γl)/Z0. */
export function coaxY(c: Cable, f: number): Y2 {
  const g = gammaL(c, f);
  const coth = div(cosh(g), sinh(g));
  const csch = inv(sinh(g));
  return [scale(coth, 1 / c.z0), scale(csch, -1 / c.z0), scale(csch, -1 / c.z0), scale(coth, 1 / c.z0)];
}

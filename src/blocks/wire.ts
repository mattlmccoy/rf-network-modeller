const MU0 = 4e-7 * Math.PI;
export const RHO_CU = 1.68e-8;

/** Bare-conductor diameter of an AWG gauge [m]. */
export const awgDiameter = (awg: number): number => 0.127e-3 * 92 ** ((36 - awg) / 39);
export const skinDepth = (f: number, rho = RHO_CU): number => Math.sqrt(rho / (Math.PI * f * MU0));

/** High-frequency inductance of a straight round conductor: (μ0/2π)·l·[ln(2l/r) − 1]. An estimate (badge `est`). */
export const straightWireL = (length: number, radius: number): number =>
  (MU0 / (2 * Math.PI)) * length * (Math.log((2 * length) / radius) - 1);

/** AC resistance of `strands` parallel round strands with the current in a skin-depth annulus. An estimate. */
export function wireR(length: number, strandRadius: number, strands: number, f: number, rho = RHO_CU): number {
  const d = skinDepth(f, rho);
  const area = strandRadius > d ? Math.PI * (strandRadius ** 2 - (strandRadius - d) ** 2) : Math.PI * strandRadius ** 2;
  return (rho * length) / (area * strands);
}

export interface WireEstimate {
  L: number;
  R: number;
}

/** Jumper estimate: strands treated as one conductor of radius √N·r for L, N parallel strands for R. */
export function estimateWire(lengthMm: number, awg: number, strands: number, f: number): WireEstimate {
  const len = lengthMm * 1e-3;
  const r = awgDiameter(awg) / 2;
  return { L: straightWireL(len, r * Math.sqrt(strands)), R: wireR(len, r, strands, f) };
}

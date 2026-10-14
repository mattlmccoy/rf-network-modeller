import { type Complex, ONE, ZERO, add, cx, div, inv, mul, neg, sub } from './complex.ts';

/** A 2x2 complex matrix [m11, m12, m21, m22] (row-major): ABCD or Y parameters. */
export type M2 = [Complex, Complex, Complex, Complex];
export type Y2 = M2;

export const mul2 = (p: M2, q: M2): M2 => [
  add(mul(p[0], q[0]), mul(p[1], q[2])),
  add(mul(p[0], q[1]), mul(p[1], q[3])),
  add(mul(p[2], q[0]), mul(p[3], q[2])),
  add(mul(p[2], q[1]), mul(p[3], q[3])),
];
export const seriesZ = (z: Complex): M2 => [ONE, z, ZERO, ONE];
export const shuntY = (y: Complex): M2 => [ONE, ZERO, y, ONE];
export const idealN = (n: number): M2 => [cx(1 / n), ZERO, ZERO, cx(n)];

/** ABCD → Y with both ports referenced to a common ground (rfchain.abcd_to_y). */
export function abcdToY(m: M2): Y2 {
  const [a, b, c, d] = m;
  return [div(d, b), div(sub(mul(b, c), mul(a, d)), b), neg(inv(b)), div(a, b)];
}

/** Impedance into port 1 with port 2 terminated in admittance yl. */
export function zinTerminated(y: Y2, yl: Complex): Complex {
  return inv(sub(y[0], div(mul(y[1], y[2]), add(y[3], yl))));
}

export const addY = (p: Y2, q: Y2): Y2 => [add(p[0], q[0]), add(p[1], q[1]), add(p[2], q[2]), add(p[3], q[3])];

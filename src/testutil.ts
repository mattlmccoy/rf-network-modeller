import assert from 'node:assert/strict';
import type { Complex } from './engine/complex.ts';

/** Passes when |a - b| <= rel * max(|b|, 1), measured on the complex magnitude. */
export function assertClose(a: Complex, b: Complex, rel = 1e-9, msg = ''): void {
  if (a.re === b.re && a.im === b.im) return; // identical, including OPEN (Infinity) values
  const err = Math.hypot(a.re - b.re, a.im - b.im);
  const tol = rel * Math.max(Math.hypot(b.re, b.im), 1);
  assert.ok(err <= tol, `${msg} got ${fmt(a)}, want ${fmt(b)} (|err| ${err.toExponential(2)} > ${tol.toExponential(2)})`);
}

/** Passes when |a - b| <= rel * max(|b|, 1). */
export function assertNear(a: number, b: number, rel = 1e-9, msg = ''): void {
  const tol = rel * Math.max(Math.abs(b), 1);
  assert.ok(Math.abs(a - b) <= tol, `${msg} got ${a}, want ${b}`);
}

export const fmt = (z: Complex): string => `${z.re}${z.im >= 0 ? '+' : '-'}${Math.abs(z.im)}j`;
export const pair = (p: number[]): Complex => ({ re: p[0], im: p[1] });

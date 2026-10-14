/** Complex arithmetic on plain {re, im} objects (rms phasors, e^{jωt}). */
export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const ZERO: Complex = cx(0, 0);
export const ONE: Complex = cx(1, 0);
/** Impedance of an open circuit. */
export const OPEN: Complex = cx(Number.POSITIVE_INFINITY, 0);

export const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const neg = (a: Complex): Complex => cx(-a.re, -a.im);
export const scale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
export const conj = (a: Complex): Complex => cx(a.re, -a.im);
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const mul = (a: Complex, b: Complex): Complex => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const isFiniteC = (a: Complex): boolean => Number.isFinite(a.re) && Number.isFinite(a.im);

/** a / b by Smith's algorithm (no overflow for large or tiny b). b = 0 gives NaN. */
export function div(a: Complex, b: Complex): Complex {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return cx((a.re + a.im * r) / d, (a.im - a.re * r) / d);
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return cx((a.re * r + a.im) / d, (a.im * r - a.re) / d);
}

export const inv = (a: Complex): Complex => div(ONE, a);

export function exp(a: Complex): Complex {
  const m = Math.exp(a.re);
  return cx(m * Math.cos(a.im), m * Math.sin(a.im));
}

export const cosh = (a: Complex): Complex => cx(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im));
export const sinh = (a: Complex): Complex => cx(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im));
export const tanh = (a: Complex): Complex => div(sinh(a), cosh(a));

/** j·2πf·x: the impedance of an inductance x, or the admittance of a capacitance x. */
export const jw = (f: number, x: number): Complex => cx(0, 2 * Math.PI * f * x);

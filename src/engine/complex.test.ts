import assert from 'node:assert/strict';
import test from 'node:test';
import { abs, add, conj, cosh, cx, div, exp, inv, isFiniteC, jw, mul, neg, scale, sinh, sub, tanh } from './complex.ts';
import { assertClose } from '../testutil.ts';

test('field operations', () => {
  const a = cx(3, -4);
  const b = cx(-1.5, 2);
  assertClose(add(a, b), cx(1.5, -2), 1e-15);
  assertClose(sub(a, b), cx(4.5, -6), 1e-15);
  assertClose(mul(a, b), cx(3 * -1.5 - -4 * 2, 3 * 2 + -4 * -1.5), 1e-15);
  assertClose(mul(div(a, b), b), a, 1e-14);
  assertClose(mul(inv(a), a), cx(1, 0), 1e-15);
  assert.equal(abs(a), 5);
  assertClose(conj(a), cx(3, 4), 0);
  assertClose(scale(a, 2), cx(6, -8), 0);
  assertClose(neg(a), cx(-3, 4), 0);
});

test('division stays accurate across 1e-15 .. 1e12 magnitudes', () => {
  const big = cx(1e12, 3e11);
  const tiny = cx(2e-12, -5e-13);
  assertClose(mul(div(big, tiny), tiny), big, 1e-12);
  assertClose(div(cx(1, 1), cx(0, 1e-15)), cx(1e15, -1e15), 1e-12);
});

test('hyperbolic functions', () => {
  assertClose(tanh(cx(0, Math.PI / 4)), cx(0, 1), 1e-12);
  const z = cx(0.3, 1.1);
  assertClose(sub(mul(cosh(z), cosh(z)), mul(sinh(z), sinh(z))), cx(1, 0), 1e-12);
  assertClose(exp(cx(0, Math.PI)), cx(-1, 0), 1e-12);
});

test('jw is j·2πf·x', () => assertClose(jw(13.56e6, 1e-9), cx(0, 2 * Math.PI * 13.56e6 * 1e-9), 1e-15));

test('finite check', () => {
  assert.equal(isFiniteC(cx(1, 2)), true);
  assert.equal(isFiniteC(cx(Infinity, 0)), false);
  assert.equal(isFiniteC(cx(0, Number.NaN)), false);
});

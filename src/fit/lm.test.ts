import assert from 'node:assert/strict';
import test from 'node:test';
import { FitError, illDetermined, levenbergMarquardt, paramStats } from './lm.ts';
import { assertNear } from '../testutil.ts';

test('Rosenbrock least squares converges to (1, 1)', () => {
  const r = levenbergMarquardt((x) => [10 * (x[1] - x[0] ** 2), 1 - x[0]], [-1.2, 1]);
  assertNear(r.x[0], 1, 1e-6);
  assertNear(r.x[1], 1, 1e-6);
  assert.ok(r.cost < 1e-14);
});

test('box bounds are respected', () => {
  const r = levenbergMarquardt((x) => [x[0] - 5, x[1] + 2], [0, 0], { lo: [-10, -1], hi: [3, 10] });
  assertNear(r.x[0], 3, 1e-12);
  assertNear(r.x[1], -1, 1e-12);
});

test('recovers an exponential decay exactly', () => {
  const t = Array.from({ length: 40 }, (_, i) => i * 0.1);
  const y = t.map((v) => 2.5 * Math.exp(-1.3 * v));
  const r = levenbergMarquardt((x) => t.map((v, i) => x[0] * Math.exp(-x[1] * v) - y[i]), [1, 0.5]);
  assertNear(r.x[0], 2.5, 1e-7);
  assertNear(r.x[1], 1.3, 1e-7);
});

test('perfectly correlated parameters are flagged ill-determined', () => {
  const t = [0, 1, 2, 3];
  const r = levenbergMarquardt((x) => t.map(() => x[0] + x[1] - 1), [0.2, 0.3]);
  assert.deepEqual(illDetermined(paramStats(r.jac, r.residual).corr), [[0, 1]]);
});

test('standard errors of a straight-line fit match the textbook formula', () => {
  const t = [0, 1, 2, 3, 4];
  const y = [1.1, 2.9, 5.2, 6.8, 9.1];
  const r = levenbergMarquardt((x) => t.map((v, i) => x[0] + x[1] * v - y[i]), [0, 0]);
  const s = paramStats(r.jac, r.residual);
  const sxx = t.reduce((a, v) => a + (v - 2) ** 2, 0);
  const s2 = r.residual.reduce((a, v) => a + v * v, 0) / (t.length - 2);
  assertNear(s.stderr[1], Math.sqrt(s2 / sxx), 1e-6);
});

test('a parameter pinned at its bound does not stall the others (active set)', () => {
  // x0 wants −5 but is bounded at 0; x1 is tightly coupled to x0. Optimum: x0 = 0, x1 = 1.
  const r = levenbergMarquardt((x) => [100 * (x[1] - x[0] - 1), x[0] + 5], [0.5, 0], { lo: [0, -10], hi: [10, 10], maxIter: 50 });
  assertNear(r.x[0], 0, 1e-9);
  assertNear(r.x[1], 1, 1e-6);
  assert.ok(r.converged, `not converged after ${r.iterations} iterations`);
});

test('fewer residuals than parameters is a FitError (final review I5)', () => {
  assert.throws(() => levenbergMarquardt(() => [], [1, 2]), FitError);
  assert.throws(() => levenbergMarquardt((x) => [x[0] + x[1]], [1, 2]), FitError);
});

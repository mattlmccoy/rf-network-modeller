import assert from 'node:assert/strict';
import test from 'node:test';
import { type Complex, add, cx, mul } from './complex.ts';
import { SingularMatrixError, solveLinear, solveReal } from './linsolve.ts';
import { assertClose, assertNear } from '../testutil.ts';

const times = (A: Complex[][], x: Complex[]): Complex[] => A.map((row) => row.reduce((acc, a, j) => add(acc, mul(a, x[j])), cx(0)));

test('solves a 3x3 complex system to round-off', () => {
  const A = [[cx(4, 1), cx(-2), cx(1, -1)], [cx(-2), cx(5, 2), cx(0, 3)], [cx(1, -1), cx(0, 3), cx(6, -1)]];
  const xTrue = [cx(1, -2), cx(0.5, 0.25), cx(-3, 1)];
  solveLinear(A, times(A, xTrue)).forEach((x, i) => assertClose(x, xTrue[i], 1e-12));
});

test('pivots past a zero leading entry', () => {
  const x = solveLinear([[cx(0), cx(1)], [cx(1), cx(0)]], [cx(2), cx(3)]);
  assertClose(x[0], cx(3), 1e-15);
  assertClose(x[1], cx(2), 1e-15);
});

test('mixed row scales (1e-12 and 1e4) still solve', () => {
  const A = [[cx(1e-12, 2e-12), cx(3e-12)], [cx(1e4), cx(-2e4, 5e3)]];
  const xTrue = [cx(0.7, -0.1), cx(-1.2, 0.4)];
  solveLinear(A, times(A, xTrue)).forEach((x, i) => assertClose(x, xTrue[i], 1e-10));
});

test('does not modify its inputs', () => {
  const A = [[cx(2), cx(1)], [cx(1), cx(3)]];
  const b = [cx(1), cx(2)];
  const copy = JSON.stringify([A, b]);
  solveLinear(A, b);
  assert.equal(JSON.stringify([A, b]), copy);
});

test('throws SingularMatrixError on a singular matrix and on an all-zero row', () => {
  assert.throws(() => solveLinear([[cx(1), cx(2)], [cx(2), cx(4)]], [cx(1), cx(1)]), SingularMatrixError);
  assert.throws(() => solveLinear([[cx(1), cx(2)], [cx(0), cx(0)]], [cx(1), cx(1)]), SingularMatrixError);
});

test('solveReal solves a real system and refuses a singular one', () => {
  const x = solveReal([[4, -2, 1], [-2, 5, 3], [1, 3, 6]], [3, 1, 2]);
  const back = [[4, -2, 1], [-2, 5, 3], [1, 3, 6]].map((r) => r.reduce((s, a, j) => s + a * x[j], 0));
  back.forEach((v, i) => assertNear(v, [3, 1, 2][i], 1e-12));
  assert.throws(() => solveReal([[1, 2], [2, 4]], [1, 1]), SingularMatrixError);
});

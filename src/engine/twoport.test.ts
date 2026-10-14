import test from 'node:test';
import { add, cx, inv, scale } from './complex.ts';
import { abcdToY, idealN, mul2, seriesZ, shuntY, zinTerminated } from './twoport.ts';
import { assertClose } from '../testutil.ts';

test('series Z converts to Y = [1/Z, -1/Z, -1/Z, 1/Z]', () => {
  const z = cx(3, 4);
  const y = abcdToY(seriesZ(z));
  assertClose(y[0], inv(z), 1e-15);
  assertClose(y[1], scale(inv(z), -1), 1e-15);
  assertClose(y[2], scale(inv(z), -1), 1e-15);
  assertClose(y[3], inv(z), 1e-15);
});

test('series Z terminated by R reads Z + R', () => {
  assertClose(zinTerminated(abcdToY(seriesZ(cx(3, 4))), inv(cx(10))), cx(13, 4), 1e-14);
});

test('series z1, ideal 1:n, series z2 into R reads z1 + (z2 + R)/n²', () => {
  const z1 = cx(0.5, 2);
  const z2 = cx(4, 30);
  const m = [seriesZ(z1), idealN(3), seriesZ(z2)].reduce(mul2);
  assertClose(zinTerminated(abcdToY(m), inv(cx(90))), add(z1, scale(add(z2, cx(90)), 1 / 9)), 1e-13);
});

test('shunt Y in a cascade adds admittance', () => {
  const m = [seriesZ(cx(1, 0)), shuntY(cx(0, 0.02))].reduce(mul2);
  assertClose(zinTerminated(abcdToY(m), cx(0.01)), add(cx(1), inv(cx(0.01, 0.02))), 1e-13);
});

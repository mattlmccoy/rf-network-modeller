import assert from 'node:assert/strict';
import test from 'node:test';
import { ONE, OPEN, cx } from '../engine/complex.ts';
import { bandIndices, gammaFromZ, interpClamp, nearestIndex, zFromGamma } from './sweep.ts';
import { assertClose, loadFixtureSweep } from '../testutil.ts';

test('Γ ↔ Z round trip, with open and Γ = 1 handled', () => {
  const z = cx(7.81, 27.89);
  assertClose(zFromGamma(gammaFromZ(z)), z, 1e-12);
  assertClose(gammaFromZ(OPEN), ONE, 0);
  assertClose(zFromGamma(ONE), OPEN, 0);
});

test('interpClamp matches np.interp: nodes exact, linear between, clamped outside', () => {
  const xs = [10, 20, 30];
  const ys = [1, 3, 2];
  assert.equal(interpClamp(xs, ys, 20), 3);
  assert.equal(interpClamp(xs, ys, 15), 2);
  assert.equal(interpClamp(xs, ys, 5), 1);
  assert.equal(interpClamp(xs, ys, 35), 2);
});

test('nearestIndex returns the first minimum; bandIndices is strict', () => {
  assert.equal(nearestIndex([1, 2, 3, 4], 2.5), 1);
  assert.deepEqual(bandIndices([12.0e6, 12.5e6, 14.6e6, 14.0e6], 12.0e6, 14.6e6), [1, 3]);
});

test('the real 80/200 sweep lands at 5.03 + j4.30 Ω at 13.56 MHz (spec §14)', () => {
  const s = loadFixtureSweep('s80', 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p');
  const k = nearestIndex(s.f, 13.56e6);
  assert.ok(Math.abs(s.f[k] - 13.5622e6) < 100);
  const z = zFromGamma(s.gamma[k]);
  assert.ok(Math.abs(z.re - 5.03) < 0.005 && Math.abs(z.im - 4.3) < 0.005, `${z.re} ${z.im}`);
});

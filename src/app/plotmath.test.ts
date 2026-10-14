import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN, cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { gammaFromZ } from '../io/sweep.ts';
import { rectValue, rxExtent, s11dB, smithXY, spanIndices, vswr, windowOutline } from './plotmath.ts';
import { assertClose, assertNear } from '../testutil.ts';

test('the AIT window outline is a closed loop inside the unit circle starting at 5 + j6', () => {
  const g = windowOutline(AIT_WINDOW, 4);
  assert.equal(g.length, 17);
  assertClose(g[0], gammaFromZ(cx(5, 6)), 1e-12);
  assertClose(g[16], g[0], 1e-12);
  assert.ok(g.every((x) => Math.hypot(x.re, x.im) < 1));
});

test('S11 in dB and VSWR', () => {
  assertNear(s11dB(cx(150)), 20 * Math.log10(0.5), 1e-12);
  assertNear(s11dB(cx(50)), -240, 1e-9);
  assertNear(vswr(cx(150)), 3, 1e-12);
  assert.equal(vswr(OPEN), Number.POSITIVE_INFINITY);
});

test('smithXY: Γ = 0 at the centre, Γ = +j at the top', () => {
  assert.deepEqual(smithXY(cx(0), 100, 80, 50), { x: 100, y: 80 });
  assert.deepEqual(smithXY(cx(0, 1), 100, 80, 50), { x: 100, y: 30 });
});

test('R/X extent stays between 50 and 500 Ω and ignores non-finite values', () => {
  assert.equal(rxExtent([1, -2, Number.NaN]), 50);
  assertNear(rxExtent([100, -300]), 315, 1e-12);
  assert.equal(rxExtent([716, 3e4, Number.POSITIVE_INFINITY]), 500);
});

test('spanIndices keeps the points inside [lo, hi]', () => assert.deepEqual(spanIndices([9e6, 10e6, 13e6, 17e6, 18e6], 10e6, 17e6), [1, 2, 3]));

test('rectangular panes gap an open or invalid Z instead of drawing 0 Ω or a pinned VSWR (final review I3)', () => {
  assert.ok(Number.isNaN(rectValue('x', OPEN)) && Number.isNaN(rectValue('r', OPEN)) && Number.isNaN(rectValue('vswr', OPEN)));
  assert.equal(rectValue('s11db', OPEN), 0);
  assert.ok(Number.isNaN(rectValue('s11db', cx(Number.NaN, Number.NaN))));
  assert.equal(rectValue('x', cx(7, 18)), 18);
  assertNear(rectValue('vswr', cx(150)), 3, 1e-12);
});

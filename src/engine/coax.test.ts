import test from 'node:test';
import { OPEN, cx, div, inv, tanh } from './complex.ts';
import { C0, type Cable, coaxY, deembed, embed, gammaL } from './coax.ts';
import { zinTerminated } from './twoport.ts';
import { assertClose } from '../testutil.ts';

const lossy: Cable = { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0.0073 };

test('a matched load is unchanged by a lossless line', () => {
  assertClose(embed(cx(50), { ...lossy, alpha13: 0 }, 13.56e6), cx(50), 1e-12);
});

test('a quarter-wave line inverts impedance', () => {
  const f = 13.56e6;
  const quarter: Cable = { length: (0.7 * C0) / (4 * f), vf: 0.7, z0: 50, alpha13: 0 };
  assertClose(embed(cx(10, 5), quarter, f), div(cx(2500), cx(10, 5)), 1e-9);
});

test('deembed undoes embed on a lossy line', () => {
  const z = cx(7.8, 27.9);
  assertClose(deembed(embed(z, lossy, 13.56e6), lossy, 13.56e6), z, 1e-10);
});

test('the 2-port Y terminated by a load equals embed', () => {
  const zl = cx(12, -30);
  assertClose(zinTerminated(coaxY(lossy, 9e6), inv(zl)), embed(zl, lossy, 9e6), 1e-10);
});

test('an open far end reads Z0·coth(γl)', () => {
  assertClose(embed(OPEN, lossy, 5e6), div(cx(50), tanh(gammaL(lossy, 5e6))), 1e-12);
});

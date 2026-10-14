import test from 'node:test';
import { awgDiameter, estimateWire, skinDepth, straightWireL } from './wire.ts';
import { assertNear } from '../testutil.ts';

test('14 AWG is 1.628 mm', () => assertNear(awgDiameter(14) * 1e3, 1.628, 3e-3));
test('copper skin depth at 13.56 MHz is 17.7 µm', () => assertNear(skinDepth(13.56e6) * 1e6, 17.7, 5e-3));
test('a 100 mm, 1 mm-radius straight wire is 86.0 nH', () => assertNear(straightWireL(0.1, 1e-3) * 1e9, 85.97, 1e-3));
test('a 100 mm single 14 AWG wire is about 18.8 mΩ at 13.56 MHz', () => assertNear(estimateWire(100, 14, 1, 13.56e6).R * 1e3, 18.76, 1e-2));

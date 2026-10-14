import test from 'node:test';
import { conj, cx, mul } from './complex.ts';
import { type PlateLoad, type Unit, bPeak_mT, inputImpedanceUnits, solveTransformer, unitInputZ } from './transformer.ts';
import { assertClose, assertNear } from '../testutil.ts';

const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0.2, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };

test('the ABCD cascade equals the closed-form T-model', () => {
  for (const f of [1e6, 9e6, 13.56e6, 25e6]) assertClose(inputImpedanceUnits([u], load, f), unitInputZ(u, load, f), 1e-10, `f=${f}`);
});

test('a near-ideal unit maps a resistive load by 1/n²', () => {
  const ideal: Unit = { ...u, L_leak: 0, L_m: 1e3, G_core: 0, R1: 1e-6, R2: 1e-6, C_w: 0 };
  assertClose(inputImpedanceUnits([ideal], { C: 0, G_cube: 1 / 2500, G_fix: 0 }, 13.56e6), cx(100), 1e-6);
});

test('peak flux formula (rfchain.b_peak_mT)', () => assertNear(bPeak_mT(10, 2, 2, 13.56e6), 0.262639, 1e-5));

test('power into the primary equals copper + core + plate losses', () => {
  const f = 13.56e6;
  const v1 = cx(120, 30);
  const st = solveTransformer([u, { ...u, R2: 6 }], load, f, v1);
  const pin = mul(v1, conj(st.i1_total)).re;
  const ploss = st.units.reduce((a, s) => a + s.p_r1 + s.p_core + s.p_r2, 0) + st.p_cube + st.p_fix;
  assertNear(pin, ploss, 1e-9);
});

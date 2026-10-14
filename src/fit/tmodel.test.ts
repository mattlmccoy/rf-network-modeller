import assert from 'node:assert/strict';
import test from 'node:test';
import { abs, cx, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, unitInputZ } from '../engine/transformer.ts';
import { buildBranchTable } from '../chain/blockZ.ts';
import { DEFAULT_VARIANTS, O7_FILES } from '../chain/presets.ts';
import { nearestIndex } from '../io/sweep.ts';
import { fitTModel } from './tmodel.ts';
import { loadFixtureSweep, readFixtureJson } from '../testutil.ts';

const tm = readFixtureJson<{ tmodel: { unit: Unit; load: PlateLoad; cost: number; n_res: number } }>('tmodel_short.json').tmodel;
const rel = (a: number, b: number): number => Math.abs(a / b - 1);

test('recovers a known T-model from synthetic data', () => {
  const rs = 1.3;
  const truth: Unit = { n: 5, L_leak: 1.1e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.7 * rs, R2: 0.3 * rs * 25, C_w: 0, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0, G_fix: 0 };
  const f = Array.from({ length: 231 }, (_, i) => 2e6 + i * 0.1e6);
  const fit = fitTModel(f, f.map((x) => unitInputZ(truth, load, x)), { n: 5, fPri: 0, nP: 3, nC: 4 });
  assert.ok(fit.rmsRel < 1e-6, `rms_rel ${fit.rmsRel}`);
  for (const k of ['L_leak', 'L_m', 'G_core', 'R1', 'R2'] as const) assert.ok(rel(fit.unit[k], truth[k]) < 1e-4, `${k} ${fit.unit[k]} vs ${truth[k]}`);
  assert.ok(rel(fit.load.C, load.C) < 1e-4);
});

test('matches calib.fit_one_port on the real O7 cap-free sweep (cost within 2 %)', () => {
  const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const t = buildBranchTable(capFree, DEFAULT_VARIANTS[0]);
  const fit = fitTModel(capFree.f, t.re.map((re, i) => cx(re, t.im[i])), { n: 5, fPri: 0, nP: 3, nC: 4 });
  assert.equal(fit.nRes, tm.n_res);
  assert.ok(fit.cost <= tm.cost * 1.02, `cost ${fit.cost} vs Python ${tm.cost}`);
  const k = nearestIndex(capFree.f, 13.56e6);
  const zTs = unitInputZ(fit.unit, fit.load, capFree.f[k]);
  const zPy = unitInputZ(tm.unit, tm.load, capFree.f[k]);
  assert.ok(abs(sub(zTs, zPy)) <= 0.02 * abs(zPy), `Z(13.56) ${zTs.re}+${zTs.im}j vs ${zPy.re}+${zPy.im}j`);
});

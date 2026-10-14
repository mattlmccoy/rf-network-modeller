import { type Complex, abs, add, cx, div, inv, mul, scale, sub } from './complex.ts';
import { type M2, type Y2, abcdToY, addY, idealN, mul2, seriesZ, shuntY, zinTerminated } from './twoport.ts';

/** Fair-Rite 5967003801 effective area [m²] (rfchain.A_E). */
export const A_E = 1.58e-4;

/** One transformer unit, T-model with leakage referred to the primary (rfchain.Unit). */
export interface Unit {
  n: number;
  L_leak: number;
  f_pri: number;
  L_m: number;
  G_core: number;
  R1: number;
  R2: number;
  C_w: number;
  N_p: number;
  N_c: number;
}

/** Secondary-side plate load (rfchain.PlateLoad). */
export interface PlateLoad {
  C: number;
  G_cube: number;
  G_fix: number;
}

const w = (f: number): number => 2 * Math.PI * f;
const z1 = (u: Unit, f: number): Complex => cx(u.R1, w(f) * u.f_pri * u.L_leak);
const ym = (u: Unit, f: number): Complex => cx(u.G_core, -1 / (w(f) * u.L_m));
const z2 = (u: Unit, f: number): Complex => cx(u.R2, w(f) * (1 - u.f_pri) * u.L_leak * u.n ** 2);
const yw = (u: Unit, f: number): Complex => cx(0, w(f) * u.C_w);

/** ABCD of one unit: series z1, shunt ym, ideal 1:n, series z2, shunt C_w (rfchain.unit_abcd). */
export function unitAbcd(u: Unit, f: number): M2 {
  return [seriesZ(z1(u, f)), shuntY(ym(u, f)), idealN(u.n), seriesZ(z2(u, f)), shuntY(yw(u, f))].reduce(mul2);
}

export const unitY = (u: Unit, f: number): Y2 => abcdToY(unitAbcd(u, f));
export const loadAdmittance = (l: PlateLoad, f: number): Complex => cx(l.G_cube + l.G_fix, w(f) * l.C);

/** Primary-side input impedance of paralleled units terminated by the plate load (rfchain.input_impedance). */
export function inputImpedanceUnits(units: Unit[], load: PlateLoad, f: number): Complex {
  const y = units.map((u) => unitY(u, f)).reduce(addY);
  return zinTerminated(y, loadAdmittance(load, f));
}

/** Closed-form input impedance of one unit and its load: the fast path for the T-model fitter. */
export function unitInputZ(u: Unit, load: PlateLoad, f: number): Complex {
  const zSecRef = scale(add(z2(u, f), inv(add(yw(u, f), loadAdmittance(load, f)))), 1 / u.n ** 2);
  return add(z1(u, f), inv(add(ym(u, f), inv(zSecRef))));
}

export interface UnitState {
  i1: Complex;
  vm: Complex;
  i_r2: Complex;
  p_r1: number;
  p_core: number;
  p_r2: number;
  b_pk_mT: number;
  v_loop_rms: number;
}

export interface TransformerState {
  v1: Complex;
  v2: Complex;
  i1_total: Complex;
  p_cube: number;
  p_fix: number;
  units: UnitState[];
}

/** Peak flux density per core for an rms voltage across nTurns encircling nCores stacked cores (rfchain.b_peak_mT). */
export const bPeak_mT = (vTurnRms: number, nTurns: number, nCores: number, f: number, aE = A_E): number =>
  ((Math.SQRT2 * vTurnRms) / (2 * Math.PI * f * nTurns * nCores * aE)) * 1e3;

/** Currents, losses, flux and 1-turn loop voltage of one unit for terminal voltages v1 and v2 (rfchain.solve_transformer). */
export function unitState(u: Unit, y: Y2, f: number, v1: Complex, v2: Complex): UnitState {
  const i1 = add(mul(y[0], v1), mul(y[1], v2));
  const vm = sub(v1, mul(i1, z1(u, f)));
  const iIntoPort2 = add(mul(y[2], v1), mul(y[3], v2));
  const i_r2 = add(scale(iIntoPort2, -1), mul(cx(0, w(f) * u.C_w), v2));
  const vmAbs = abs(vm);
  return {
    i1, vm, i_r2,
    p_r1: abs(i1) ** 2 * u.R1,
    p_core: vmAbs ** 2 * u.G_core,
    p_r2: abs(i_r2) ** 2 * u.R2,
    b_pk_mT: bPeak_mT(vmAbs, u.N_p, u.N_c, f),
    v_loop_rms: vmAbs / (u.N_p * u.N_c),
  };
}

/** Secondary voltage and per-unit states for a primary-node voltage v1 (rfchain.solve_transformer). */
export function solveTransformer(units: Unit[], load: PlateLoad, f: number, v1: Complex): TransformerState {
  const ys = units.map((u) => unitY(u, f));
  const y = ys.reduce(addY);
  const v2 = div(mul(scale(y[2], -1), v1), add(y[3], loadAdmittance(load, f)));
  const states = units.map((u, k) => unitState(u, ys[k], f, v1, v2));
  const i1_total = states.reduce((acc, s) => add(acc, s.i1), cx(0));
  const v2a = abs(v2);
  return { v1, v2, i1_total, p_cube: v2a ** 2 * load.G_cube, p_fix: v2a ** 2 * load.G_fix, units: states };
}

import type { Unit } from '../engine/transformer.ts';

/** A stack to estimate from its turns and cores (model/design.py Design, without the C+D `ref` branch). */
export interface Design {
  N_p: number;
  N_s: number;
  N_c: number;
  strap: boolean;
}

/** The subset of model/design.py Consts that make_unit uses. */
export interface Consts {
  AL13: number;
  L_air_t2: number;
  leak_a: number;
  leak_b: number;
  leak_mult: number;
  leak_gamma: number;
  c_w_cd: number;
  c_w_gamma: number;
  R1_fix: number;
  r1_per_mm: number;
  strap_factor: number;
  R2_fix: number;
  r2_per_mm: number;
}

export const DESIGN_CONSTS: Consts = {
  AL13: 72e-9, L_air_t2: 0.0175e-6, leak_a: 0.163e-6, leak_b: 1.436e-9, leak_mult: 1.0, leak_gamma: 2.0,
  c_w_cd: 0.2e-12, c_w_gamma: 1.5, R1_fix: 0.1, r1_per_mm: 1.5e-4, strap_factor: 0.35, R2_fix: 0.05, r2_per_mm: 6.0e-4,
};

export const CORE_RADIAL_MM = 12.8;
export const CORE_H_MM = 12.85;
export const SPACER_MM = 1.6;

/** Length of one turn around a stack of n_c cores (design.turn_length_mm). */
export const turnLengthMm = (n_c: number): number => 2 * (CORE_RADIAL_MM + n_c * CORE_H_MM + (n_c - 1) * SPACER_MM);

/** Secondary-side leakage [H] (design.l2_secondary). */
export const l2Secondary = (n_s: number, n_c: number, k: Consts): number =>
  k.leak_mult * 18 ** 2 * (n_s / 18) ** k.leak_gamma * (k.leak_a + k.leak_b * turnLengthMm(n_c));

/** T-model unit from turns and cores via the scaling laws calibrated on the measured builds (design.make_unit). */
export function estimateUnit(d: Design, k: Consts = DESIGN_CONSTS): Unit {
  const lt = turnLengthMm(d.N_c);
  const n = d.N_s / d.N_p;
  const r1 = k.R1_fix + k.r1_per_mm * d.N_p * lt * (d.strap ? k.strap_factor : 1.0);
  const r2 = k.R2_fix + k.r2_per_mm * d.N_s * lt;
  const c_w = k.c_w_cd * (d.N_s / 18) * (lt / turnLengthMm(2)) ** k.c_w_gamma;
  const l_m = d.N_p ** 2 * (d.N_c * k.AL13 + k.L_air_t2);
  return { n, L_leak: l2Secondary(d.N_s, d.N_c, k) / n ** 2, f_pri: 0, L_m: l_m, G_core: 0, R1: r1, R2: r2, C_w: c_w, N_p: d.N_p, N_c: d.N_c };
}

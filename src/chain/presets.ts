import { type Counts, counts } from '../blocks/ht50.ts';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import type { ParamRef } from '../fit/params.ts';
import type { StateOverrides } from './state.ts';
import { type Chain, type Variant, type Window, param } from './types.ts';

/** AIT good window at the AIT-out plane (o7_joint.py WIN; the envelope of C+D's good states, not an AIT reach limit). */
export const AIT_WINDOW: Window = { rLo: 5, rHi: 17, xLo: 6, xHi: 48 };

/** Cable / jumper pairs the shorted-jumper sweeps cannot separate (SWEEP_NOTES.md L142, L353, L408). */
export const DEFAULT_VARIANTS: Variant[] = [
  { name: '1.245 m + 342 nH', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 342e-9 },
  { name: '1.2825 m + 329 nH', cable: { length: 1.2825, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 329e-9 },
  { name: '1.5094 m + 256 nH', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 256e-9, flag: 'poor fit to the shorted-jumper sweep' },
];

/** The 2026-10-13 sweeps in fixtures/sweeps, by role. */
export const O7_FILES = {
  capFree: 'noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_nanovna-sweep-1791927664566.s1p',
  s130_230: 'noAIT_130ser_230sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791930836256.s1p',
  s100_200: 'noAIT_100ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931275980.s1p',
  s80_200: 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p',
  s80_200_loop: 'noAIT_sense-loop_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791932761517.s1p',
  s80_180_loop: 'noAIT_sense-loop_80ser_180sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791933400391.s1p',
  shortNew: 'coax-jumpers-shorted_for_both_trans_nanovna-sweep-1791928236499.s1p',
  shortOld: 'coax-jumpers-shorted_nanovna-sweep-1791923630763.s1p',
  cdNet: '2026-10-01_NET_218_CD_100s_3x100+30p_10-18M_PRE-loop_nanovna-sweep-1790884838445.s1p',
} as const;

/** O7 parallel 3:15 as built 2026-10-14, measured-branch mode, with o7_joint.py's starting values and bounds (spec §5). */
export function o7Chain(capFreeSweepId: string): Chain {
  return {
    name: 'O7 parallel 3:15',
    blocks: [
      { id: 'coax', label: 'Cage coax', type: 'coax' },
      { id: 'ser', label: 'Series bank', type: 'capBank', counts: counts(0, 1, 1), customPf: 0, nSeries: 1, slots: 2, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true },
      { id: 'Ls', label: 'Wiring inductance', type: 'inductor', L: param(300e-9, 'typed', true, 150e-9, 700e-9), R: 0 },
      { id: 'shuntArm', label: 'Shunt bank arm', type: 'shunt', chain: [
        { id: 'sh', label: 'Shunt bank', type: 'capBank', counts: counts(1, 1, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true },
      ] },
      { id: 'branchArm', label: 'Transformer arm', type: 'shunt', chain: [
        { id: 'Lb', label: 'Loop inductance', type: 'inductor', L: param(150e-9, 'typed', true, -100e-9, 600e-9), R: 0 },
        { id: 'branch', label: 'Transformer pair + plates', type: 'measuredBranch', sweepId: capFreeSweepId,
          kr: param(1, 'typed', true, 0.2, 3), d: param(0, 'typed', true, -2, 4), dLb: param(0, 'typed', false, -200e-9, 400e-9), loop: true },
      ] },
    ],
  };
}

/** Sweep state for the O7 chain: series and shunt bank counts and whether the sense loop was on. */
export const o7State = (series: Counts, shunt: Counts, loop: boolean): StateOverrides => ({ ser: { counts: series }, sh: { counts: shunt }, branch: { loop } });

/** The stage-2 parameters of o7_joint.py in its order: Ls [nH], Lb [nH], Cs scale, Cp scale, branch-R scale. */
export const O7_REFS: ParamRef[] = [{ blockId: 'Ls', key: 'L' }, { blockId: 'Lb', key: 'L' }, { blockId: 'ser', key: 'k' }, { blockId: 'sh', key: 'k' }, { blockId: 'branch', key: 'kr' }];
/** The loop-state frequency shift of o7_loopstate.py [%]. */
export const O7_LOOP_REF: ParamRef = { blockId: 'branch', key: 'd' };

/** C+D 2:18 2-core T-model fitted to the 2026-09-30 cap-free sweep (model/builds_fit.json "CD_0930_load|0.0|0.0"). */
export const CD_UNIT: Unit = { n: 9, L_leak: 1.113208956146486e-6, f_pri: 0, L_m: 7.150601144264478e-7, G_core: 1.0715862049721974e-5, R1: 0.49175792144172387, R2: 17.071024987191276, C_w: 0, N_p: 2, N_c: 2 };
export const CD_LOAD: PlateLoad = { C: 2.870361730622903e-12, G_cube: 0, G_fix: 1.3245605682437853e-6 };

/** C+D in T-model mode as run on 2026-10-01: series 100 pF, shunt 3 × 100 + 30 pF, no fitted board inductance. */
export function cdChain(): Chain {
  return {
    name: 'C+D 2:18 2-core',
    blocks: [
      { id: 'coax', label: 'Cage coax', type: 'coax' },
      { id: 'ser', label: 'Series bank', type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 2, k: param(1), esr: 0, searchable: true },
      { id: 'Ls', label: 'Wiring inductance', type: 'inductor', L: param(0), R: 0 },
      { id: 'shuntArm', label: 'Shunt bank arm', type: 'shunt', chain: [
        { id: 'sh', label: 'Shunt bank', type: 'capBank', counts: counts(3, 0, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true },
      ] },
      { id: 'Lb', label: 'Loop inductance', type: 'inductor', L: param(0), R: 0 },
      { id: 'stack', label: 'C+D stack', type: 'stack', unit: CD_UNIT, source: 'fit' },
      { id: 'platesArm', label: 'Plates arm', type: 'shunt', chain: [
        { id: 'plates', label: 'Plates + cube', type: 'plates', C: param(CD_LOAD.C, 'fit'), G_cube: param(CD_LOAD.G_cube, 'fit'), G_fix: param(CD_LOAD.G_fix, 'fit') },
      ] },
    ],
  };
}

import type { Complex } from '../engine/complex.ts';
import { CAP_VALUES, type Counts, countsPf } from '../blocks/ht50.ts';
import { type StateOverrides, findBlock } from '../chain/state.ts';
import type { Design } from '../blocks/design.ts';
import type { Block, Chain, Param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';

export interface DisplayUnit {
  scale: number;
  unit: string;
}

const NH: DisplayUnit = { scale: 1e-9, unit: 'nH' };
const PF: DisplayUnit = { scale: 1e-12, unit: 'pF' };

/** Display unit for a parameter; a primitive's value takes its kind's unit. */
export function displayUnit(block: Block, key: ParamKey): DisplayUnit {
  switch (key) {
    case 'L':
    case 'dLb':
      return NH;
    case 'C':
      return PF;
    case 'G_cube':
    case 'G_fix':
      return { scale: 1e-6, unit: 'µS' };
    case 'd':
      return { scale: 0.01, unit: '%' };
    case 'k':
    case 'kr':
      return { scale: 1, unit: '×' };
    case 'value':
      if (block.type === 'primitive' && block.kind === 'C') return PF;
      if (block.type === 'primitive' && block.kind === 'L') return NH;
      return { scale: 1, unit: 'Ω' };
  }
}

/** SI value in display units, rounded to 8 significant figures (300e-9 shows as 300 nH). */
export const toDisplay = (si: number, u: DisplayUnit): number => Number((si / u.scale).toPrecision(8));

/**
 * The SI value to commit for a typed display value, or null when it equals what is shown: a focus and blur with no edit
 * must never retype a fitted value for every variant (final review C1).
 */
export function paramCommit(param: Param, u: DisplayUnit, typed: number): number | null {
  return typed === toDisplay(param.value, u) ? null : typed * u.scale;
}

export const designEquals = (a: Design, b: Design): boolean => a.N_p === b.N_p && a.N_s === b.N_s && a.N_c === b.N_c && a.strap === b.strap;

/** Impedance text; open and invalid never print as numbers. */
export function fmtZ(z: Complex): string {
  if (Number.isNaN(z.re) || Number.isNaN(z.im)) return 'invalid';
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return 'open';
  return `${z.re.toFixed(2)} ${z.im < 0 ? '−' : '+'} j${Math.abs(z.im).toFixed(2)} Ω`;
}

/** Builder readout: resistance and reactance at 3 significant figures with plain names; no finite value prints no number. */
export function plainRX(z: Complex | null): string {
  if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return 'no value at 13.56 MHz';
  return `resistance ${z.re.toPrecision(3)} Ω, reactance ${z.im < 0 ? '−' : '+'}${Math.abs(z.im).toPrecision(3)} Ω`;
}

/** SI value in display units at 4 significant figures, for compact card text. */
const short = (si: number, u: DisplayUnit): number => Number((si / u.scale).toPrecision(4));

export const partsText = (c: Counts): string => CAP_VALUES.filter((v) => c[v] > 0).map((v) => `${c[v]}×${v}`).join(' + ') || 'empty';

/** One-line description of a block for its card. */
export function blockSummary(b: Block): string {
  switch (b.type) {
    case 'capBank': {
      const pf = (countsPf(b.counts) + b.customPf) / b.nSeries;
      const custom = b.customPf ? ` + ${b.customPf} pF` : '';
      return `${partsText(b.counts)}${custom} = ${Number(pf.toPrecision(6))} pF${b.nSeries === 2 ? ' (2 in series)' : ''}`;
    }
    case 'inductor':
      return `${short(b.L.value, NH)} nH`;
    case 'wire':
      return `${b.lengthMm} mm, ${b.awg} AWG ×${b.strands}`;
    case 'measuredBranch':
      return `measured, loop ${b.loop ? 'on' : 'off'}`;
    case 'stack':
      return `${b.unit.N_p}:${Math.round(b.unit.n * b.unit.N_p)}, ${b.unit.N_c} cores`;
    case 'plates':
      return `${short(b.C.value, PF)} pF`;
    case 'primitive': {
      if (b.kind === 'short') return 'short';
      const u = displayUnit(b, 'value');
      return `${short(b.value.value, u)} ${u.unit}`;
    }
    case 'ideal':
      return `1:${b.n}`;
    case 'coax':
      return 'cable from the tuner';
    case 'shunt':
      return 'to ground';
    case 'parallel':
      return `${b.chains.length} arms`;
  }
}

/** A sweep's tagged state as text, e.g. "Series bank 130 pF · Shunt bank 230 pF · loop off". */
export function tagSummary(chain: Chain, state: StateOverrides): string {
  const parts: string[] = [];
  for (const [id, patch] of Object.entries(state)) {
    const b = findBlock(chain, id);
    if (b?.type === 'capBank' && patch.counts) {
      const c = patch.counts as Counts;
      const custom = typeof patch.customPf === 'number' ? patch.customPf : b.customPf;
      const ns = patch.nSeries === 2 ? 2 : patch.nSeries === 1 ? 1 : b.nSeries;
      parts.push(`${b.label} ${Number(((countsPf(c) + custom) / ns).toPrecision(6))} pF`);
    }
    if (b?.type === 'measuredBranch' && typeof patch.loop === 'boolean') parts.push(`sense loop ${patch.loop ? 'on' : 'off'}`);
  }
  return parts.join(' · ');
}

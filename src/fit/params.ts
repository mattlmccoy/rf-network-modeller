import { allBlocks, findBlock, updateBlock } from '../chain/state.ts';
import type { Badge, Chain, Param } from '../chain/types.ts';

export type ParamKey = 'L' | 'k' | 'kr' | 'd' | 'dLb' | 'C' | 'G_cube' | 'G_fix' | 'value';
export interface ParamRef {
  blockId: string;
  key: ParamKey;
}

/** Fit variable = SI value / unit, so the optimiser works in nH, %, pF and µS, as the Python recipes do. */
export const FIT_UNIT: Readonly<Record<ParamKey, number>> = { L: 1e-9, k: 1, kr: 1, d: 0.01, dLb: 1e-9, C: 1e-12, G_cube: 1e-6, G_fix: 1e-6, value: 1 };
const KEYS = Object.keys(FIT_UNIT) as ParamKey[];

export function getParam(chain: Chain, ref: ParamRef): Param {
  const b = findBlock(chain, ref.blockId) as unknown as Record<string, unknown> | undefined;
  const p = b?.[ref.key] as Param | undefined;
  if (!p || typeof p.value !== 'number') throw new Error(`block "${ref.blockId}" has no parameter "${ref.key}"`);
  return p;
}

/** Fit unit for a reference: a primitive's `value` takes its kind's unit (C in pF, L in nH, R in Ω). */
export function unitOf(chain: Chain, ref: ParamRef): number {
  if (ref.key !== 'value') return FIT_UNIT[ref.key];
  const b = findBlock(chain, ref.blockId);
  if (b?.type === 'primitive') return b.kind === 'C' ? 1e-12 : b.kind === 'L' ? 1e-9 : 1;
  return FIT_UNIT.value;
}

export function withParamValue(chain: Chain, ref: ParamRef, value: number, badge?: Badge): Chain {
  const p = getParam(chain, ref);
  return updateBlock(chain, ref.blockId, { [ref.key]: { ...p, value, badge: badge ?? p.badge } });
}

export function toFitVars(chain: Chain, refs: ParamRef[]): { x: number[]; lo: number[]; hi: number[] } {
  const ps = refs.map((r) => ({ p: getParam(chain, r), u: unitOf(chain, r) }));
  return { x: ps.map(({ p, u }) => p.value / u), lo: ps.map(({ p, u }) => p.lo / u), hi: ps.map(({ p, u }) => p.hi / u) };
}

export const fromFitVars = (chain: Chain, refs: ParamRef[], x: number[], badge: Badge = 'fit'): Chain =>
  refs.reduce((c, r, i) => withParamValue(c, r, x[i] * unitOf(c, r), badge), chain);

/** Every parameter marked free, in chain order. */
export function freeRefs(chain: Chain): ParamRef[] {
  return allBlocks(chain.blocks).flatMap((b) => {
    const rec = b as unknown as Record<string, unknown>;
    return KEYS.filter((k) => (rec[k] as Param | undefined)?.free === true).map((k) => ({ blockId: b.id, key: k }));
  });
}

export const refName = (r: ParamRef): string => `${r.blockId}.${r.key}`;

import type { Complex } from '../engine/complex.ts';
import type { Cable } from '../engine/coax.ts';
import type { Unit } from '../engine/transformer.ts';
import type { Counts } from '../blocks/ht50.ts';
import type { Design } from '../blocks/design.ts';
import type { Sweep } from '../io/sweep.ts';

/** Where a number came from: fitted to sweeps, estimated from geometry, or typed by the user (spec §5). */
export type Badge = 'fit' | 'est' | 'typed';

/** A numeric block parameter in SI units, with its fit bounds. */
export interface Param {
  value: number;
  badge: Badge;
  free: boolean;
  lo: number;
  hi: number;
}

export const param = (value: number, badge: Badge = 'typed', free = false, lo = -Infinity, hi = Infinity): Param => ({ value, badge, free, lo, hi });

interface Base {
  id: string;
  label: string;
}

export interface CoaxBlock extends Base { type: 'coax' }
export interface CapBankBlock extends Base {
  type: 'capBank';
  counts: Counts;
  customPf: number;
  nSeries: 1 | 2;
  slots: number;
  k: Param;
  esr: number;
  searchable: boolean;
}
export interface InductorBlock extends Base { type: 'inductor'; L: Param; R: number }
export interface WireBlock extends Base { type: 'wire'; lengthMm: number; awg: number; strands: number }
export interface MeasuredBranchBlock extends Base {
  type: 'measuredBranch'; sweepId: string; kr: Param; d: Param; dLb: Param; loop: boolean;
  /** Turns and cores of the measured transformer; only flux needs them (spec §8.3). */
  transformer?: { nP: number; nS: number; nC: number };
}
export interface StackBlock extends Base { type: 'stack'; unit: Unit; source: 'preset' | 'estimate' | 'fit'; design?: Design }
export interface PlatesBlock extends Base { type: 'plates'; C: Param; G_cube: Param; G_fix: Param }
export interface PrimitiveBlock extends Base { type: 'primitive'; kind: 'R' | 'L' | 'C' | 'short'; value: Param }
export interface IdealBlock extends Base { type: 'ideal'; n: number }
/** A sub-chain from the current node whose far end is tied to ground. */
export interface ShuntBlock extends Base { type: 'shunt'; chain: Block[] }
/** Sub-chains that start at the current node and end on one shared node. */
export interface ParallelBlock extends Base { type: 'parallel'; chains: Block[][] }

export type TwoTerminalBlock = CapBankBlock | InductorBlock | WireBlock | MeasuredBranchBlock | PlatesBlock | PrimitiveBlock;
export type Block = CoaxBlock | TwoTerminalBlock | StackBlock | IdealBlock | ShuntBlock | ParallelBlock;

/** Blocks from the port outward; the main chain's far end is left open. */
export interface Chain {
  name: string;
  blocks: Block[];
}

/** Parameters the sweeps cannot separate; used both to de-embed the measured branch and to embed predictions (spec §8). */
export interface Variant {
  name: string;
  cable: Cable;
  Lj: number;
  flag?: string;
}

export interface Window {
  rLo: number;
  rHi: number;
  xLo: number;
  xHi: number;
}

/** A measured branch z_p(f) on its sweep's grid, for one variant. */
export interface BranchTable {
  f: number[];
  re: number[];
  im: number[];
}

/** Cached measured-branch tables; an entry is reused only for the same sweep object (final review I6). */
export interface BranchCacheEntry {
  sweep: Sweep;
  table: BranchTable;
}
export type BranchCache = Map<string, BranchCacheEntry>;

export interface Context {
  variant: Variant;
  sweeps: Record<string, Sweep>;
  cache?: BranchCache;
}

export type ZFn = (f: number) => Complex;

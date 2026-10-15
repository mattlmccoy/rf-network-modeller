import { type Counts, DEFAULT_STOCK } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS } from '../chain/presets.ts';
import { type StateOverrides, allBlocks, applyState, findBlock, updateBlock } from '../chain/state.ts';
import type { Block, Chain, Param, Variant, Window } from '../chain/types.ts';
import { type ParamRef, fromFitVars, getParam, withParamValue } from '../fit/params.ts';
import type { Sweep } from '../io/sweep.ts';
import { insertAfter, insertInto, moveBlock, removeBlock } from './chainEdit.ts';
import { knownState, snapshotState, structureKey } from '../present/circuit.ts';

export { snapshotState };

export type PaneMode = 'smith' | 's11db' | 'rx' | 'vswr';

/** One variant's fitted parameter values (fit variables in FIT_UNIT / unitOf units, as fromFitVars expects). */
export interface FitValues {
  refs: ParamRef[];
  x: number[];
  source: string;
  /** null for fits imported from the Python, which carry no flag. */
  converged: boolean | null;
  rms: number | null;
  illDetermined: [string, string][];
}

/** A loaded caps-in sweep, the circuit state it was taken in, the circuit's structure then, and whether fits use it. */
export interface TagRef {
  sweepId: string;
  label: string;
  state: StateOverrides;
  include: boolean;
  structure: string;
}

export interface AppState {
  chain: Chain;
  variants: Variant[];
  primary: number;
  fits: Record<string, FitValues>;
  sweeps: Record<string, Sweep>;
  tagged: TagRef[];
  activeSweep: string | null;
  stock: Counts;
  window: Window;
  powerW: number;
  selected: string | null;
  view: 'physical' | 'symbol';
  panes: PaneMode[];
}

export type Action =
  | { type: 'load'; state: AppState }
  | { type: 'select'; id: string | null }
  | { type: 'setView'; view: 'physical' | 'symbol' }
  | { type: 'setPrimary'; index: number }
  | { type: 'setPane'; index: number; mode: PaneMode }
  | { type: 'patchBlock'; id: string; patch: Record<string, unknown> }
  | { type: 'setParam'; ref: ParamRef; value: number }
  | { type: 'setFree'; ref: ParamRef; free: boolean }
  | { type: 'insertAfter'; targetId: string | null; block: Block }
  | { type: 'insertInto'; containerId: string; arm: number; block: Block }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; dir: -1 | 1 }
  | { type: 'addSweep'; sweep: Sweep; label: string }
  | { type: 'toggleInclude'; sweepId: string }
  | { type: 'removeSweep'; sweepId: string }
  | { type: 'setActiveSweep'; sweepId: string | null }
  | { type: 'applySweepState'; sweepId: string }
  | { type: 'setStock'; stock: Counts }
  | { type: 'retagSweep'; sweepId: string }
  | { type: 'setFits'; fits: Record<string, FitValues> }
  | { type: 'setCircuitState'; state: StateOverrides };

export function emptyState(): AppState {
  return {
    chain: { name: 'Untitled network', blocks: [] },
    variants: DEFAULT_VARIANTS,
    primary: 0,
    fits: {},
    sweeps: {},
    tagged: [],
    activeSweep: null,
    stock: DEFAULT_STOCK,
    window: AIT_WINDOW,
    powerW: 500,
    selected: null,
    view: 'physical',
    panes: ['smith', 's11db', 'rx', 'vswr'],
  };
}

/** The chain with a variant's fitted values applied. */
export function variantChain(s: AppState, index: number): Chain {
  const v = s.variants[index];
  const f = v ? s.fits[v.name] : undefined;
  if (!f) return s.chain;
  // A fitted value whose block is gone is meaningless; skip it rather than fail the whole prediction.
  const idx = f.refs.map((_, i) => i).filter((i) => findBlock(s.chain, f.refs[i].blockId) !== undefined);
  return idx.length ? fromFitVars(s.chain, idx.map((i) => f.refs[i]), idx.map((i) => f.x[i]), 'fit') : s.chain;
}

/** A sweep id from a file name: letters, digits, '-' and '_' only, made unique against the loaded sweeps. */
export function uniqueSweepId(sweeps: Record<string, Sweep>, filename: string): string {
  const base = filename.replace(/\.s1p$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sweep';
  if (!sweeps[base]) return base;
  let k = 2;
  while (sweeps[`${base}-${k}`]) k += 1;
  return `${base}-${k}`;
}

/** Block ids that sweep tags or fits still refer to; new blocks must not reuse them (final review I4). */
export function reservedIds(s: AppState): string[] {
  const ids = new Set<string>();
  for (const t of s.tagged) for (const id of Object.keys(t.state)) ids.add(id);
  for (const f of Object.values(s.fits)) for (const r of f.refs) ids.add(r.blockId);
  return [...ids];
}

const sameRef = (a: ParamRef, b: ParamRef): boolean => a.blockId === b.blockId && a.key === b.key;

function filterFits(fits: Record<string, FitValues>, keep: (r: ParamRef) => boolean): Record<string, FitValues> {
  return Object.fromEntries(Object.entries(fits).map(([name, f]) => {
    const idx = f.refs.map((_, i) => i).filter((i) => keep(f.refs[i]));
    return [name, { ...f, refs: idx.map((i) => f.refs[i]), x: idx.map((i) => f.x[i]) }];
  }));
}

/** Drops fitted values whose block no longer exists in the chain. */
const pruneFits = (fits: Record<string, FitValues>, chain: Chain): Record<string, FitValues> => filterFits(fits, (r) => findBlock(chain, r.blockId) !== undefined);

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'load':
      return a.state;
    case 'select':
      return { ...s, selected: a.id };
    case 'setView':
      return { ...s, view: a.view };
    case 'setPrimary':
      return a.index >= 0 && a.index < s.variants.length ? { ...s, primary: a.index } : s;
    case 'setPane':
      return { ...s, panes: s.panes.map((p, i) => (i === a.index ? a.mode : p)) };
    case 'patchBlock': {
      const chain = updateBlock(s.chain, a.id, a.patch);
      return { ...s, chain, fits: pruneFits(s.fits, chain) };
    }
    case 'setParam':
      return { ...s, chain: withParamValue(s.chain, a.ref, a.value, 'typed'), fits: filterFits(s.fits, (r) => !sameRef(r, a.ref)) };
    case 'setFree': {
      const p: Param = getParam(s.chain, a.ref);
      return { ...s, chain: updateBlock(s.chain, a.ref.blockId, { [a.ref.key]: { ...p, free: a.free } }) };
    }
    case 'insertAfter':
      return { ...s, chain: insertAfter(s.chain, a.targetId, a.block), selected: a.block.id };
    case 'insertInto':
      return { ...s, chain: insertInto(s.chain, a.containerId, a.arm, a.block), selected: a.block.id };
    case 'remove': {
      const chain = removeBlock(s.chain, a.id);
      return { ...s, chain, fits: pruneFits(s.fits, chain), selected: s.selected && findBlock(chain, s.selected) ? s.selected : null };
    }
    case 'move':
      return { ...s, chain: moveBlock(s.chain, a.id, a.dir) };
    case 'addSweep':
      return {
        ...s,
        sweeps: { ...s.sweeps, [a.sweep.id]: a.sweep },
        tagged: [...s.tagged, { sweepId: a.sweep.id, label: a.label, state: snapshotState(s.chain), include: true, structure: structureKey(s.chain) }],
        activeSweep: a.sweep.id,
      };
    case 'toggleInclude':
      return { ...s, tagged: s.tagged.map((t) => (t.sweepId === a.sweepId ? { ...t, include: !t.include } : t)) };
    case 'removeSweep': {
      const usedByBranch = allBlocks(s.chain.blocks).some((b) => b.type === 'measuredBranch' && b.sweepId === a.sweepId);
      const sweeps = { ...s.sweeps };
      if (!usedByBranch) delete sweeps[a.sweepId];
      return { ...s, sweeps, tagged: s.tagged.filter((t) => t.sweepId !== a.sweepId), activeSweep: s.activeSweep === a.sweepId ? null : s.activeSweep };
    }
    case 'setActiveSweep':
      return { ...s, activeSweep: a.sweepId };
    case 'applySweepState': {
      const tag = s.tagged.find((t) => t.sweepId === a.sweepId);
      if (!tag) return s;
      return { ...s, chain: applyState(s.chain, knownState(s.chain, tag.state)) };
    }
    case 'setStock':
      return { ...s, stock: a.stock };
    case 'retagSweep':
      return { ...s, tagged: s.tagged.map((t) => (t.sweepId === a.sweepId ? { ...t, state: snapshotState(s.chain), structure: structureKey(s.chain) } : t)) };
    case 'setFits':
      return { ...s, fits: a.fits };
    case 'setCircuitState':
      return { ...s, chain: applyState(s.chain, knownState(s.chain, a.state)) };
  }
}

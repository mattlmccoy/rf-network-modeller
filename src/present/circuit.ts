import { type Counts, countsPf } from '../blocks/ht50.ts';
import { type StateOverrides, allBlocks, applyState, findBlock } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';
import type { Level } from './level.ts';

/** Fields a sweep's circuit state sets: bank parts and the sense-loop flag (spec §7.3). */
const STATE_FIELDS: Partial<Record<Block['type'], readonly string[]>> = { capBank: ['counts', 'nSeries', 'customPf'], measuredBranch: ['loop'] };
/** Fields that do not change the circuit's impedance: names, recommender settings, and the turns only flux reads. */
const NON_CIRCUIT: readonly string[] = ['label', 'slots', 'searchable', 'transformer'];

const isParam = (o: Record<string, unknown>): boolean => 'value' in o && 'badge' in o && 'free' in o;

/** Key-sorted plain value; a Param reduces to its value, since badge, free and bounds do not change the circuit. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (isParam(o)) return o.value;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
  }
  return v;
}

/** The circuit state a new sweep is tagged with: every bank's parts and every measured branch's loop flag. */
export function snapshotState(chain: Chain): StateOverrides {
  const out: StateOverrides = {};
  for (const b of allBlocks(chain.blocks)) {
    if (b.type === 'capBank') out[b.id] = { counts: { ...b.counts }, nSeries: b.nSeries, customPf: b.customPf };
    if (b.type === 'measuredBranch') out[b.id] = { loop: b.loop };
  }
  return out;
}

function strip(b: Block): Record<string, unknown> {
  const drop = new Set([...NON_CIRCUIT, ...(STATE_FIELDS[b.type] ?? [])]);
  const o: Record<string, unknown> = Object.fromEntries(Object.entries(b).filter(([k]) => !drop.has(k)));
  if (b.type === 'shunt') o.chain = b.chain.map(strip);
  if (b.type === 'parallel') o.chains = b.chains.map((c) => c.map(strip));
  return o;
}

/** The circuit without its sweep-state fields: equal keys mean the same parts with the same values (spec §7.3). */
export const structureKey = (chain: Chain): string => JSON.stringify(canon(chain.blocks.map(strip)));

/** Overrides for blocks that still exist; a tag can outlive a removed block. */
export const knownState = (chain: Chain, state: StateOverrides): StateOverrides =>
  Object.fromEntries(Object.entries(state).filter(([id]) => findBlock(chain, id) !== undefined));

const stateText = (chain: Chain, s: StateOverrides): string => JSON.stringify(canon(snapshotState(applyState(chain, knownState(chain, s)))));

/** Two tags describe the same build. Compared after applying them, so o7State and snapshotState shapes agree. */
export const sameState = (chain: Chain, a: StateOverrides, b: StateOverrides): boolean => stateText(chain, a) === stateText(chain, b);

export type Trust = 'measured' | 'within' | 'beyond';
export interface TagLike { sweepId: string; state: StateOverrides; include: boolean; structure: string }

const bankPf = (e: Record<string, unknown> | undefined): number =>
  e ? (countsPf(e.counts as Counts) + (e.customPf as number)) / (e.nSeries as number) : Number.NaN;

/** How the current circuit relates to the included sweeps; beyond is checked first (spec §7.3). */
export function trust(chain: Chain, tagged: readonly TagLike[]): Trust {
  const key = structureKey(chain);
  const same = tagged.filter((t) => t.include && t.structure === key);
  if (!same.length) return 'beyond';
  const cur = snapshotState(chain);
  const states = same.map((t) => snapshotState(applyState(chain, knownState(chain, t.state))));
  for (const [id, v] of Object.entries(cur)) {
    if ('counts' in v) {
      const pf = states.map((st) => bankPf(st[id]));
      const x = bankPf(v);
      if (x < Math.min(...pf) || x > Math.max(...pf)) return 'beyond';
    } else if (!states.some((st) => st[id]?.loop === v.loop)) {
      return 'beyond';
    }
  }
  return same.some((t) => sameState(chain, t.state, cur)) ? 'measured' : 'within';
}

/** The circuit is the one the active sweep was taken on, so the measured verdict applies (spec §7.4). */
export function activeIsMeasured(chain: Chain, tagged: readonly TagLike[], activeSweep: string | null): boolean {
  const t = tagged.find((x) => x.sweepId === activeSweep);
  return t !== undefined && t.structure === structureKey(chain) && sameState(chain, t.state, snapshotState(chain));
}

/** Trust wording by level; nothing to say when the circuit was measured (spec §7.3). */
export function trustText(t: Trust, level: Level): string | null {
  if (t === 'measured') return null;
  if (level === 'beginner') return '(prediction: not measured yet)';
  return t === 'within' ? "Within what you've measured" : "Beyond anything you've measured: the model is extrapolating";
}

/** A project has a circuit model when it holds any part besides the cable; a cable-only project is "measured only". */
export const hasModel = (chain: Chain): boolean => allBlocks(chain.blocks).some((b) => b.type !== 'coax' && b.type !== 'shunt' && b.type !== 'parallel');

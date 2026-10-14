import type { Sweep } from '../io/sweep.ts';
import type { Block, Chain } from './types.ts';

/** Field overrides per block id, e.g. { ser: { counts: {...} }, branch: { loop: true } }. */
export type StateOverrides = Record<string, Record<string, unknown>>;

/** A loaded sweep, the circuit state it was taken in, and whether the fit uses it (spec §6). */
export interface TaggedSweep {
  sweep: Sweep;
  state: StateOverrides;
  include: boolean;
}

export function mapBlocks(blocks: Block[], fn: (b: Block) => Block): Block[] {
  return blocks.map((b) => {
    const m = fn(b);
    if (m.type === 'shunt') return { ...m, chain: mapBlocks(m.chain, fn) };
    if (m.type === 'parallel') return { ...m, chains: m.chains.map((c) => mapBlocks(c, fn)) };
    return m;
  });
}

export function allBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b) => {
    if (b.type === 'shunt') return [b, ...allBlocks(b.chain)];
    if (b.type === 'parallel') return [b, ...b.chains.flatMap(allBlocks)];
    return [b];
  });
}

export const findBlock = (chain: Chain, id: string): Block | undefined => allBlocks(chain.blocks).find((b) => b.id === id);

export function updateBlock(chain: Chain, id: string, patch: Record<string, unknown>): Chain {
  if (!findBlock(chain, id)) throw new Error(`no block "${id}" in chain "${chain.name}"`);
  return { ...chain, blocks: mapBlocks(chain.blocks, (b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) };
}

export const applyState = (chain: Chain, state: StateOverrides): Chain =>
  Object.entries(state).reduce((c, [id, patch]) => updateBlock(c, id, patch), chain);

export function duplicateIds(chain: Chain): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const b of allBlocks(chain.blocks)) {
    if (seen.has(b.id)) dup.add(b.id);
    seen.add(b.id);
  }
  return [...dup];
}

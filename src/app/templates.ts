import { allBlocks } from '../chain/state.ts';
import { cdChain } from '../chain/presets.ts';
import { type AppState, emptyState } from './state.ts';

export type TemplateKind = 'o7' | 'cd' | 'blank';

export const TEMPLATES: readonly { kind: TemplateKind; label: string }[] = [
  { kind: 'o7', label: 'O7 as built' },
  { kind: 'cd', label: 'C+D 2:18 two-core' },
  { kind: 'blank', label: 'Blank (cable only)' },
];

/**
 * A new project from a starting point (spec §8.4). O7 keeps the example's circuit, fits, transformer model and the sweep
 * its measured part needs, but none of its tagged sweeps: they belong to the old project.
 */
export function fromTemplate(kind: TemplateKind, o7?: AppState): AppState {
  if (kind === 'cd') return { ...emptyState(), chain: cdChain() };
  if (kind === 'blank') return { ...emptyState(), chain: { name: 'New network', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] } };
  if (!o7) throw new Error('the O7 example is needed for this template');
  const used = new Set(allBlocks(o7.chain.blocks).flatMap((b) => (b.type === 'measuredBranch' ? [b.sweepId] : [])));
  return {
    ...o7,
    chain: { ...o7.chain, name: 'New network from O7' },
    sweeps: Object.fromEntries(Object.entries(o7.sweeps).filter(([id]) => used.has(id))),
    tagged: [],
    activeSweep: null,
    selected: null,
  };
}

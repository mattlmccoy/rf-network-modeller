import { allBlocks } from '../chain/state.ts';
import { cdChain } from '../chain/presets.ts';
import { type AppState, emptyState } from './state.ts';

export type TemplateKind = 'copy' | 'o7' | 'cd' | 'blank';

export const TEMPLATES: readonly { kind: TemplateKind; label: string }[] = [
  { kind: 'copy', label: "A copy of this project's circuit" },
  { kind: 'o7', label: 'O7 as built' },
  { kind: 'cd', label: 'C+D 2:18 two-core' },
  { kind: 'blank', label: 'Blank (cable only)' },
];

/**
 * A new project from a starting point (spec §8.4). O7 and "a copy of this project" keep the source's circuit, fits,
 * transformer model and the sweep its measured part needs, but none of its tagged sweeps: they belong to the old project.
 */
export function fromTemplate(kind: TemplateKind, src?: AppState): AppState {
  if (kind === 'cd') return { ...emptyState(), chain: cdChain() };
  if (kind === 'blank') return { ...emptyState(), chain: { name: 'New network', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] } };
  if (!src) throw new Error(kind === 'o7' ? 'the O7 example is needed for this template' : 'there is no open project to copy');
  const used = new Set(allBlocks(src.chain.blocks).flatMap((b) => (b.type === 'measuredBranch' ? [b.sweepId] : [])));
  return {
    ...src,
    chain: { ...src.chain, name: kind === 'o7' ? 'New network from O7' : `Next build from ${src.chain.name}` },
    sweeps: Object.fromEntries(Object.entries(src.sweeps).filter(([id]) => used.has(id))),
    tagged: [],
    activeSweep: null,
    selected: null,
  };
}

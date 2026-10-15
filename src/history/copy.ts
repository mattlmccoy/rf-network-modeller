import type { Sweep } from '../io/sweep.ts';
import { type AppState, emptyState } from '../app/state.ts';
import { sweepFromFile } from '../app/sweepFile.ts';
import { structureKey } from '../present/circuit.ts';
import type { IndexSession } from './manifest.ts';

/** A bundled history file's URL, relative to the site root. */
export const historyUrl = (path: string): string => `history/files/${path.split('/').map(encodeURIComponent).join('/')}`;

/**
 * A session as a measured-only project (spec §8.6): the cable alone, every sweep loaded, and only the network sweeps tagged,
 * because only a sweep with no tuner in the path has a verdict at the tuner.
 */
export function historyCopy(s: IndexSession, texts: Record<string, string>): AppState {
  const chain = { name: `${s.title} (rig history copy)`, blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] };
  const sweeps: Record<string, Sweep> = {};
  const tagged: AppState['tagged'] = [];
  for (const w of s.sweeps) {
    const text = texts[w.path];
    if (text === undefined) throw new Error(`${w.path} was not fetched`);
    const sweep = sweepFromFile(w.path.slice(w.path.lastIndexOf('/') + 1), text, sweeps);
    sweeps[sweep.id] = sweep;
    if (w.kind === 'network') tagged.push({ sweepId: sweep.id, label: w.label, state: {}, include: true, structure: structureKey(chain) });
  }
  return { ...emptyState(), chain, sweeps, tagged, activeSweep: tagged.at(-1)?.sweepId ?? null };
}

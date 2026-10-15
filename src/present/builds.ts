import { tagSummary } from '../app/units.ts';
import type { AppState, TagRef } from '../app/state.ts';
import type { Sweep } from '../io/sweep.ts';
import { sameState } from './circuit.ts';

export interface Build { key: string; label: string; sweepIds: string[]; newest: number | null }

/** The NanoVNA web tool's save stamp in a file name (ms since the epoch), or null: dates are never invented. */
export const stampOf = (name: string): number | null => {
  const m = /nanovna-sweep-(\d{13})/.exec(name);
  return m ? Number(m[1]) : null;
};

const stateless = (t: TagRef): boolean => Object.keys(t.state).length === 0;

/**
 * Tagged sweeps grouped by equal structure and circuit state, in first-seen order (spec §9). A tag that records no circuit
 * state (a measured-only project) groups by its label instead.
 */
export function buildsOf(s: Pick<AppState, 'chain' | 'tagged' | 'sweeps'>): Build[] {
  const groups: TagRef[][] = [];
  for (const t of s.tagged) {
    const g = groups.find(([h]) => h.structure === t.structure && (stateless(h) || stateless(t) ? h.label === t.label && stateless(h) && stateless(t) : sameState(s.chain, h.state, t.state)));
    if (g) g.push(t);
    else groups.push([t]);
  }
  return groups.map((g, i) => {
    const stamps = g.map((t) => stampOf(s.sweeps[t.sweepId]?.name ?? '')).filter((x): x is number => x !== null);
    return {
      key: `b${i}`,
      label: tagSummary(s.chain, g[0].state) || g[0].label,
      sweepIds: g.map((t) => t.sweepId),
      newest: stamps.length ? Math.max(...stamps) : null,
    };
  });
}

/** The sweep a build is compared by: its newest stamped one, else the last one still loaded. */
export function buildSweep(s: Pick<AppState, 'sweeps'>, b: Build): Sweep | undefined {
  const loaded = b.sweepIds.map((id) => s.sweeps[id]).filter((x): x is Sweep => x !== undefined);
  return loaded.find((x) => b.newest !== null && stampOf(x.name) === b.newest) ?? loaded.at(-1);
}

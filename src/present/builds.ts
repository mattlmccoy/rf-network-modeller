import { tagSummary } from '../app/units.ts';
import type { AppState, TagRef } from '../app/state.ts';
import type { Sweep } from '../io/sweep.ts';
import { knownState, stateKey } from './circuit.ts';

export interface Build { key: string; label: string; sweepIds: string[]; newest: number | null }

/** The NanoVNA web tool's save stamp in a file name (ms since the epoch), or null: dates are never invented. */
export const stampOf = (name: string): number | null => {
  const m = /nanovna-sweep-(\d{13})/.exec(name);
  return m ? Number(m[1]) : null;
};

const stateless = (t: TagRef): boolean => Object.keys(t.state).length === 0;

/**
 * Tagged sweeps grouped by equal structure and circuit state, in first-seen order (spec §9). A tag that records no circuit
 * state (a measured-only project) groups by its label instead. A build that used parts since removed is labelled so.
 */
export function buildsOf(s: Pick<AppState, 'chain' | 'tagged' | 'sweeps'>): Build[] {
  const key = (t: TagRef): string => `${t.structure}|${stateless(t) ? `label:${t.label}` : stateKey(s.chain, t.state)}`;
  const groups = new Map<string, TagRef[]>();
  for (const t of s.tagged) groups.set(key(t), [...(groups.get(key(t)) ?? []), t]);
  return [...groups.values()].map((g, i) => {
    const stamps = g.map((t) => stampOf(s.sweeps[t.sweepId]?.name ?? '')).filter((x): x is number => x !== null);
    const gone = Object.keys(knownState(s.chain, g[0].state)).length < Object.keys(g[0].state).length;
    return {
      key: `b${i}`,
      label: gone ? `${g[0].label} (built with parts no longer in this circuit)` : tagSummary(s.chain, g[0].state) || g[0].label,
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

/** A build's date: the local calendar day of its newest stamp, or "date unknown" (final review M2). */
export function dateText(ms: number | null): string {
  if (ms === null) return 'date unknown';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

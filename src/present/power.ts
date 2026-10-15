import { findBlock } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import { drive, reports } from '../stress/drive.ts';
import { type AppState, variantChain } from '../app/state.ts';
import type { Level } from './level.ts';
import { type StressFlag, stressFlag } from './recs.ts';
import { fittedVariants } from './show.ts';
import { nearF0Index } from './verdict.ts';

export interface CapRow { blockId: string; label: string; pf: number; count: number; vRms: number; iRms: number; pct: number | null; limit: 'voltage' | 'current' | null; flag: StressFlag }
/** unrated: parts with no rating that carry current; they are never covered by the safe power (review I6). */
/** estimate: no cable assumption is fitted, so every number comes from starting values (reviewer pass C1). */
export interface CapStress { watts: number; rows: CapRow[]; worstPct: number | null; limiting: CapRow | null; safeW: number | null; errors: string[]; unrated: CapRow[]; estimate: boolean }

/** The capacitors' limit: V and I scale with √P, so P_max = P (100 / worst %)² (spec §8.3); unknown without a rated part. */
export const safePower = (watts: number, worstPct: number | null): number | null => (worstPct === null || !(worstPct > 0) ? null : watts * (100 / worstPct) ** 2);

/**
 * Every capacitor part at `watts`, each at its worst fitted cable assumption (all of them when none is fitted); any failed
 * drive makes the safe power unknown.
 */
export function capStress(s: AppState, grid: number[], watts: number, caches: BranchCache[] = []): CapStress {
  const k = nearF0Index(grid);
  const fitted = fittedVariants(s);
  const estimate = !fitted.some(Boolean);
  if (k === null) return { watts, rows: [], worstPct: null, limiting: null, safeW: null, errors: ['the model has no point at 13.56 MHz'], unrated: [], estimate };
  const rows = new Map<string, CapRow>();
  const errors: string[] = [];
  s.variants.forEach((variant, i) => {
    if (!estimate && !fitted[i]) return;
    caches[i] ??= new Map();
    const chain = variantChain(s, i);
    try {
      for (const r of reports(chain, drive(chain, { variant, sweeps: s.sweeps, cache: caches[i] }, grid[k], watts)).values()) {
        for (const p of r.parts ?? []) {
          const key = `${r.blockId}:${p.pf}`;
          const prev = rows.get(key);
          if (prev && (p.pct === null ? prev.iRms >= p.iRms : (prev.pct ?? -1) >= p.pct)) continue;
          const limit = p.pct === null ? null : (p.pctV ?? 0) >= (p.pctI ?? 0) ? 'voltage' : 'current';
          rows.set(key, { blockId: r.blockId, label: findBlock(s.chain, r.blockId)?.label ?? r.blockId, pf: p.pf, count: p.count, vRms: p.vRms, iRms: p.iRms, pct: p.pct, limit, flag: stressFlag(p.pct) });
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  });
  const list = [...rows.values()];
  const limiting = list.filter((r) => r.pct !== null).reduce<CapRow | null>((w, r) => (w === null || (r.pct ?? 0) > (w.pct ?? 0) ? r : w), null);
  const worstPct = errors.length ? null : (limiting?.pct ?? null);
  const unrated = list.filter((r) => r.pct === null && r.iRms > 0);
  return { watts, rows: list, worstPct, limiting: errors.length ? null : limiting, safeW: safePower(watts, worstPct), errors, unrated, estimate };
}

/** A limit rounds down, never up. */
export const roundSafe = (w: number): number => Math.floor(w / 10) * 10;

/** Plain wording by level (spec §8.3); "Can't tell" whenever there is no safe-power number. */
export function powerText(cs: CapStress, level: Level): string {
  const pre = cs.estimate ? 'Estimate (not fitted to a sweep of this circuit): ' : '';
  const p = cs.limiting;
  const note = cs.unrated.map((r) => ` The ${r.pf} pF custom part has no rating, so it isn't checked.`).join('');
  if (cs.safeW === null || cs.worstPct === null || !p) return `Can't tell: ${cs.errors[0] ?? 'no rated capacitor carries current'}.${note}`;
  const pct = Math.round(cs.worstPct);
  const which = cs.unrated.length ? 'rated capacitors' : 'capacitors';
  const safe = `The ${which} are safe up to about ${roundSafe(cs.safeW)} W.`;
  if (cs.worstPct >= 100) return `${pre}At ${cs.watts} W the ${p.pf} pF part in the ${p.label} would ${p.limit === 'voltage' ? `see ${pct} % of its rated voltage` : `carry ${pct} % of its rated current`}. ${safe}${note}`;
  if (level === 'beginner') return `${pre}The ${which} are within their ratings at ${cs.watts} W. ${safe}${note}`;
  return `${pre}At ${cs.watts} W the worst ${which === 'capacitors' ? 'capacitor' : 'rated capacitor'} (the ${p.pf} pF part in the ${p.label}) is at ${pct} % of its rated ${p.limit}. ${safe}${note}`;
}

/** The safety line's tone: never green while a current-carrying part has no rating (review I6) or the numbers are estimates. */
export const powerTone = (cs: CapStress): 'good' | 'warn' | 'bad' | 'unknown' =>
  cs.worstPct === null ? 'unknown' : cs.worstPct >= 100 ? 'bad' : cs.unrated.length || cs.estimate ? 'unknown' : cs.worstPct >= 80 ? 'warn' : 'good';

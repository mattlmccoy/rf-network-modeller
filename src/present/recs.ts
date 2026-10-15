import type { StateOverrides } from '../chain/state.ts';
import type { Window } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import type { Recommendation, RecommendOutput } from '../recommend/recommend.ts';
import { lowerMedian } from '../recommend/rank.ts';
import { SEVERITY, type VerdictState, combine, verdictOf, windowDistance } from './verdict.ts';

export const MAX_ROWS = 5;
export type StressFlag = 'ok' | 'amber' | 'red' | 'unknown';
export type RecNote = 'nothing-beats' | 'none-fit' | 'all-red';
export interface RecRow { picks: Record<string, Pick>; movesText: string[]; isCurrent: boolean; verdict: VerdictState; inCount: number; total: number; stressPct: number | null; stress: StressFlag }
export interface RecView { rows: RecRow[]; closest: RecRow[]; notes: RecNote[]; currentStressPct: number | null }

/** Capacitor stress at the planned power: amber from 80 %, red from 100 %; no number is unknown, never ok. */
export const stressFlag = (pct: number | null): StressFlag => (pct === null ? 'unknown' : pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'ok');

function row(r: Recommendation, w: Window): RecRow {
  return {
    picks: r.candidate.picks, movesText: r.movesText, isCurrent: r.moves === 0,
    verdict: combine(r.landings.map((l) => verdictOf(l, w).state)).state,
    inCount: r.inCount, total: r.landings.length, stressPct: r.maxStressPct, stress: stressFlag(r.maxStressPct),
  };
}
const medianDistance = (r: Recommendation, w: Window): number => lowerMedian(r.landings.map((l) => windowDistance(l.z, w)));

/** Step 4's list from the recommender's real output (spec §8.1): current-build row, notes, and the closest fallback. */
export function shapeRecs(out: RecommendOutput, w: Window): RecView {
  const ranked = out.ranked.slice(0, MAX_ROWS).map((r) => row(r, w));
  const cur = ranked.find((r) => r.isCurrent);
  // an option with no more room and no less stress than keeping what you have is not a choice (reviewer pass)
  const rows = cur ? ranked.filter((r) => r === cur || SEVERITY.indexOf(r.verdict) > SEVERITY.indexOf(cur.verdict) || (r.stressPct ?? Infinity) < (cur.stressPct ?? Infinity)) : ranked;
  const notes: RecNote[] = [];
  let closest: RecRow[] = [];
  if (!rows.length) {
    notes.push('none-fit');
    closest = [...out.all].sort((a, b) => medianDistance(a, w) - medianDistance(b, w)).slice(0, 3).map((r) => row(r, w));
  } else {
    if (rows[0].isCurrent) notes.push('nothing-beats');
    if (rows.every((r) => r.stress === 'red')) notes.push('all-red');
  }
  return { rows, closest, notes, currentStressPct: out.all.find((r) => r.moves === 0)?.maxStressPct ?? null };
}

/** "No change needed" only with plenty of room and capacitor stress under 100 % at the planned power (spec §8.1). */
export const noChangeNeeded = (v: VerdictState, currentStressPct: number | null): boolean => v === 'plenty' && currentStressPct !== null && currentStressPct < 100;

export const picksState = (picks: Record<string, Pick>): StateOverrides =>
  Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { counts: p.counts, nSeries: p.nSeries }]));

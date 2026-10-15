import type { Window } from '../chain/types.ts';
import type { VariantResult } from '../app/evaluate.ts';
import type { AppState } from '../app/state.ts';
import { activeIsMeasured } from './circuit.ts';
import { type Combined, UNKNOWN, type Verdict, combine, representative, verdictOf } from './verdict.ts';

/** `estimate`: no cable assumption has fitted values, so a prediction comes from starting values only (reviewer pass C1). */
export interface Shown { v: Verdict; c: Combined | undefined; source: 'measured' | 'predicted'; estimate: boolean }

/** Which cable assumptions have fitted values. */
export const fittedVariants = (s: Pick<AppState, 'variants' | 'fits'>): boolean[] => s.variants.map((v) => (s.fits[v.name]?.refs.length ?? 0) > 0);

/** The assumptions whose predictions count: the fitted ones when any is fitted, else all of them (reviewer pass C1). */
const voting = (fitted: readonly boolean[], n: number): number[] => Array.from({ length: n }, (_, i) => i).filter((i) => !fitted.some(Boolean) || fitted[i]);
export const voters = (s: Pick<AppState, 'variants' | 'fits'>): number[] => voting(fittedVariants(s), s.variants.length);

/** The majority over the voting assumptions, worded from the chosen one if it votes. */
function vote(vs: readonly Verdict[], fitted: readonly boolean[], primary: number): { v: Verdict; c: Combined } {
  const idx = voting(fitted, vs.length);
  const c = combine(idx.map((i) => vs[i].state));
  return { v: representative(idx.map((i) => vs[i]), idx.indexOf(primary), c.state), c };
}

/** The verdict on screen: the active sweep's while the circuit is the build it was taken on, else the model majority (spec §7.4). */
export function shownResult(s: Pick<AppState, 'chain' | 'tagged' | 'activeSweep' | 'primary' | 'variants' | 'fits'>, verdicts: readonly Verdict[], measured: Verdict | null): Shown {
  if (measured && activeIsMeasured(s.chain, s.tagged, s.activeSweep)) return { v: measured, c: undefined, source: 'measured', estimate: false };
  const fitted = fittedVariants(s);
  return { ...vote(verdicts, fitted, s.primary), source: 'predicted', estimate: !fitted.some(Boolean) };
}

/** The model's majority verdict for a set of results (e.g. the circuit before a change), worded from the chosen assumption. */
export function modelVerdict(results: readonly VariantResult[], w: Window, primary: number, fitted: readonly boolean[] = []): { v: Verdict; c: Combined } {
  return vote(results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, w))), fitted, primary);
}

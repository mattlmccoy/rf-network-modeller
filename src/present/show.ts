import type { AppState } from '../app/state.ts';
import { activeIsMeasured } from './circuit.ts';
import { type Combined, type Verdict, combine, representative } from './verdict.ts';

export interface Shown { v: Verdict; c: Combined | undefined; source: 'measured' | 'predicted' }

/** The verdict on screen: the active sweep's while the circuit is the build it was taken on, else the model majority (spec §7.4). */
export function shownResult(s: Pick<AppState, 'chain' | 'tagged' | 'activeSweep' | 'primary'>, verdicts: readonly Verdict[], measured: Verdict | null): Shown {
  if (measured && activeIsMeasured(s.chain, s.tagged, s.activeSweep)) return { v: measured, c: undefined, source: 'measured' };
  const c = combine(verdicts.map((v) => v.state));
  return { v: representative(verdicts, s.primary, c.state), c, source: 'predicted' };
}

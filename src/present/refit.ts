import { fitNetwork } from '../fit/network.ts';
import { type ParamRef, freeRefs } from '../fit/params.ts';
import { type AppState, type FitValues, variantChain } from '../app/state.ts';
import { knownState } from './circuit.ts';

/** The parameters to refit: the current fits' (spec §8.1), else every value marked free. */
export function refitRefs(s: AppState): ParamRef[] {
  const f = Object.values(s.fits).find((x) => x.refs.length > 0);
  return f ? f.refs : freeRefs(s.chain);
}

/** One cable assumption refitted against every included tagged sweep, started from its current fit. */
export function refitVariant(s: AppState, i: number, refs: ParamRef[]): FitValues {
  const sweeps = s.tagged.map((t) => ({ sweep: s.sweeps[t.sweepId], state: knownState(s.chain, t.state), include: t.include }));
  const fit = fitNetwork({ chain: variantChain(s, i), refs, sweeps, variant: s.variants[i], allSweeps: s.sweeps });
  return { refs, x: fit.x, source: `in-app refit (${sweeps.filter((t) => t.include).length} sweeps)`, converged: fit.converged, rms: fit.rms, illDetermined: fit.illDetermined };
}

const nextFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Refit every cable assumption in turn, yielding before each so progress can render; any failure returns its reason. */
export async function refitAll(s: AppState, progress: (i: number, n: number) => void, pause: () => Promise<void> = nextFrame): Promise<{ fits: Record<string, FitValues> } | { error: string }> {
  const refs = refitRefs(s);
  if (!refs.length) return { error: 'Nothing to refit: no value is marked free to fit.' };
  const fits: Record<string, FitValues> = {};
  for (let i = 0; i < s.variants.length; i += 1) {
    progress(i, s.variants.length);
    await pause();
    try {
      fits[s.variants[i].name] = refitVariant(s, i, refs);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { fits };
}

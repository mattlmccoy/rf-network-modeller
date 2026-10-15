import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
import { uniqueSweepId } from './state.ts';

/** A sweep from an .s1p file's text, with an id unique among the loaded sweeps; errors name the file. */
export function sweepFromFile(name: string, text: string, taken: Record<string, Sweep>): Sweep {
  try {
    const t = parseS1p(text);
    return { id: uniqueSweepId(taken, name), name, f: t.f, gamma: t.gamma };
  } catch (e) {
    throw new Error(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export const sweepLabel = (name: string): string => name.replace(/\.s1p$/i, '');

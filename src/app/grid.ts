import { allBlocks } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import type { Sweep } from '../io/sweep.ts';

export const F0 = 13.56e6;

/** 1–30 MHz, 2,000 points linear, plus exactly 13.56 MHz (spec §4). */
export function defaultGrid(): number[] {
  const n = 2000;
  const g = Array.from({ length: n }, (_, i) => 1e6 + ((30e6 - 1e6) * i) / (n - 1));
  if (!g.includes(F0)) {
    g.push(F0);
    g.sort((a, b) => a - b);
  }
  return g;
}

/** The evaluation grid: the measured branch's own sweep grid when that sweep is loaded, else the default (spec §4). */
export function evalGrid(chain: Chain, sweeps: Record<string, Sweep>): number[] {
  for (const b of allBlocks(chain.blocks)) {
    if (b.type === 'measuredBranch' && sweeps[b.sweepId]) return sweeps[b.sweepId].f;
  }
  return defaultGrid();
}

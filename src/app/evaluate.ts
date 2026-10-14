import type { Complex } from '../engine/complex.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile, outOfRangeAt } from '../chain/compile.ts';
import type { BranchCache } from '../chain/types.ts';
import { nearestIndex } from '../io/sweep.ts';
import { F0, type Landing, ROOM_SEG, landing } from '../recommend/landing.ts';
import { type AppState, variantChain } from './state.ts';

export interface VariantResult {
  z: Complex[];
  error: string | null;
  outOfRange: boolean;
  landing: Landing | null;
}

/** Predicted Z over the grid for every variant, with its 13.56 MHz landing and drift room. Errors become messages. */
export function evaluateVariants(s: AppState, grid: number[], caches: BranchCache[] = []): VariantResult[] {
  const seg = grid.map((_, i) => i).filter((i) => grid[i] > ROOM_SEG[0] && grid[i] < ROOM_SEG[1]);
  const k0 = nearestIndex(grid, F0);
  return s.variants.map((variant, i) => {
    try {
      caches[i] ??= new Map();
      const c = compile(variantChain(s, i), { variant, sweeps: s.sweeps, cache: caches[i] });
      const z = grid.map((f) => inputImpedance(c.net, f));
      const l = seg.length ? landing(seg.map((k) => grid[k]), seg.map((k) => z[k]), s.window) : null;
      return { z, error: null, outOfRange: outOfRangeAt(c, grid[k0]), landing: l };
    } catch (e) {
      return { z: [], error: e instanceof Error ? e.message : String(e), outOfRange: false, landing: null };
    }
  });
}

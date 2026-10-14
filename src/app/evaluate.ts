import type { Complex } from '../engine/complex.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile, outOfRangeAt } from '../chain/compile.ts';
import type { BranchCache } from '../chain/types.ts';
import { type Sweep, nearestIndex, zFromGamma } from '../io/sweep.ts';
import { F0, type Landing, ROOM_SEG, landing } from '../recommend/landing.ts';
import { type AppState, variantChain } from './state.ts';

export interface VariantResult {
  z: Complex[];
  error: string | null;
  outOfRange: boolean;
  /** Per grid point: the measured branch is read outside its sweep there (clamped data; spec §4). */
  clamped: boolean[];
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
      return { z, error: null, outOfRange: outOfRangeAt(c, grid[k0]), clamped: grid.map((f) => outOfRangeAt(c, f)), landing: l };
    } catch (e) {
      return { z: [], error: e instanceof Error ? e.message : String(e), outOfRange: false, clamped: [], landing: null };
    }
  });
}

export interface MeasuredLanding {
  z: Complex;
  f: number;
}

/**
 * Measured Z at the sweep point nearest 13.56 MHz, or null when the sweep has no point there: the nearest point must lie
 * in 12.5–14.6 MHz and within one grid step of 13.56 MHz (final review I2).
 */
export function measuredLanding(s: Sweep): MeasuredLanding | null {
  if (!s.f.length) return null;
  const k = nearestIndex(s.f, F0);
  const f = s.f[k];
  if (!(f > ROOM_SEG[0] && f < ROOM_SEG[1])) return null;
  const step = Math.max(k > 0 ? f - s.f[k - 1] : 0, k + 1 < s.f.length ? s.f[k + 1] - f : 0);
  if (Math.abs(f - F0) > step) return null;
  return { z: zFromGamma(s.gamma[k]), f };
}

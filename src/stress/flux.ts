import { type Complex, mul, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, solveTransformer } from '../engine/transformer.ts';
import { seriesY } from '../chain/compile.ts';
import { mapBlocks } from '../chain/state.ts';
import type { Chain, Context } from '../chain/types.ts';
import { type Drive, drive, reports } from './drive.ts';

export interface FluxPoint { fPri: number; bPk_mT: number; vLoopRms: number }
export interface FluxRange { blockId: string; points: FluxPoint[]; bMin: number; bMax: number; vMin: number; vMax: number }

export const linspace = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

function summarize(blockId: string, points: FluxPoint[]): FluxRange {
  const b = points.map((p) => p.bPk_mT);
  const v = points.map((p) => p.vLoopRms);
  return { blockId, points, bMin: Math.min(...b), bMax: Math.max(...b), vMin: Math.min(...v), vMax: Math.max(...v) };
}

/** T-model mode: re-drive at each leakage split f_pri in [0, fPriMax] (all stacks together) and read each stack (spec §10). */
export function fluxRangeStacks(chain: Chain, ctx: Context, f: number, watts: number, fPriMax = 0.5, steps = 6): FluxRange[] {
  const per = new Map<string, FluxPoint[]>();
  for (const fp of linspace(0, fPriMax, steps)) {
    const c: Chain = { ...chain, blocks: mapBlocks(chain.blocks, (b) => (b.type === 'stack' ? { ...b, unit: { ...b.unit, f_pri: fp } } : b)) };
    for (const r of reports(c, drive(c, ctx, f, watts)).values()) {
      if (!r.unit) continue;
      const list = per.get(r.blockId) ?? [];
      list.push({ fPri: fp, bPk_mT: r.unit.b_pk_mT, vLoopRms: r.unit.v_loop_rms });
      per.set(r.blockId, list);
    }
  }
  return [...per.entries()].map(([id, pts]) => summarize(id, pts));
}

/** Voltage across a measured branch block in a drive. */
export function branchVoltage(d: Drive, branchId: string): Complex {
  const run = d.compiled.runs.find((r) => r.parts.some((p) => p.blockId === branchId));
  if (!run) throw new Error(`measured branch "${branchId}" carries no current in this drive`);
  const i = mul(sub(d.v[run.a], d.v[run.b]), seriesY(run.parts, d.f));
  const part = run.parts.find((p) => p.blockId === branchId);
  if (!part) throw new Error(`measured branch "${branchId}" is not in its run`);
  return mul(i, part.z(d.f));
}

/** Measured-branch mode: the stage-1 T-model of the same cap-free sweep driven with the branch voltage (spec §10). */
export function fluxRangeBranch(d: Drive, branchId: string, tUnit: Unit, tLoad: PlateLoad, fPriMax = 0.5, steps = 6): FluxRange {
  const v1 = branchVoltage(d, branchId);
  const points = linspace(0, fPriMax, steps).map((fp) => {
    const s = solveTransformer([{ ...tUnit, f_pri: fp }], tLoad, d.f, v1).units[0];
    return { fPri: fp, bPk_mT: s.b_pk_mT, vLoopRms: s.v_loop_rms };
  });
  return summarize(branchId, points);
}

/** Leakage split that reproduces a measured loop voltage: scan [0, 1] in 20 steps, then bisect the first bracket. */
export function solveFPri(loopV: (fPri: number) => number, measured: number): { fPri: number } | { error: string } {
  const xs = linspace(0, 1, 21);
  const g = xs.map((x) => loopV(x) - measured);
  const exact = g.findIndex((v) => v === 0);
  if (exact >= 0) return { fPri: xs[exact] };
  for (let k = 0; k + 1 < xs.length; k += 1) {
    if (g[k] * g[k + 1] < 0) {
      let a = xs[k];
      let b = xs[k + 1];
      let ga = g[k];
      for (let it = 0; it < 60; it += 1) {
        const m = (a + b) / 2;
        const gm = loopV(m) - measured;
        if (gm === 0) return { fPri: m };
        if (ga * gm < 0) b = m;
        else {
          a = m;
          ga = gm;
        }
      }
      return { fPri: (a + b) / 2 };
    }
  }
  return { error: `no leakage split in [0, 1] gives ${measured} V on the loop; the model structure, not the split, is off` };
}

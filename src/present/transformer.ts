import { cx } from '../engine/complex.ts';
import { solveTransformer } from '../engine/transformer.ts';
import { buildBranchTable } from '../chain/blockZ.ts';
import { allBlocks, findBlock } from '../chain/state.ts';
import type { BranchCache, MeasuredBranchBlock } from '../chain/types.ts';
import { fitTModel } from '../fit/tmodel.ts';
import { drive, reports } from '../stress/drive.ts';
import { type FluxRange, branchVoltage, fluxRangeBranch, fluxRangeStacks } from '../stress/flux.ts';
import { type AppState, type TModel, variantChain } from '../app/state.ts';
import { nearF0Index } from './verdict.ts';

export type TransformerView =
  | { kind: 'none' }
  | { kind: 'needs-turns'; branchId: string }
  | { kind: 'needs-tmodel'; branchId: string }
  | { kind: 'ranges'; source: 'stacks' | 'branch'; ranges: FluxRange[]; extent: Extent[]; loopV: ((fPri: number) => number) | null; split: { label: string; watts: number }[]; branchW: number | null }
  | { kind: 'error'; message: string };

/** The true min/max of flux and loop voltage over leakage split 0–0.5 (the six-row `ranges` are for the table only). */
export interface Extent { blockId: string; bMin: number; bMax: number; vMin: number; vMax: number }

const extentOf = (blockId: string, pts: { bPk_mT: number; vLoopRms: number }[]): Extent => ({
  blockId,
  bMin: Math.min(...pts.map((p) => p.bPk_mT)), bMax: Math.max(...pts.map((p) => p.bPk_mT)),
  vMin: Math.min(...pts.map((p) => p.vLoopRms)), vMax: Math.max(...pts.map((p) => p.vLoopRms)),
});

const branchOf = (s: AppState): MeasuredBranchBlock | undefined => allBlocks(s.chain.blocks).find((b): b is MeasuredBranchBlock => b.type === 'measuredBranch');

/** The stored T-model applies: fitted for the chosen cable assumption with the branch's present turns and cores. */
export function tmodelFits(s: AppState, b: MeasuredBranchBlock): boolean {
  const t = s.tmodel;
  const tr = b.transformer;
  return !!t && !!tr && t.variant === s.variants[s.primary].name && t.sweepId === b.sweepId && t.unit.N_p === tr.nP && t.unit.N_c === tr.nC && Math.abs(t.unit.n - tr.nS / tr.nP) < 1e-9;
}

/** Flux and loop-voltage ranges at `watts` for the chosen cable assumption (spec §8.3), or what is missing for them. */
export function transformerView(s: AppState, grid: number[], watts: number, caches: BranchCache[] = []): TransformerView {
  const k = nearF0Index(grid);
  if (k === null) return { kind: 'error', message: 'the model has no point at 13.56 MHz' };
  const chain = variantChain(s, s.primary);
  caches[s.primary] ??= new Map();
  const ctx = { variant: s.variants[s.primary], sweeps: s.sweeps, cache: caches[s.primary] };
  try {
    const d = (): ReturnType<typeof drive> => drive(chain, ctx, grid[k], watts);
    const splitOf = (dd: ReturnType<typeof drive>): { label: string; watts: number }[] =>
      [...reports(chain, dd).values()].filter((r) => r.powerW > 0.01).map((r) => ({ label: findBlock(s.chain, r.blockId)?.label ?? r.blockId, watts: r.powerW }));
    if (allBlocks(chain.blocks).some((b) => b.type === 'stack')) {
      const dense = fluxRangeStacks(chain, ctx, grid[k], watts, 0.5, 51).map((r) => extentOf(r.blockId, r.points));
      return { kind: 'ranges', source: 'stacks', ranges: fluxRangeStacks(chain, ctx, grid[k], watts), extent: dense, loopV: null, split: splitOf(d()), branchW: null };
    }
    const b = branchOf(s);
    if (!b) return { kind: 'none' };
    if (!b.transformer) return { kind: 'needs-turns', branchId: b.id };
    if (!s.tmodel || !tmodelFits(s, b)) return { kind: 'needs-tmodel', branchId: b.id };
    const t: TModel = s.tmodel;
    const dd = d();
    const v1 = branchVoltage(dd, b.id);
    const at = (fp: number): { bPk_mT: number; vLoopRms: number } => {
      const u = solveTransformer([{ ...t.unit, f_pri: fp }], t.load, dd.f, v1).units[0];
      return { bPk_mT: u.b_pk_mT, vLoopRms: u.v_loop_rms };
    };
    return {
      kind: 'ranges',
      source: 'branch',
      ranges: [fluxRangeBranch(dd, b.id, t.unit, t.load)],
      extent: [extentOf(b.id, Array.from({ length: 1001 }, (_, i) => at((0.5 * i) / 1000)))],
      loopV: (fp) => at(fp).vLoopRms,
      split: splitOf(dd),
      branchW: reports(chain, dd).get(b.id)?.powerW ?? null,
    };
  } catch (e) {
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Stage-1 T-model of the measured branch's cap-free sweep for the chosen cable assumption; takes about 4–5 s (spec §8.3). */
export function fitBranchTModel(s: AppState): TModel {
  const b = branchOf(s);
  if (!b?.transformer) throw new Error('enter the turns and cores first');
  const sweep = s.sweeps[b.sweepId];
  if (!sweep) throw new Error(`the measured part's sweep "${b.sweepId}" is not loaded`);
  const v = s.variants[s.primary];
  const t = buildBranchTable(sweep, v);
  const { nP, nS, nC } = b.transformer;
  const fit = fitTModel(sweep.f, t.re.map((re, i) => cx(re, t.im[i])), { n: nS / nP, fPri: 0, nP, nC });
  return { variant: v.name, sweepId: b.sweepId, unit: fit.unit, load: fit.load, rmsRel: fit.rmsRel };
}

/**
 * Every leakage split in [0, 1] that reproduces a measured loop voltage: scan 40 steps, bisect each sign change. The loop
 * voltage dips and rises with the split, so one reading can fit two splits that a one-port sweep cannot tell apart.
 */
export function fPriSolutions(loopV: (fPri: number) => number, measured: number): number[] {
  const n = 40;
  const xs = Array.from({ length: n + 1 }, (_, i) => i / n);
  const g = xs.map((x) => loopV(x) - measured);
  const out: number[] = [];
  for (let k = 0; k < n; k += 1) {
    if (g[k] === 0) {
      out.push(xs[k]);
      continue;
    }
    if (g[k] * g[k + 1] < 0) {
      let a = xs[k];
      let b = xs[k + 1];
      let ga = g[k];
      for (let it = 0; it < 60; it += 1) {
        const m = (a + b) / 2;
        const gm = loopV(m) - measured;
        if (ga * gm <= 0) b = m;
        else {
          a = m;
          ga = gm;
        }
      }
      out.push((a + b) / 2);
    }
  }
  if (g[n] === 0) out.push(1);
  return out;
}

/** Leakage splits for a loop reading taken at `readingW`, with loopV evaluated at `planW`: V scales with √P (engine spec §10). */
export const fPriAtPower = (loopV: (fPri: number) => number, reading: number, readingW: number, planW: number): number[] =>
  fPriSolutions(loopV, reading * Math.sqrt(planW / readingW));

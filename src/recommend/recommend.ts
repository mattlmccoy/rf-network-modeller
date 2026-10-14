import { type Counts, physicalParts, sumCounts } from '../blocks/ht50.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile } from '../chain/compile.ts';
import { allBlocks, applyState, findBlock } from '../chain/state.ts';
import type { BranchCache, CapBankBlock, Chain, Variant, Window } from '../chain/types.ts';
import { type Sweep, nearestIndex } from '../io/sweep.ts';
import { DriveError, drive, maxCapStressPct, reports } from '../stress/drive.ts';
import { type Candidate, type Pick, candidates, describeMoves, moveCount } from './enumerate.ts';
import { F0, ROOM_SEG, landing } from './landing.ts';
import { type Scored, lowerMedian, rank } from './rank.ts';

export interface FittedVariant { variant: Variant; chain: Chain }

export interface RecommendInput {
  fitted: FittedVariant[];
  sweeps: Record<string, Sweep>;
  grid: number[];
  window: Window;
  stock: Counts;
  searchIds?: string[];
  allowSeriesPairs?: boolean;
  stressWatts?: number;
}

export interface Recommendation extends Scored<Candidate> {
  maxStressPct: number | null;
  movesText: string[];
}

export interface RecommendOutput {
  ranked: Recommendation[];
  all: Recommendation[];
  current: Record<string, Pick>;
}

const capBanks = (chain: Chain): CapBankBlock[] => allBlocks(chain.blocks).filter((b): b is CapBankBlock => b.type === 'capBank');

export const applyPicks = (chain: Chain, picks: Record<string, Pick>): Chain =>
  applyState(chain, Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { counts: p.counts, nSeries: p.nSeries }])));

/** Every buildable pick for the searched banks, landed per fitted variant and ranked (spec §9). */
export function recommend(input: RecommendInput): RecommendOutput {
  const base = input.fitted[0].chain;
  const banks = capBanks(base);
  const searchIds = input.searchIds ?? banks.filter((b) => b.searchable).map((b) => b.id);
  const searched = searchIds.map((id) => {
    const b = findBlock(base, id);
    if (!b || b.type !== 'capBank') throw new Error(`"${id}" is not a cap bank`);
    return b;
  });
  const reserved = sumCounts(banks.filter((b) => !searchIds.includes(b.id)).map((b) => physicalParts(b)));
  const current: Record<string, Pick> = Object.fromEntries(searched.map((b) => [b.id, { counts: b.counts, nSeries: b.nSeries }]));
  const labels = Object.fromEntries(searched.map((b) => [b.id, b.label]));
  const fSeg = input.grid.filter((f) => f > ROOM_SEG[0] && f < ROOM_SEG[1]);
  const f0 = input.grid[nearestIndex(input.grid, F0)];
  const caches = input.fitted.map((): BranchCache => new Map());
  const all = candidates(searched.map((b) => ({ id: b.id, slots: b.slots })), input.stock, reserved, input.allowSeriesPairs).map((cand): Recommendation => {
    let maxStressPct: number | null = null;
    const landings = input.fitted.map((fv, k) => {
      const chain = applyPicks(fv.chain, cand.picks);
      const ctx = { variant: fv.variant, sweeps: input.sweeps, cache: caches[k] };
      const c = compile(chain, ctx);
      const l = landing(fSeg, fSeg.map((f) => inputImpedance(c.net, f)), input.window);
      if (input.stressWatts !== undefined) {
        try {
          const m = maxCapStressPct(reports(chain, drive(chain, ctx, f0, input.stressWatts)));
          if (m !== null) maxStressPct = Math.max(maxStressPct ?? 0, m);
        } catch (e) {
          if (!(e instanceof DriveError)) throw e;
        }
      }
      return l;
    });
    return {
      candidate: cand,
      landings,
      inCount: landings.filter((l) => l.inWindow).length,
      roomScore: lowerMedian(landings.map((l) => l.roomUp)),
      moves: moveCount(current, cand.picks),
      maxStressPct,
      movesText: describeMoves(labels, current, cand.picks),
    };
  });
  return { ranked: rank<Candidate, Recommendation>(all, input.fitted.length), all, current };
}

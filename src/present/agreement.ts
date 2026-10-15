import type { Complex } from '../engine/complex.ts';
import { applyState } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import { evaluateVariants, measuredLanding } from '../app/evaluate.ts';
import type { AppState } from '../app/state.ts';
import { knownState } from './circuit.ts';
import type { Level } from './level.ts';

export const AGREE_OHMS = 3;
export const ROUGH_OHMS = 12;

export type Grade = 'agrees' | 'rough' | 'off' | 'unknown';
export interface GradeResult { grade: Grade; dR: number | null; dX: number | null }

/** Model minus measurement at 13.56 MHz, graded on max(|ΔR|, |ΔX|) (spec §7.2). */
export function gradeOf(meas: Complex | null, pred: Complex | null): GradeResult {
  if (!meas || !pred || ![meas.re, meas.im, pred.re, pred.im].every(Number.isFinite)) return { grade: 'unknown', dR: null, dX: null };
  const dR = pred.re - meas.re;
  const dX = pred.im - meas.im;
  const d = Math.max(Math.abs(dR), Math.abs(dX));
  return { grade: d <= AGREE_OHMS ? 'agrees' : d <= ROUGH_OHMS ? 'rough' : 'off', dR, dX };
}

/** Worst first. */
const ORDER: readonly Grade[] = ['unknown', 'off', 'rough', 'agrees'];

/** The majority grade across cable assumptions; with no majority, the worst one. */
export function combineGrades(gs: readonly Grade[]): Grade {
  const count = (g: Grade): number => gs.filter((x) => x === g).length;
  return ORDER.find((g) => count(g) * 2 > gs.length) ?? ORDER.find((g) => count(g) > 0) ?? 'unknown';
}

/** A fit that did not converge can never be reported as agreeing. */
export const capUnsettled = (g: Grade, unsettled: boolean): Grade => (unsettled && g === 'agrees' ? 'rough' : g);

/** inSample: the active sweep is one the current fit was made from, so agreement is a fit, not a blind check (review I1). */
export interface Agreement { perVariant: GradeResult[]; combined: Grade; unsettled: boolean; inSample: boolean }

/** The active sweep against the model in that sweep's own tagged state; null without an active tagged sweep. */
export function agreementFor(s: AppState, grid: number[], caches: BranchCache[] = []): Agreement | null {
  const tag = s.tagged.find((t) => t.sweepId === s.activeSweep);
  const sweep = s.activeSweep ? s.sweeps[s.activeSweep] : undefined;
  if (!tag || !sweep) return null;
  const meas = measuredLanding(sweep)?.z ?? null;
  const results = evaluateVariants({ ...s, chain: applyState(s.chain, knownState(s.chain, tag.state)) }, grid, caches);
  const perVariant = results.map((r) => gradeOf(meas, r.landing?.z ?? null));
  const unsettled = Object.values(s.fits).some((f) => f.converged === false);
  const inSample = Object.values(s.fits).some((f) => f.sweeps?.includes(tag.sweepId) ?? false);
  return { perVariant, combined: capUnsettled(combineGrades(perVariant.map((g) => g.grade)), unsettled), unsettled, inSample };
}

const ohm = (v: number | null): string => (v === null ? '?' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)} Ω`);

/** Agreement wording by level, with the near-edge warning on rough (spec §7.2). */
export function agreementText(a: Agreement, level: Level, primary: number): string {
  const head = a.inSample ? 'Fit to this sweep (it is part of the fit): ' : '';
  return head + gradeText(a, level, primary);
}

function gradeText(a: Agreement, level: Level, primary: number): string {
  const tail = a.unsettled ? " The last refit didn't settle." : '';
  const g = a.perVariant[primary] ?? a.perVariant[0];
  switch (a.combined) {
    case 'agrees':
      return `The model agrees with this sweep (within ${AGREE_OHMS} Ω).${tail}`;
    case 'rough':
      return level === 'beginner'
        ? `The model is close, not exact.${tail}`
        : `Roughly: resistance ${ohm(g?.dR ?? null)}, reactance ${ohm(g?.dX ?? null)} (model minus sweep). A miss this size can change which suggestion is best and whether the tuner matches near the edge of its range, so treat the ranking as a direction.${tail}`;
    case 'off':
      return `The model doesn't agree with this sweep: refit before trusting suggestions.${tail}`;
    case 'unknown':
      return `Can't compare yet: the sweep or the model has no point at 13.56 MHz.${tail}`;
  }
}

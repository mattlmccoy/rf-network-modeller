import type { Level } from '../present/level.ts';
import { type Advance, type PerLevel, type StepCtx, TOURS, type Tour, type TourId } from './tours.ts';

export interface ResolvedStep { id: string; title: string; text: string; target: string | null; advance: Advance }

/** A per-level value at `level`: its own entry, else Builder's, else whichever level has one. */
function pick<T>(v: PerLevel<T>, level: Level): T {
  if (typeof v !== 'object' || v === null) return v;
  const o = v as { beginner?: T; builder?: T; engineer?: T };
  return (o[level] ?? o.builder ?? o.beginner ?? o.engineer) as T;
}

/** The tours offered at a level (rig history is Engineer-only, like its task). */
export const toursFor = (level: Level): readonly Tour[] => TOURS.filter((t) => t.levels.includes(level));

export const tourById = (id: TourId): Tour => {
  const t = TOURS.find((x) => x.id === id);
  if (!t) throw new Error(`no tour ${id}`);
  return t;
};

/** A tour's steps as shown at a level: per-level text and target resolved, level-limited steps dropped. */
export const stepsFor = (t: Tour, level: Level): ResolvedStep[] =>
  t.steps.filter((s) => !s.levels || s.levels.includes(level)).map((s) => ({ id: s.id, title: s.title, text: pick(s.text, level), target: pick(s.target, level), advance: s.advance }));

/** A state step is done once its check holds; click and look steps complete by user action only. */
export const stepDone = (s: ResolvedStep, c: StepCtx): boolean => s.advance.kind === 'state' && s.advance.done(c);

import type { Landing } from './landing.ts';

/** Drift room beyond which more room no longer outranks fewer part moves (spec §9). */
export const ROOM_CAP = 2.5;

export const lowerMedian = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

export interface Scored<C> {
  candidate: C;
  landings: Landing[];
  inCount: number;
  roomScore: number;
  moves: number;
}

/** Keep picks a majority of variants put in the window; sort by variants in window, capped median room-up, then moves. Stable. */
export function rank<C, S extends Scored<C>>(scored: S[], nVariants: number): S[] {
  return scored
    .filter((s) => s.inCount * 2 > nVariants)
    .sort((a, b) => b.inCount - a.inCount || Math.min(b.roomScore, ROOM_CAP) - Math.min(a.roomScore, ROOM_CAP) || a.moves - b.moves);
}

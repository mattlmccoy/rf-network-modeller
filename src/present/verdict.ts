import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { nearestIndex } from '../io/sweep.ts';
import { F0, type Landing, ROOM_SEG, landing } from '../recommend/landing.ts';
import { ROOM_CAP } from '../recommend/rank.ts';
import type { Level } from './level.ts';

/** Room up (% of 13.56 MHz) below which a match has little room (spec §15.1). */
export const LITTLE_ROOM = 1;

export type VerdictState = 'unknown' | 'outside' | 'little' | 'some' | 'plenty';
export type OffSide = 'rLow' | 'rHigh' | 'xLow' | 'xHigh';
export interface Verdict { state: VerdictState; z: Complex | null; roomUp: number | null; off: OffSide[] }
export const UNKNOWN: Verdict = { state: 'unknown', z: null, roomUp: null, off: [] };

/** Index of the point nearest 13.56 MHz, or null unless it lies in 12.5–14.6 MHz and within one grid step (final review I2). */
export function nearF0Index(f: number[]): number | null {
  if (!f.length) return null;
  const k = nearestIndex(f, F0);
  const fk = f[k];
  if (!(fk > ROOM_SEG[0] && fk < ROOM_SEG[1])) return null;
  const step = Math.max(k > 0 ? fk - f[k - 1] : 0, k + 1 < f.length ? f[k + 1] - fk : 0);
  return Math.abs(fk - F0) > step ? null : k;
}

/** landing() only when the data reach 13.56 MHz; otherwise null, so the verdict says "can't tell" (spec §7.1). */
export const landingNearF0 = (f: number[], z: Complex[], w: Window): Landing | null => (nearF0Index(f) === null ? null : landing(f, z, w));

/** Distance in ohms from z to the window rectangle; 0 inside, infinite for a non-finite z. */
export function windowDistance(z: Complex, w: Window): number {
  if (!z || !Number.isFinite(z.re) || !Number.isFinite(z.im)) return Number.POSITIVE_INFINITY;
  const dr = Math.max(w.rLo - z.re, 0, z.re - w.rHi);
  const dx = Math.max(w.xLo - z.im, 0, z.im - w.xHi);
  return Math.hypot(dr, dx);
}

function offSides(z: Complex, w: Window): OffSide[] {
  const out: OffSide[] = [];
  if (z.re < w.rLo) out.push('rLow');
  if (z.re > w.rHi) out.push('rHigh');
  if (z.im < w.xLo) out.push('xLow');
  if (z.im > w.xHi) out.push('xHigh');
  return out;
}

/** The tuner verdict for one landing (spec §7.1); room up is what matters because heating moves features down. */
export function verdictOf(l: Landing | null, w: Window): Verdict {
  if (!l || !l.z || Number.isNaN(l.z.re) || Number.isNaN(l.z.im)) return { ...UNKNOWN, z: l?.z ?? null };
  if (!l.inWindow) return { state: 'outside', z: l.z, roomUp: null, off: offSides(l.z, w) };
  const state: VerdictState = l.roomUp < LITTLE_ROOM ? 'little' : l.roomUp < ROOM_CAP ? 'some' : 'plenty';
  return { state, z: l.z, roomUp: l.roomUp, off: [] };
}

export interface Combined { state: VerdictState; agree: number; total: number }

/** Worst first. */
export const SEVERITY: readonly VerdictState[] = ['unknown', 'outside', 'little', 'some', 'plenty'];

/** The majority state across cable assumptions; with no majority, the worst one (spec §7.1). */
export function combine(states: readonly VerdictState[]): Combined {
  const total = states.length;
  const count = (s: VerdictState): number => states.filter((x) => x === s).length;
  const major = SEVERITY.find((s) => count(s) * 2 > total);
  const state = major ?? SEVERITY.find((s) => count(s) > 0) ?? 'unknown';
  return { state, agree: count(state), total };
}

/** The verdict to word a combined state with: the chosen assumption's when it agrees, else the first that does. */
export const representative = (vs: readonly Verdict[], primary: number, state: VerdictState): Verdict =>
  (vs[primary]?.state === state ? vs[primary] : vs.find((v) => v.state === state)) ?? UNKNOWN;

const SIDE: Record<OffSide, string> = { rLow: 'resistance too low', rHigh: 'resistance too high', xLow: 'reactance too low', xHigh: 'reactance too high' };
const ROOM: Record<'little' | 'some' | 'plenty', string> = { little: 'little room', some: 'some room', plenty: 'plenty of room' };
const BEGINNER: Record<'little' | 'some' | 'plenty', string> = {
  little: "In the tuner's good range, with little room: warming up may push it out",
  some: "In the tuner's good range, with some room",
  plenty: "In the tuner's good range, with plenty of room",
};

/** Verdict wording by level (spec §7.1). Beginner never shows ohms; Builder notes when assumptions disagree. */
export function verdictText(v: Verdict, level: Level, c?: Combined): string {
  const depends = level === 'builder' && c && c.agree < c.total ? ' (depends on the cable assumption)' : '';
  if (v.state === 'unknown') return "Can't tell yet";
  if (v.state === 'outside') {
    const sides = v.off.map((s) => SIDE[s]).join(', ');
    // the window is where this tuner has matched well (presets.ts AIT_WINDOW), not the limit of what it can reach (reviewer pass C2)
    return level === 'beginner' ? `Outside the tuner's good range${sides ? ` (${sides})` : ''}` : `Outside where the tuner has matched well${sides ? `: ${sides}` : ''}${depends}`;
  }
  if (level === 'beginner') return BEGINNER[v.state];
  const up = v.roomUp ?? 0;
  // the room as a frequency too: "0.8 %" alone does not say of what (reviewer pass)
  return `Inside where the tuner has matched well, with ${ROOM[v.state]} (room to drift up ${up.toFixed(1)} %, about ${Math.round((up / 100) * 1356) * 10} kHz)${depends}`;
}

export type Tone = 'good' | 'warn' | 'bad' | 'unknown';
export const toneOf = (s: VerdictState): Tone => (s === 'unknown' ? 'unknown' : s === 'outside' ? 'bad' : s === 'little' ? 'warn' : 'good');

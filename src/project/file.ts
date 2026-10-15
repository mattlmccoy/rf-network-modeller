import type { Sweep } from '../io/sweep.ts';
import { type AppState, emptyState } from '../app/state.ts';

export const FORMAT = 'rfnm/1';

export class ProjectFileError extends Error {
  constructor(problem: string) {
    super(`This file isn't a modeller project: ${problem}`);
    this.name = 'ProjectFileError';
  }
}

export interface OpenedProject { name: string; savedAt: string; state: AppState }

/** JSON has no Infinity: unbounded parameter bounds are written as null (spec §9). */
const writeInfinity = (_k: string, v: unknown): unknown => (v === Number.POSITIVE_INFINITY || v === Number.NEGATIVE_INFINITY ? null : v);
const readBounds = (k: string, v: unknown): unknown => (v === null && k === 'lo' ? Number.NEGATIVE_INFINITY : v === null && k === 'hi' ? Number.POSITIVE_INFINITY : v);

export function toProjectJson(s: AppState, savedAt: string): string {
  const sweeps = Object.fromEntries(Object.values(s.sweeps).map((w) => [w.id, { name: w.name, f: w.f, gamma: w.gamma.map((g) => [g.re, g.im]) }]));
  const project = { name: s.chain.name, chain: s.chain, variants: s.variants, primary: s.primary, fits: s.fits, sweeps, tagged: s.tagged, activeSweep: s.activeSweep, stock: s.stock, window: s.window, powerW: s.powerW };
  return JSON.stringify({ format: FORMAT, savedAt, project }, writeInfinity);
}

type J = Record<string, any>;
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
function need(ok: boolean, problem: string): asserts ok {
  if (!ok) throw new ProjectFileError(problem);
}

function sweepsOf(raw: J): Record<string, Sweep> {
  const out: Record<string, Sweep> = {};
  for (const [id, w] of Object.entries(raw)) {
    need(isObj(w) && typeof w.name === 'string' && Array.isArray(w.f) && Array.isArray(w.gamma), `sweep "${id}" is malformed`);
    need(w.f.length > 0 && w.f.length === w.gamma.length, `sweep "${id}" has ${w.f.length} frequencies but ${w.gamma.length} points`);
    need(w.f.every(isNum) && w.gamma.every((g: unknown) => Array.isArray(g) && g.length === 2 && isNum(g[0]) && isNum(g[1])), `sweep "${id}" has points that aren't numbers`);
    out[id] = { id, name: w.name, f: w.f, gamma: w.gamma.map(([re, im]: [number, number]) => ({ re, im })) };
  }
  return out;
}

/** A project from a file's text, validated; failures say what is wrong (spec §9). */
export function fromProjectJson(text: string): OpenedProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text, readBounds);
  } catch {
    throw new ProjectFileError('it is not valid JSON');
  }
  need(isObj(raw), 'it is not a JSON object');
  need(raw.format === FORMAT, `its format is ${JSON.stringify(raw.format ?? null)}, not "${FORMAT}"`);
  need(typeof raw.savedAt === 'string', 'it has no save time');
  const p = raw.project;
  need(isObj(p) && typeof p.name === 'string', 'it has no project name');
  need(isObj(p.chain) && Array.isArray(p.chain.blocks), 'it has no circuit');
  need(Array.isArray(p.variants) && p.variants.length > 0, 'it has no cable assumptions');
  need(Number.isInteger(p.primary) && p.primary >= 0 && p.primary < p.variants.length, 'its chosen cable assumption is out of range');
  need(isObj(p.fits), 'its fits are malformed');
  need(isObj(p.sweeps), 'it has no sweeps table');
  const sweeps = sweepsOf(p.sweeps);
  need(Array.isArray(p.tagged) && p.tagged.every((t: unknown) => isObj(t) && typeof t.sweepId === 'string' && typeof t.label === 'string' && isObj(t.state) && typeof t.include === 'boolean' && typeof t.structure === 'string'), 'a tagged sweep is malformed');
  need(p.tagged.every((t: J) => t.sweepId in sweeps), 'a tagged sweep refers to a missing sweep');
  need(p.activeSweep === null || (typeof p.activeSweep === 'string' && p.activeSweep in sweeps), 'its shown sweep is missing');
  need(isObj(p.stock) && [100, 50, 30].every((v) => isNum(p.stock[v])), 'its parts on hand are malformed');
  need(isObj(p.window) && ['rLo', 'rHi', 'xLo', 'xHi'].every((k) => isNum(p.window[k])), 'its tuner window is malformed');
  need(isNum(p.powerW) && p.powerW > 0, 'its planned power is malformed');
  return {
    name: p.name,
    savedAt: raw.savedAt,
    state: { ...emptyState(), chain: p.chain as AppState['chain'], variants: p.variants, primary: p.primary, fits: p.fits, sweeps, tagged: p.tagged, activeSweep: p.activeSweep, stock: p.stock as AppState['stock'], window: p.window as AppState['window'], powerW: p.powerW },
  };
}

import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
import { structureKey } from '../present/circuit.ts';
import type { AppState } from './state.ts';

export interface ExampleSweep { id: string; file: string; label: string; series: number[]; shunt: number[]; loop: boolean }
export interface ExampleFit { variant: string; x: number[]; q: number; source: string }
export interface ExampleManifest { name: string; capFree: string; sweeps: ExampleSweep[]; fits: ExampleFit[] }

const sweepOf = (id: string, file: string, text: string | undefined): Sweep => {
  if (text === undefined) throw new Error(`example file ${file} is missing`);
  const t = parseS1p(text);
  return { id, name: file, f: t.f, gamma: t.gamma };
};
const c3 = (n: number[]) => counts(n[0], n[1], n[2]);

/** The O7 example: the preset as built 2026-10-14 (80/180, loop on), the five tagged 10-13 sweeps, and the Python fits. */
export function exampleState(m: ExampleManifest, texts: Record<string, string>): AppState {
  const sweeps: Record<string, Sweep> = { capfree: sweepOf('capfree', m.capFree, texts[m.capFree]) };
  for (const s of m.sweeps) sweeps[s.id] = sweepOf(s.id, s.file, texts[s.file]);
  const chain = { ...o7Chain('capfree'), name: m.name };
  return {
    chain,
    variants: DEFAULT_VARIANTS,
    primary: 0,
    fits: Object.fromEntries(m.fits.map((f) => [f.variant, { refs: [...O7_REFS, O7_LOOP_REF], x: [...f.x, f.q], source: f.source, converged: null, rms: null, illDetermined: [] }])),
    sweeps,
    tagged: m.sweeps.map((s) => ({ sweepId: s.id, label: s.label, state: o7State(c3(s.series), c3(s.shunt), s.loop), include: true, structure: structureKey(chain) })),
    activeSweep: m.sweeps.at(-1)?.id ?? null,
    stock: DEFAULT_STOCK,
    window: AIT_WINDOW,
    powerW: 500,
    selected: null,
    panes: ['smith', 's11db', 'rx', 'vswr'],
  };
}

/** Fetches the example manifest and its sweeps (browser). */
export async function loadExample(base = 'examples/o7/'): Promise<AppState> {
  const res = await fetch(`${base}o7.json`);
  if (!res.ok) throw new Error(`example manifest: HTTP ${res.status}`);
  const m = (await res.json()) as ExampleManifest;
  const files = [m.capFree, ...m.sweeps.map((s) => s.file)];
  const texts = Object.fromEntries(await Promise.all(files.map(async (f) => {
    const r = await fetch(`${base}${f}`);
    if (!r.ok) throw new Error(`example sweep ${f}: HTTP ${r.status}`);
    return [f, await r.text()] as const;
  })));
  return exampleState(m, texts);
}

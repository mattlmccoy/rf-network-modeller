import { readFileSync } from 'node:fs';
import type { Complex } from '../src/engine/complex.ts';
import { type Counts, counts } from '../src/blocks/ht50.ts';
import { evaluate } from '../src/chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, cdChain, o7Chain, o7State } from '../src/chain/presets.ts';
import { type TaggedSweep, applyState } from '../src/chain/state.ts';
import { fitNetwork } from '../src/fit/network.ts';
import { fitShort } from '../src/fit/short.ts';
import { parseS1p } from '../src/io/s1p.ts';
import { type Sweep, nearestIndex, zFromGamma } from '../src/io/sweep.ts';

export interface ReplayRow { variant: string; step: string; ts: Complex; python: Complex; measured: Complex }
export interface ShortRow { length: number; tsNh: number; pythonNh: number; recordedNh: number }
export interface ReplayResult {
  tolOhm: number;
  rows: ReplayRow[];
  cd: { ts: Complex; python: Complex; measured: Complex; f: number };
  shorts: ShortRow[];
}

/** Jumper inductance per cable length recorded for the new jumpers (SWEEP_NOTES.md L408). */
const RECORDED_LJ_NH = [342, 329, 256];
const pair = (p: number[]): Complex => ({ re: p[0], im: p[1] });

export const gateOk = (r: ReplayRow, tol: number): boolean => Math.abs(r.ts.re - r.python.re) <= tol && Math.abs(r.ts.im - r.python.im) <= tol;
export const replayPasses = (r: ReplayResult): boolean => r.rows.every((row) => gateOk(row, r.tolOhm));

/** Replays the 2026-10-13 history blind with the TypeScript tool (spec §14 step 5) plus the ungated cross-checks. */
export function runReplay(root: URL, tolOhm = 0.5): ReplayResult {
  const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
  const sweep = (id: string, file: string): Sweep => {
    const t = parseS1p(read(`fixtures/sweeps/${file}`));
    return { id, name: file, f: t.f, gamma: t.gamma };
  };
  const fx = JSON.parse(read('fixtures/python/o7_fit.json'));
  const cdFx = JSON.parse(read('fixtures/python/cd_check.json'));
  const shortFx = JSON.parse(read('fixtures/python/tmodel_short.json'));
  const S = {
    capfree: sweep('capfree', O7_FILES.capFree),
    s130: sweep('s130', O7_FILES.s130_230),
    s100: sweep('s100', O7_FILES.s100_200),
    s80: sweep('s80', O7_FILES.s80_200),
    s80L: sweep('s80L', O7_FILES.s80_200_loop),
    s180L: sweep('s180L', O7_FILES.s80_180_loop),
  };
  const all = { capfree: S.capfree };
  const k0 = nearestIndex(S.capfree.f, 13.56e6);
  const f0 = [S.capfree.f[k0]];
  const tag = (s: Sweep, series: Counts, shunt: Counts, loop: boolean): TaggedSweep => ({ sweep: s, state: o7State(series, shunt, loop), include: true });
  const rows: ReplayRow[] = [];
  DEFAULT_VARIANTS.forEach((variant, i) => {
    const v = fx.variants[i];
    const two = [tag(S.s130, counts(1, 0, 1), counts(2, 0, 1), false), tag(S.s100, counts(1, 0, 0), counts(2, 0, 0), false)];
    const f2 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: two, variant, allSweeps: all });
    rows.push({ variant: variant.name, step: '80/200 predicted from 130/230 + 100/200',
      ts: evaluate(applyState(f2.chain, o7State(counts(0, 1, 1), counts(2, 0, 0), false)), { variant, sweeps: all }, f0)[0],
      python: pair(v.fit2.pred_80_200), measured: zFromGamma(S.s80.gamma[k0]) });
    const f3 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: [...two, tag(S.s80, counts(0, 1, 1), counts(2, 0, 0), false)], variant, allSweeps: all });
    const loop = fitNetwork({ chain: f3.chain, refs: [O7_LOOP_REF], sweeps: [tag(S.s80L, counts(0, 1, 1), counts(2, 0, 0), true)], variant, allSweeps: all, x0: [20] });
    rows.push({ variant: variant.name, step: '80/180 + loop predicted from 3 sweeps + loop shift',
      ts: evaluate(applyState(loop.chain, o7State(counts(0, 1, 1), counts(1, 1, 1), true)), { variant, sweeps: all }, f0)[0],
      python: pair(v.loop.pred_80_180_loop), measured: zFromGamma(S.s180L.gamma[k0]) });
  });
  const cd = sweep('cd', O7_FILES.cdNet);
  const kc = nearestIndex(cd.f, 13.56e6);
  const cdTs = evaluate(cdChain(), { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} }, [cd.f[kc]])[0];
  const short = sweep('short', O7_FILES.shortNew);
  const pyShort = shortFx.shorts.find((s: { file: string }) => s.file === O7_FILES.shortNew);
  const shorts = DEFAULT_VARIANTS.map((v, i) => ({
    length: v.cable.length,
    tsNh: fitShort(short, { length: v.cable.length, fitLength: false }).L * 1e9,
    pythonNh: pyShort.fixed[i].L_nH,
    recordedNh: RECORDED_LJ_NH[i],
  }));
  return { tolOhm, rows, cd: { ts: cdTs, python: pair(cdFx.pred), measured: zFromGamma(cd.gamma[kc]), f: cd.f[kc] }, shorts };
}

const z = (c: Complex): string => `${c.re.toFixed(2)} ${c.im >= 0 ? '+' : '−'} j${Math.abs(c.im).toFixed(2)}`;
const d = (a: number): string => `${a >= 0 ? '+' : '−'}${Math.abs(a).toFixed(2)}`;

export function renderReport(r: ReplayResult, date: string): string {
  const pass = replayPasses(r);
  const ok = r.rows.filter((row) => gateOk(row, r.tolOhm)).length;
  return [
    '# Validation: blind replay of the 2026-10-13 O7 history',
    '',
    `Run ${date} by \`npm run validate\` (tools/validate.ts) on fixtures/sweeps and fixtures/python.`,
    '',
    `**Gate (spec §14):** the TypeScript prediction matches the recorded Python prediction within ±${r.tolOhm} Ω in R and in X, for every variant. Result: **${pass ? 'PASS' : 'FAIL'}** (${ok} of ${r.rows.length} rows).`,
    '',
    '## 1. Gate: TypeScript vs the recorded Python predictions',
    '',
    '| Variant | Prediction | TypeScript Z (Ω) | Python Z (Ω) | ΔR | ΔX | Gate |',
    '|---|---|---|---|---|---|---|',
    ...r.rows.map((row) => `| ${row.variant} | ${row.step} | ${z(row.ts)} | ${z(row.python)} | ${d(row.ts.re - row.python.re)} | ${d(row.ts.im - row.python.im)} | ${gateOk(row, r.tolOhm) ? 'PASS' : 'FAIL'} |`),
    '',
    '## 2. Prediction vs measurement (reported, not gated)',
    '',
    '| Variant | Prediction | Predicted Z (Ω) | Measured Z (Ω) | ΔR | ΔX |',
    '|---|---|---|---|---|---|',
    ...r.rows.map((row) => `| ${row.variant} | ${row.step} | ${z(row.ts)} | ${z(row.measured)} | ${d(row.ts.re - row.measured.re)} | ${d(row.ts.im - row.measured.im)} |`),
    '',
    `## 3. C+D cross-check at ${(r.cd.f / 1e6).toFixed(4)} MHz (reported, not gated)`,
    '',
    'T-model fitted to the 2026-09-30 cap-free sweep; series 100 pF, shunt 3 × 100 + 30 pF; no fitted board inductance; 1.5094 m cable; compared with the 2026-10-01 sweep.',
    '',
    '| Source | Z (Ω) |',
    '|---|---|',
    `| TypeScript | ${z(r.cd.ts)} |`,
    `| Python | ${z(r.cd.python)} |`,
    `| Measured | ${z(r.cd.measured)} |`,
    '',
    '## 4. Shorted-jumper fit at fixed cable lengths (reported, not gated)',
    '',
    'Band 2–25 MHz. The historical band is not recorded, so the recorded values are a comparison, not a target.',
    '',
    '| Cable (m) | TypeScript L_j (nH) | Python L_j (nH) | Recorded L_j (nH) |',
    '|---|---|---|---|',
    ...r.shorts.map((s) => `| ${s.length} | ${s.tsNh.toFixed(1)} | ${s.pythonNh.toFixed(1)} | ${s.recordedNh} |`),
    '',
    '## What this shows',
    '',
    '- Section 1 passing means the TypeScript tool reproduces the Python model on the same data. It does not show the model is right.',
    "- Section 2 is the model's real accuracy on a build it had not seen. Read it before trusting a recommendation.",
    '- Sections 3 and 4 rest on recipes whose historical settings are not fully recorded, so they are comparisons, not gates.',
    '',
  ].join('\n');
}

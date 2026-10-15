# RF Network Modeller Plan 3B: "Try a change first" and "Safe at full power?" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two Phase B tasks:
- **Try a change first:** change a part, see before and after, keep or undo.
- **Safe at full power?:** capacitor stress at a planned power, the safe power for the capacitors, and transformer flux and loop-voltage ranges.

**Architecture:**
- New pure modules `src/present/power.ts` and `src/present/transformer.ts` wrap the existing stress engine (`drive`, `reports`, `fluxRangeStacks`, `fluxRangeBranch`, `solveFPri`, `fitTModel`). They are TDD'd against the real O7 example.
- `AppState` gains a stored stage-1 transformer model, `tmodel`. The O7 example ships the Python fixture's model.
- The Workbench routes to a guide per task. Home enables the two tiles.

**Tech Stack:** TypeScript 5.9.3 run directly by Node (`--experimental-strip-types`), React 19.2.6, Vite 8.0.13, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-15-rf-network-modeller-ux-design.md` §8.2 and §8.3, plus §5 (levels) and §12 (honesty). Engine behaviour: `docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md` §10.

## Global Constraints

- **Repo and branch:** `~/code/put_github_repos_here/rf-network-modeller`, branch `feat/plan3b-power-change`. Never push from a task.
- **Module rules:** `.ts`/`.tsx` import extensions; `import type` for types; no enums, namespaces or parameter properties.
- **Never** `arr.map(gammaFromZ)` / `arr.map(zFromGamma)`.
- **Unknown never renders as healthy.** A failed drive or no rated part means "Can't tell", never a number.
- **No internal jargon on screen:** "AIT", "variant", "landing". Engineer may say "cable assumption".
- `src/ui/nanovna.css` is never edited.
- **No new dependencies; no superfluous code.**
- **Every commit message** ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A typed planned power of 0, a negative number, or empty.** It must be ignored, with no NaN stresses. Task 1: `setPower` test.
2. **The drive fails** (an open port, or Re Z ≤ 0). The result is "Can't tell", with no safe-power number. Task 2: blank-chain test.
3. **A transformer model that no longer applies** (fitted for another cable assumption, or the turns changed since). The task asks to refit; it does not show stale flux. Task 3: test.
4. **A measured loop voltage no leakage split can produce.** It says the model structure is off, with no crash. Task 3: test.
5. **Undo after an edit that dropped fitted values.** The fits come back with the circuit. Task 4: browser gate. Undo restores `chain` and `fits` together.

---

### Task 1: State and data for Phase B

**Files:**
- Modify: `src/app/state.ts`, `src/chain/types.ts`, `src/chain/presets.ts`, `src/app/example.ts`, `tools/make_example.ts`, `src/project/file.ts`
- Regenerate: `public/examples/o7/o7.json` (`npm run example`)
- Test: `src/app/state.test.ts`, `src/app/example.test.ts`, `src/project/file.test.ts`

**Interfaces:**
- Produces, in `state.ts`:
  - `interface TModel { variant: string; unit: Unit; load: PlateLoad; rmsRel: number }`;
  - `AppState.tmodel: TModel | null` (default `null`);
  - actions `{ type: 'setPower'; watts: number }` and `{ type: 'setTModel'; tmodel: TModel | null }`.
- Produces, in `types.ts`: `MeasuredBranchBlock.transformer?: { nP: number; nS: number; nC: number }`. The O7 preset sets `{ nP: 3, nS: 15, nC: 4 }`.
- Produces: `ExampleManifest.tmodel?: TModel`.
- Project files persist `tmodel`. A file without it (Plan 3A) opens with `tmodel: null`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/state.test.ts`:

```ts
test('setPower takes a finite positive power and ignores anything else (review focus 1)', () => {
  assert.equal(reducer(base, { type: 'setPower', watts: 300 }).powerW, 300);
  for (const w of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(reducer(base, { type: 'setPower', watts: w }).powerW, 500);
});

test('setTModel stores or clears the transformer model', () => {
  const tm = { variant: 'v', unit: { n: 5, L_leak: 1e-6, f_pri: 0, L_m: 1e-6, G_core: 1e-4, R1: 1, R2: 9, C_w: 0, N_p: 3, N_c: 4 }, load: { C: 7e-12, G_cube: 0, G_fix: 0 }, rmsRel: 0.05 };
  const s = reducer(base, { type: 'setTModel', tmodel: tm });
  assert.deepEqual(s.tmodel, tm);
  assert.equal(reducer(s, { type: 'setTModel', tmodel: null }).tmodel, null);
  assert.equal(emptyState().tmodel, null);
});
```

Append to `src/app/example.test.ts`:

```ts
test('the example ships the Python T-model for the first cable assumption, and the O7 pair knows its turns', () => {
  const s = exampleState(m, texts);
  const tm = readFixtureJson<{ tmodel: { unit: unknown; load: unknown } }>('tmodel_short.json').tmodel;
  assert.equal(s.tmodel?.variant, DEFAULT_VARIANTS[0].name);
  assert.deepEqual(s.tmodel?.unit, tm.unit);
  assert.deepEqual(s.tmodel?.load, tm.load);
  const b = s.chain.blocks.flatMap((x) => (x.type === 'shunt' ? x.chain : [x])).find((x) => x.id === 'branch');
  assert.ok(b?.type === 'measuredBranch');
  assert.deepEqual(b.transformer, { nP: 3, nS: 15, nC: 4 });
});
```

Append to `src/project/file.test.ts`:

```ts
test('a Plan 3A file without a transformer model opens with none; a malformed one is rejected', () => {
  const j = JSON.parse(toProjectJson(ex, T));
  delete j.project.tmodel;
  assert.equal(fromProjectJson(JSON.stringify(j)).state.tmodel, null);
  j.project.tmodel = { variant: 'x', unit: 'nope', load: {}, rmsRel: 0.1 };
  assert.throws(() => fromProjectJson(JSON.stringify(j)), /its transformer model is malformed/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test 2>&1 | grep -E "ℹ (pass|fail)"`
Expected: FAIL in the new tests. `setPower` is unknown, so `powerW` stays at 500 and the 300 assertion fails. `tmodel` is undefined. `transformer` is undefined.

- [ ] **Step 3: Implement**

1. In `src/chain/types.ts`, give `MeasuredBranchBlock` an optional field:

```ts
export interface MeasuredBranchBlock extends Base {
  type: 'measuredBranch'; sweepId: string; kr: Param; d: Param; dLb: Param; loop: boolean;
  /** Turns and cores of the measured transformer; only flux needs them (spec §8.3). */
  transformer?: { nP: number; nS: number; nC: number };
}
```

2. In `src/chain/presets.ts`, `o7Chain`'s `branch` block gains `transformer: { nP: 3, nS: 15, nC: 4 },` after `loop: true`.

3. In `src/app/state.ts`:
   - add `import type { PlateLoad, Unit } from '../engine/transformer.ts';`;
   - add the type:

```ts
/** The stage-1 T-model of a measured branch's cap-free sweep, fitted for one cable assumption (spec §8.3). */
export interface TModel { variant: string; unit: Unit; load: PlateLoad; rmsRel: number }
```

   - add `tmodel: TModel | null;` to `AppState` after `powerW`, and `tmodel: null,` to `emptyState()`;
   - add to `Action`:

```ts
  | { type: 'setPower'; watts: number }
  | { type: 'setTModel'; tmodel: TModel | null }
```

   - add the reducer cases:

```ts
    case 'setPower':
      return Number.isFinite(a.watts) && a.watts > 0 ? { ...s, powerW: a.watts } : s;
    case 'setTModel':
      return { ...s, tmodel: a.tmodel };
```

4. In `src/app/example.ts`:
   - `ExampleManifest` gains `tmodel?: TModel` (import `type TModel` from `./state.ts`);
   - `exampleState` sets `tmodel: m.tmodel ?? null,` after `powerW: 500,`.

5. In `tools/make_example.ts`, add before `writeFileSync`:

```ts
const tm = JSON.parse(readFileSync(new URL('fixtures/python/tmodel_short.json', root), 'utf8')).tmodel as { variant: string; unit: TModel['unit']; load: TModel['load']; rms_rel: number };
if (Number(tm.variant) !== DEFAULT_VARIANTS[0].cable.length) throw new Error('tmodel_short.json was not fitted for the first cable assumption');
manifest.tmodel = { variant: DEFAULT_VARIANTS[0].name, unit: tm.unit, load: tm.load, rmsRel: tm.rms_rel };
```

   Also:
   - add `import type { TModel } from '../src/app/state.ts';`;
   - change `const manifest: ExampleManifest = {` so the object stays mutable (it is a `const` object, so assigning a property is fine);
   - then run `npm run example`.

6. In `src/project/file.ts`:
   - add `tmodel: s.tmodel` to the `project` object in `toProjectJson`;
   - in `fromProjectJson`, before the return, add:

```ts
  need(p.tmodel === undefined || p.tmodel === null || (isObj(p.tmodel) && typeof p.tmodel.variant === 'string' && isObj(p.tmodel.unit) && isObj(p.tmodel.load) && isNum(p.tmodel.rmsRel)), 'its transformer model is malformed');
```

   - add `tmodel: p.tmodel ?? null` to the returned state.

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The `fromProjectJson(toProjectJson(ex))` round-trip test now covers `tmodel` too.

- [ ] **Step 5: Commit**

```bash
git add src/app/state.ts src/chain/types.ts src/chain/presets.ts src/app/example.ts tools/make_example.ts src/project/file.ts public/examples/o7/o7.json src/app/state.test.ts src/app/example.test.ts src/project/file.test.ts
git commit -m "feat(state): planned power and a stored transformer model; the O7 pair knows its turns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Capacitor stress and safe power

**Files:**
- Create: `src/present/power.ts`
- Test: `src/present/power.test.ts`

**Interfaces:**
- Consumes: `drive`, `reports` (`src/stress/drive.ts`); `nearF0Index` (verdict); `stressFlag`, `StressFlag` (recs).
- Produces:
  - `interface CapRow { blockId: string; label: string; pf: number; count: number; vRms: number; iRms: number; pct: number | null; limit: 'voltage' | 'current' | null; flag: StressFlag }`;
  - `interface CapStress { watts: number; rows: CapRow[]; worstPct: number | null; limiting: CapRow | null; safeW: number | null; errors: string[] }`;
  - `safePower(watts: number, worstPct: number | null): number | null`;
  - `capStress(s: AppState, grid: number[], watts: number, caches?: BranchCache[]): CapStress`;
  - `powerText(cs: CapStress, level: Level): string`.

- [ ] **Step 1: Write the failing test** `src/present/power.test.ts`

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { defaultGrid, evalGrid } from '../app/grid.ts';
import { emptyState } from '../app/state.ts';
import { ROOT } from '../testutil.ts';
import { capStress, powerText, safePower } from './power.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const grid = evalGrid(ex.chain, ex.sweeps);

test('O7 at 500 W: the 100 pF shunt part is current-limited at 111.5 % (worst cable assumption); safe to about 400 W', () => {
  const cs = capStress(ex, grid, 500);
  assert.equal(cs.rows.length, 5);
  assert.deepEqual([cs.limiting?.blockId, cs.limiting?.pf, cs.limiting?.limit, cs.limiting?.flag], ['sh', 100, 'current', 'red']);
  assert.ok(cs.worstPct !== null && Math.abs(cs.worstPct - 111.5) < 0.2, `worst ${cs.worstPct}`);
  assert.equal(cs.safeW, safePower(500, cs.worstPct));
  assert.equal(powerText(cs, 'beginner'), 'At 500 W the 100 pF part in the Shunt bank would carry 112 % of its rated current. The capacitors are safe up to about 400 W.');
});

test('stress scales with the square root of power: at 300 W the same build is within its ratings', () => {
  const cs = capStress(ex, grid, 300);
  assert.ok(cs.worstPct !== null && Math.abs(cs.worstPct - 111.5 * Math.sqrt(0.6)) < 0.3);
  assert.equal(cs.limiting?.flag, 'amber');
  assert.equal(powerText(cs, 'beginner'), 'The capacitors are within their ratings at 300 W. The capacitors are safe up to about 400 W.');
  assert.match(powerText(cs, 'builder'), /^At 300 W the worst capacitor \(the 100 pF part in the Shunt bank\) is at 86 % of its rated current\./);
});

test('a drive that fails says "Can\'t tell" and gives no safe power (review focus 2)', () => {
  const blank = { ...emptyState(), chain: { name: 'blank', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] } };
  const cs = capStress(blank, defaultGrid(), 500);
  assert.equal(cs.safeW, null);
  assert.ok(cs.errors.length > 0);
  assert.match(powerText(cs, 'builder'), /^Can't tell: /);
});

test('safePower: V and I scale with √P, so P_max = P (100 / worst %)²; unknown without a rated part', () => {
  assert.ok(Math.abs((safePower(500, 111.5) ?? 0) - 402.18) < 0.01);
  assert.equal(safePower(500, null), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/power.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./power.ts`.

- [ ] **Step 3: Write `src/present/power.ts`**

```ts
import { findBlock } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import { drive, reports } from '../stress/drive.ts';
import { type AppState, variantChain } from '../app/state.ts';
import type { Level } from './level.ts';
import { type StressFlag, stressFlag } from './recs.ts';
import { nearF0Index } from './verdict.ts';

export interface CapRow { blockId: string; label: string; pf: number; count: number; vRms: number; iRms: number; pct: number | null; limit: 'voltage' | 'current' | null; flag: StressFlag }
export interface CapStress { watts: number; rows: CapRow[]; worstPct: number | null; limiting: CapRow | null; safeW: number | null; errors: string[] }

/** The capacitors' limit: V and I scale with √P, so P_max = P (100 / worst %)² (spec §8.3); unknown without a rated part. */
export const safePower = (watts: number, worstPct: number | null): number | null => (worstPct === null || !(worstPct > 0) ? null : watts * (100 / worstPct) ** 2);

/** Every capacitor part at `watts`, each at its worst cable assumption; any failed drive makes the safe power unknown. */
export function capStress(s: AppState, grid: number[], watts: number, caches: BranchCache[] = []): CapStress {
  const k = nearF0Index(grid);
  if (k === null) return { watts, rows: [], worstPct: null, limiting: null, safeW: null, errors: ['the model has no point at 13.56 MHz'] };
  const rows = new Map<string, CapRow>();
  const errors: string[] = [];
  s.variants.forEach((variant, i) => {
    caches[i] ??= new Map();
    const chain = variantChain(s, i);
    try {
      for (const r of reports(chain, drive(chain, { variant, sweeps: s.sweeps, cache: caches[i] }, grid[k], watts)).values()) {
        for (const p of r.parts ?? []) {
          const key = `${r.blockId}:${p.pf}`;
          const prev = rows.get(key);
          if (prev && (prev.pct ?? -1) >= (p.pct ?? -1)) continue;
          const limit = p.pct === null ? null : (p.pctV ?? 0) >= (p.pctI ?? 0) ? 'voltage' : 'current';
          rows.set(key, { blockId: r.blockId, label: findBlock(s.chain, r.blockId)?.label ?? r.blockId, pf: p.pf, count: p.count, vRms: p.vRms, iRms: p.iRms, pct: p.pct, limit, flag: stressFlag(p.pct) });
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  });
  const list = [...rows.values()];
  const limiting = list.filter((r) => r.pct !== null).reduce<CapRow | null>((w, r) => (w === null || (r.pct ?? 0) > (w.pct ?? 0) ? r : w), null);
  const worstPct = errors.length ? null : (limiting?.pct ?? null);
  return { watts, rows: list, worstPct, limiting: errors.length ? null : limiting, safeW: safePower(watts, worstPct), errors };
}

const about = (w: number): number => Math.round(w / 10) * 10;

/** Plain wording by level (spec §8.3); "Can't tell" whenever there is no safe-power number. */
export function powerText(cs: CapStress, level: Level): string {
  const p = cs.limiting;
  if (cs.safeW === null || cs.worstPct === null || !p) return `Can't tell: ${cs.errors[0] ?? 'no rated capacitor carries current'}.`;
  const pct = Math.round(cs.worstPct);
  const safe = `The capacitors are safe up to about ${about(cs.safeW)} W.`;
  if (cs.worstPct >= 100) return `At ${cs.watts} W the ${p.pf} pF part in the ${p.label} would ${p.limit === 'voltage' ? `see ${pct} % of its rated voltage` : `carry ${pct} % of its rated current`}. ${safe}`;
  if (level === 'beginner') return `The capacitors are within their ratings at ${cs.watts} W. ${safe}`;
  return `At ${cs.watts} W the worst capacitor (the ${p.pf} pF part in the ${p.label}) is at ${pct} % of its rated ${p.limit}. ${safe}`;
}
```

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/present/power.ts src/present/power.test.ts
git commit -m "feat(present): capacitor stress at a planned power, worst across cable assumptions, and the safe power

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Transformer flux, loop voltage, and the in-browser T-model fit

**Files:**
- Create: `src/present/transformer.ts`
- Test: `src/present/transformer.test.ts`

**Interfaces:**
- Consumes: `fluxRangeStacks`, `fluxRangeBranch`, `branchVoltage`, `solveFPri`, `FluxRange` (`src/stress/flux.ts`); `drive`, `reports`; `solveTransformer` (`src/engine/transformer.ts`); `buildBranchTable` (`src/chain/blockZ.ts`); `fitTModel` (`src/fit/tmodel.ts`); `TModel` (Task 1).
- Produces:
  - `type TransformerView`, one of:
    - `{ kind: 'none' }`;
    - `{ kind: 'needs-turns'; branchId: string }`;
    - `{ kind: 'needs-tmodel'; branchId: string }`;
    - `{ kind: 'ranges'; source: 'stacks' | 'branch'; ranges: FluxRange[]; loopV: ((fPri: number) => number) | null; split: { label: string; watts: number }[] }`;
    - `{ kind: 'error'; message: string }`;
  - `tmodelFits(s: AppState, b: MeasuredBranchBlock): boolean`;
  - `transformerView(s: AppState, grid: number[], watts: number, caches?: BranchCache[]): TransformerView`;
  - `fitBranchTModel(s: AppState): TModel`;
  - re-export `solveFPri`.

- [ ] **Step 1: Write the failing test** `src/present/transformer.test.ts`

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { updateBlock } from '../chain/state.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { defaultGrid, evalGrid } from '../app/grid.ts';
import { emptyState } from '../app/state.ts';
import { ROOT, readFixtureJson } from '../testutil.ts';
import { fitBranchTModel, solveFPri, transformerView } from './transformer.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const grid = evalGrid(ex.chain, ex.sweeps);

test('O7 with the shipped T-model at 500 W: flux 0.47–6.31 mT and loop 4.5–60 V over leakage split 0–0.5', () => {
  const v = transformerView(ex, grid, 500);
  assert.equal(v.kind, 'ranges');
  if (v.kind !== 'ranges') return;
  const r = v.ranges[0];
  assert.ok(Math.abs(r.bMin - 0.47) < 0.01 && Math.abs(r.bMax - 6.31) < 0.01, `B ${r.bMin}–${r.bMax}`);
  assert.ok(Math.abs(r.vMin - 4.5) < 0.05 && Math.abs(r.vMax - 60.0) < 0.1, `V ${r.vMin}–${r.vMax}`);
  assert.equal(v.split.length, 1, 'the measured pair absorbs everything and cannot be split');
  assert.ok(Math.abs(v.split[0].watts - 500) < 0.5);
});

test('a measured loop voltage solves the leakage split; an impossible reading says so (review focus 4)', () => {
  const v = transformerView(ex, grid, 500);
  assert.ok(v.kind === 'ranges' && v.loopV);
  const ok = solveFPri(v.loopV, 20);
  assert.ok('fPri' in ok && ok.fPri > 0 && ok.fPri < 0.5, JSON.stringify(ok));
  assert.ok('error' in solveFPri(v.loopV, 1e6));
});

test('no turns asks for them; a missing, other-assumption or other-turns T-model asks for a refit (review focus 3)', () => {
  const noTurns = { ...ex, chain: updateBlock(ex.chain, 'branch', { transformer: undefined }) };
  assert.equal(transformerView(noTurns, grid, 500).kind, 'needs-turns');
  assert.equal(transformerView({ ...ex, tmodel: null }, grid, 500).kind, 'needs-tmodel');
  assert.equal(transformerView({ ...ex, primary: 1 }, grid, 500).kind, 'needs-tmodel');
  const turns = { ...ex, chain: updateBlock(ex.chain, 'branch', { transformer: { nP: 3, nS: 18, nC: 4 } }) };
  assert.equal(transformerView(turns, grid, 500).kind, 'needs-tmodel');
});

test('a network built from stacks reports each stack (C+D)', () => {
  const v = transformerView({ ...emptyState(), chain: cdChain() }, defaultGrid(), 500);
  assert.equal(v.kind, 'ranges');
  if (v.kind !== 'ranges') return;
  assert.equal(v.source, 'stacks');
  assert.ok(v.ranges.length === 1 && Number.isFinite(v.ranges[0].bMax) && v.ranges[0].bMax > 0);
});

test('fitting the T-model in the browser reproduces the Python fit on the O7 cap-free sweep', () => {
  const t = fitBranchTModel(ex);
  const py = readFixtureJson<{ tmodel: { rms_rel: number } }>('tmodel_short.json').tmodel;
  assert.deepEqual([t.variant, t.unit.n, t.unit.N_p, t.unit.N_c], [ex.variants[0].name, 5, 3, 4]);
  assert.ok(Math.abs(t.rmsRel / py.rms_rel - 1) < 0.02, `rms ${t.rmsRel} vs Python ${py.rms_rel}`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/transformer.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./transformer.ts`.

- [ ] **Step 3: Write `src/present/transformer.ts`**

```ts
import { cx } from '../engine/complex.ts';
import { solveTransformer } from '../engine/transformer.ts';
import { buildBranchTable } from '../chain/blockZ.ts';
import { allBlocks, findBlock } from '../chain/state.ts';
import type { BranchCache, MeasuredBranchBlock } from '../chain/types.ts';
import { fitTModel } from '../fit/tmodel.ts';
import { drive, reports } from '../stress/drive.ts';
import { type FluxRange, branchVoltage, fluxRangeBranch, fluxRangeStacks, solveFPri } from '../stress/flux.ts';
import { type AppState, type TModel, variantChain } from '../app/state.ts';
import { nearF0Index } from './verdict.ts';

export { solveFPri };

export type TransformerView =
  | { kind: 'none' }
  | { kind: 'needs-turns'; branchId: string }
  | { kind: 'needs-tmodel'; branchId: string }
  | { kind: 'ranges'; source: 'stacks' | 'branch'; ranges: FluxRange[]; loopV: ((fPri: number) => number) | null; split: { label: string; watts: number }[] }
  | { kind: 'error'; message: string };

const branchOf = (s: AppState): MeasuredBranchBlock | undefined => allBlocks(s.chain.blocks).find((b): b is MeasuredBranchBlock => b.type === 'measuredBranch');

/** The stored T-model applies: fitted for the chosen cable assumption with the branch's present turns and cores. */
export function tmodelFits(s: AppState, b: MeasuredBranchBlock): boolean {
  const t = s.tmodel;
  const tr = b.transformer;
  return !!t && !!tr && t.variant === s.variants[s.primary].name && t.unit.N_p === tr.nP && t.unit.N_c === tr.nC && Math.abs(t.unit.n - tr.nS / tr.nP) < 1e-9;
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
      return { kind: 'ranges', source: 'stacks', ranges: fluxRangeStacks(chain, ctx, grid[k], watts), loopV: null, split: splitOf(d()) };
    }
    const b = branchOf(s);
    if (!b) return { kind: 'none' };
    if (!b.transformer) return { kind: 'needs-turns', branchId: b.id };
    if (!s.tmodel || !tmodelFits(s, b)) return { kind: 'needs-tmodel', branchId: b.id };
    const t: TModel = s.tmodel;
    const dd = d();
    const v1 = branchVoltage(dd, b.id);
    return {
      kind: 'ranges',
      source: 'branch',
      ranges: [fluxRangeBranch(dd, b.id, t.unit, t.load)],
      loopV: (fp) => solveTransformer([{ ...t.unit, f_pri: fp }], t.load, dd.f, v1).units[0].v_loop_rms,
      split: splitOf(dd),
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
  return { variant: v.name, unit: fit.unit, load: fit.load, rmsRel: fit.rmsRel };
}
```

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The fit test takes about 5 s.

- [ ] **Step 5: Commit**

```bash
git add src/present/transformer.ts src/present/transformer.test.ts
git commit -m "feat(present): transformer flux and loop-voltage ranges, leakage split from a scope reading, in-browser T-model fit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Task routing and "Try a change first"

**Files:**
- Modify: `src/ui/Home.tsx`, `src/ui/App.tsx`, `src/ui/Workbench.tsx`, `src/ui/TargetBox.tsx`, `src/ui/NewSweepGuide.tsx`, `src/present/guide.ts`, `src/present/recs.test.ts` (guide status test lives there)
- Create: `src/ui/TryChangeGuide.tsx`

**Interfaces:**
- Produces:
  - `type Task = 'home' | 'newSweep' | 'tryChange' | 'safePower'`;
  - `tryChangeStatus(picked: boolean, changed: boolean): StepStatus[]`;
  - `TargetBox` gains a `ghostLabel: string` prop;
  - `Workbench` gains `task: Exclude<Task, 'home'>` and `onTask: (t: Task) => void`;
  - `NewSweepGuide` gains `onSafePower: () => void`.

- [ ] **Step 1: Write the failing test** (append to `src/present/recs.test.ts`; add `tryChangeStatus` to its `./guide.ts` import)

```ts
test('try-a-change steps: pick, then change; the result opens once something changed', () => {
  assert.deepEqual(tryChangeStatus(false, false), ['current', 'waiting', 'waiting']);
  assert.deepEqual(tryChangeStatus(true, false), ['done', 'current', 'waiting']);
  assert.deepEqual(tryChangeStatus(true, true), ['done', 'done', 'current']);
  assert.deepEqual(tryChangeStatus(false, true), ['done', 'done', 'current']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/recs.test.ts`
Expected: FAIL. The error should be a SyntaxError saying `tryChangeStatus` is not exported.

- [ ] **Step 3: Implement**

Append to `src/present/guide.ts`:

```ts
/** "Try a change first": pick a part, change it; the before/after result opens once something changed (spec §8.2). */
export function tryChangeStatus(picked: boolean, changed: boolean): StepStatus[] {
  if (changed) return ['done', 'done', 'current'];
  return picked ? ['done', 'current', 'waiting'] : ['current', 'waiting', 'waiting'];
}
```

`src/ui/Home.tsx`:
- `export type Task = 'home' | 'newSweep' | 'tryChange' | 'safePower';`
- in `TILES`, set `task: 'tryChange'` on "Try a change first" and `task: 'safePower'` on "Safe at full power?".

`src/ui/App.tsx`:
- `const TASK_TITLE: Record<Task, string> = { home: '', newSweep: 'I measured a new sweep', tryChange: 'Try a change first', safePower: 'Safe at full power?' };`
- render the Workbench as `<Workbench task={task} onTask={setTask} state={state} … />`. TypeScript narrows `task` to exclude `'home'` inside the ternary.

`src/ui/TargetBox.tsx`:
- add `ghostLabel: string` to the props;
- pass `label={ghostLabel}` to the ghost `Marker` (replacing `"with the change"`).

`src/ui/NewSweepGuide.tsx`:
- add `onSafePower: () => void` to `GuideProps` and the destructured props;
- step 5 becomes `step(4, 'Safe at full power?', <button onClick={onSafePower}>Check it at full power</button>)`.

Create `src/ui/TryChangeGuide.tsx`:

```tsx
import type { Dispatch, ReactNode } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { trust, trustText } from '../present/circuit.ts';
import { tryChangeStatus } from '../present/guide.ts';
import type { Level } from '../present/level.ts';

export interface Baseline { chain: Chain; fits: AppState['fits'] }

/** "Try a change first" (spec §8.2): pick a part, change it, see before and after, then keep or undo. */
export function TryChangeGuide({ state, dispatch, level, baseline, onKeep, verdictLine }: { state: AppState; dispatch: Dispatch<Action>; level: Level; baseline: Baseline; onKeep: () => void; verdictLine: string }) {
  const changed = baseline.chain !== state.chain || baseline.fits !== state.fits;
  const status = tryChangeStatus(state.selected !== null, changed);
  const note = trustText(trust(state.chain, state.tagged), level);
  const step = (n: number, title: string, body: ReactNode): ReactNode => (
    <section className={`step ${status[n]}`} key={n}>
      <h4><span className="step-mark">{status[n] === 'done' ? '✓' : n + 1}</span>{title}</h4>
      {status[n] === 'waiting' ? null : body}
    </section>
  );
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(0, 'Pick a part on the drawing', <p>{state.selected ? `Selected: ${findBlock(state.chain, state.selected)?.label ?? state.selected}.` : 'Click a part in the drawing.'}</p>)}
      {step(1, 'Change it', <p>{changed ? 'Changed. The drawing and the result show the new circuit.' : 'Edit it in the panel that opens beside the drawing.'}</p>)}
      {step(2, 'What it does', (
        <>
          <p>{verdictLine}</p>
          {note ? <small>{note}</small> : null}
          {level === 'builder' ? <small>The dashed ring in the target box marks where it was before the change.</small> : null}
          <div className="row">
            <button onClick={onKeep}>Keep this change</button>
            <button onClick={() => dispatch({ type: 'load', state: { ...state, chain: baseline.chain, fits: baseline.fits } })}>Undo</button>
          </div>
        </>
      ))}
    </section>
  );
}
```

`src/ui/Workbench.tsx`:

1. Imports:
   - `import type { Chain } from '../chain/types.ts';` merged into the existing `chain/types.ts` import;
   - `import type { Task } from './Home.tsx';`
   - `import { type Baseline, TryChangeGuide } from './TryChangeGuide.tsx';`
2. `WorkbenchProps` gains `task: Exclude<Task, 'home'>; onTask: (t: Task) => void;`. Add both to the destructured props. (`Chain` is only needed if you type the baseline inline; `Baseline` covers it, so drop the `Chain` import if unused.)
3. After the preview state, add:

```tsx
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  useEffect(() => {
    setBaseline(task === 'tryChange' ? { chain: state.chain, fits: state.fits } : null);
  }, [task]);
  const before = useMemo(
    () => (baseline && (baseline.chain !== state.chain || baseline.fits !== state.fits) ? evaluateVariants({ ...state, chain: baseline.chain, fits: baseline.fits }, grid)[state.primary]?.landing?.z ?? null : null),
    [baseline, state.chain, state.fits, state.primary, grid],
  );
```

4. The `TargetBox` gets `ghost={task === 'tryChange' ? before : ghost} ghostLabel={task === 'tryChange' ? 'before the change' : 'with the change'}`.
5. Replace the single `<NewSweepGuide … />` line with:

```tsx
        {task === 'newSweep' ? <NewSweepGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} verdict={shown.v.state} preview={preview} onPreview={setPreview} onSafePower={() => onTask('safePower')} /> : null}
        {task === 'tryChange' && baseline ? <TryChangeGuide state={state} dispatch={dispatch} level={level} baseline={baseline} onKeep={() => setBaseline({ chain: state.chain, fits: state.fits })} verdictLine={verdictText(shown.v, level, shown.c)} /> : null}
```

- [ ] **Step 4: Verify: suite, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate at `http://localhost:5181` (dev server), read each screenshot:
1. **Home:** "Try a change first" and "Safe at full power?" are enabled.
2. **Builder → Try a change first:**
   - step 1 is current; selecting the series bank ticks it;
   - setting 50 pF parts to 0 ticks step 2; step 3 shows the predicted verdict and the trust note;
   - the target box shows a dashed "before the change" ring at the old point.
3. **Undo (Review Focus 5):** set the wiring inductance to 400 nH (this drops its fitted value), then press Undo. The circuit shows 586.8 nH again, and Engineer's fitted-values table shows the fit is back.
4. **Keep this change:** after an edit, the dashed ring disappears, and the new circuit becomes the baseline.
5. **Step 5 link:** "I measured a new sweep", step 5, "Check it at full power" opens the Safe-at-full-power task.

- [ ] **Step 5: Commit**

```bash
git add src/present/guide.ts src/present/recs.test.ts src/ui/Home.tsx src/ui/App.tsx src/ui/Workbench.tsx src/ui/TargetBox.tsx src/ui/NewSweepGuide.tsx src/ui/TryChangeGuide.tsx
git commit -m "feat(ui): 'Try a change first' with before/after, keep and undo; tasks route to their guides

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Safe at full power?"

**UI wiring:** the numbers come from Tasks 2 and 3 (tested). The gate is the browser check in Step 3.

**Files:**
- Create: `src/ui/SafePowerGuide.tsx`
- Modify: `src/ui/Workbench.tsx`, `src/ui/app.css`

**Interfaces:**
- Consumes: `capStress`, `powerText` (Task 2); `transformerView`, `fitBranchTModel`, `solveFPri` (Task 3); actions `setPower`, `setTModel`, `patchBlock`.

- [ ] **Step 1: Write `src/ui/SafePowerGuide.tsx`**

```tsx
import { type Dispatch, useMemo, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import { capStress, powerText } from '../present/power.ts';
import { fitBranchTModel, solveFPri, transformerView } from '../present/transformer.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

const tone = (pct: number | null): string => (pct === null ? 'unknown' : pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'good');
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function TurnsForm({ onSave }: { onSave: (t: { nP: number; nS: number; nC: number }) => void }) {
  const [t, setT] = useState({ nP: 3, nS: 15, nC: 4 });
  return (
    <>
      <p>Flux needs the transformer's turns and core count.</p>
      <div className="form-row"><label>Primary turns</label><DraftNumberInput min="1" step="1" value={t.nP} onCommit={(n) => setT({ ...t, nP: Math.max(1, Math.round(n)) })} /></div>
      <div className="form-row"><label>Secondary turns</label><DraftNumberInput min="1" step="1" value={t.nS} onCommit={(n) => setT({ ...t, nS: Math.max(1, Math.round(n)) })} /></div>
      <div className="form-row"><label>Cores per stack</label><DraftNumberInput min="1" step="1" value={t.nC} onCommit={(n) => setT({ ...t, nC: Math.max(1, Math.round(n)) })} /></div>
      <button onClick={() => onSave(t)}>Use these turns</button>
    </>
  );
}

/** "Safe at full power?" (spec §8.3): capacitors against their ratings, the safe power, and transformer flux. */
export function SafePowerGuide({ state, dispatch, level, grid, caches }: { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; caches: BranchCache[] }) {
  const [fitting, setFitting] = useState<string | null>(null);
  const [loopMeasured, setLoopMeasured] = useState<number | null>(null);
  const cs = useMemo(() => capStress(state, grid, state.powerW, caches), [state.chain, state.fits, state.variants, state.sweeps, state.powerW, grid]);
  const tv = useMemo(() => transformerView(state, grid, state.powerW, caches), [state.chain, state.fits, state.variants, state.primary, state.sweeps, state.powerW, state.tmodel, grid]);
  const fit = (): void => {
    setFitting('Fitting the transformer model (about 5 s)…');
    setTimeout(() => {
      try {
        dispatch({ type: 'setTModel', tmodel: fitBranchTModel(state) });
        setFitting(null);
      } catch (e) {
        setFitting(`Couldn't fit the transformer model: ${message(e)}`);
      }
    }, 50);
  };
  const solved = tv.kind === 'ranges' && tv.loopV && loopMeasured !== null ? solveFPri(tv.loopV, loopMeasured) : null;
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      <section className="step current">
        <h4><span className="step-mark">1</span>Planned power</h4>
        <div className="form-row"><label>Power into the cage (W)</label><DraftNumberInput min="1" step="10" value={state.powerW} onCommit={(w) => dispatch({ type: 'setPower', watts: w })} /></div>
      </section>
      <section className="step current">
        <h4><span className="step-mark">2</span>Capacitors against their ratings</h4>
        <p className={`verdict-line ${tone(cs.worstPct)}`}>{powerText(cs, level)}</p>
        {level === 'beginner' ? null : (
          <table className="numbers">
            <thead><tr><th>Part</th><th>% of rating</th>{level === 'engineer' ? <><th>V rms</th><th>A rms</th></> : null}</tr></thead>
            <tbody>
              {cs.rows.map((r) => (
                <tr key={`${r.blockId}:${r.pf}`}>
                  <td>{r.label}: {r.count}×{r.pf} pF</td>
                  <td><span className={`stress-bar ${r.flag}`}><i style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} /></span> {r.pct === null ? 'no rating' : `${r.pct.toFixed(0)} % (${r.limit})`}</td>
                  {level === 'engineer' ? <><td>{r.vRms.toFixed(0)}</td><td>{r.iRms.toFixed(2)}</td></> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {level === 'beginner' ? null : (
        <section className="step current">
          <h4><span className="step-mark">3</span>Transformer</h4>
          {tv.kind === 'none' ? <p>No transformer in this circuit.</p> : null}
          {tv.kind === 'error' ? <p className="bad">Can't tell: {tv.message}.</p> : null}
          {tv.kind === 'needs-turns' ? <TurnsForm onSave={(t) => dispatch({ type: 'patchBlock', id: tv.branchId, patch: { transformer: t } })} /> : null}
          {tv.kind === 'needs-tmodel' ? (
            <>
              <p>Flux needs a transformer model fitted to the cap-free sweep for this cable assumption and these turns.</p>
              <button onClick={fit} disabled={fitting !== null && fitting.startsWith('Fitting')}>Fit transformer model (about 5 s)</button>
              {fitting ? <small>{fitting}</small> : null}
            </>
          ) : null}
          {tv.kind === 'ranges' ? (
            <>
              {tv.ranges.map((r) => <p key={r.blockId}>Flux per core: {r.bMin.toFixed(2)}–{r.bMax.toFixed(2)} mT · sense-loop voltage {r.vMin.toFixed(1)}–{r.vMax.toFixed(1)} V rms at {state.powerW} W.</p>)}
              <small>A range, because one-port sweeps can't tell how the leakage splits between the windings (0 to 0.5 of it on the primary).</small>
              {level === 'engineer' ? (
                <>
                  <table className="numbers">
                    <thead><tr><th>Leakage on the primary</th><th>Flux (mT)</th><th>Loop (V rms)</th></tr></thead>
                    <tbody>{tv.ranges[0].points.map((p) => <tr key={p.fPri}><td>{p.fPri.toFixed(1)}</td><td>{p.bPk_mT.toFixed(2)}</td><td>{p.vLoopRms.toFixed(1)}</td></tr>)}</tbody>
                  </table>
                  {tv.loopV ? (
                    <div className="form-row"><label>Measured loop voltage (V rms)</label><DraftNumberInput min="0" step="any" value={loopMeasured ?? 0} onCommit={(v) => setLoopMeasured(v > 0 ? v : null)} /></div>
                  ) : null}
                  {solved ? <small>{'fPri' in solved ? `That reading means ${(solved.fPri * 100).toFixed(0)} % of the leakage sits on the primary.` : solved.error}</small> : null}
                  <p>{tv.source === 'branch'
                    ? `The measured part absorbs ${tv.split[0]?.watts.toFixed(0) ?? '?'} W; the split between transformer, plates and part can't be identified from a one-port sweep.`
                    : `Power: ${tv.split.map((x) => `${x.label} ${x.watts.toFixed(1)} W`).join(' · ')}`}</p>
                </>
              ) : null}
            </>
          ) : null}
        </section>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire it into `src/ui/Workbench.tsx`, append CSS**

- Add `import { SafePowerGuide } from './SafePowerGuide.tsx';`.
- Under the two guide lines in the side column, add:

```tsx
        {task === 'safePower' ? <SafePowerGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} /> : null}
```

Append to `src/ui/app.css`:

```css
.stress-bar { display: inline-block; width: 70px; height: 7px; margin-right: 6px; border-radius: 3px; background: rgba(127,127,120,.25); vertical-align: middle; overflow: hidden; }
.stress-bar i { display: block; height: 100%; background: #34c759; }
.stress-bar.amber i { background: #ff9f0a; }
.stress-bar.red i { background: #ff3b30; }
.stress-bar.unknown i { background: transparent; }
```

- [ ] **Step 3: Verify: suite, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate (read each screenshot):
1. **Beginner:** "At 500 W the 100 pF part in the Shunt bank would carry 112 % of its rated current. The capacitors are safe up to about 400 W." in red. No table, no transformer step.
2. **Builder:**
   - a table of 5 parts with bars (the shunt 100 pF bar red);
   - Transformer: "Flux per core: 0.47–6.31 mT · sense-loop voltage 4.5–60.0 V rms at 500 W."
3. **Power 300:** set it to 300. The line turns amber, reading "…within their ratings…" at Beginner or "…86 % of its rated current…" at Builder. The flux range shrinks.
4. **Power 0 (Review Focus 1):** setting 0 leaves 300 in place.
5. **Engineer:**
   - the leakage table with 6 rows;
   - a measured loop voltage of 20 V shows the "% of the leakage sits on the primary" line, and 100000 shows the model-structure message (Review Focus 4);
   - the branch power sentence.
6. **Refit the transformer model:** switching the cable assumption to 1.2825 m shows "Fit transformer model". Pressing it shows the fitting message, then ranges after about 5 s. Switch back to 1.245 m: it asks again, since the stored model now belongs to 1.2825 m. That's correct; refit or leave it.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SafePowerGuide.tsx src/ui/Workbench.tsx src/ui/app.css
git commit -m "feat(ui): 'Safe at full power?' — capacitor bars, safe power, transformer flux and loop voltage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Acceptance walkthrough

**Not a code task;** the gate is the walkthrough.

- [ ] **Step 1: Built-site check**

Run `npm run build`, then `npx vite preview --port 5182 --strictPort` (background). Open both new tasks at all three levels.
Expected:
- no console errors;
- no "AIT", "variant" or "landing" in the page text (check with `document.body.innerText`).
- Stop the preview server afterwards.

- [ ] **Step 2: README**

In the README's first paragraph, after the sentence about "I measured a new sweep", add: `"Try a change first" previews a change before you build it; "Safe at full power?" checks each capacitor against its rating and the transformer's flux at your planned power.`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: mention the two new tasks in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

# RF Network Modeller Plan 3A: Task-Led Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plan 2a screen with the task-led interface of Phase A. It has:
- a home screen;
- three levels;
- three connected circuit drawings;
- a workbench with a level-appropriate result view;
- the "I measured a new sweep" guide;
- the Parts on hand and Sweeps sheets;
- autosave and project files.

**Architecture:**
- **Pure logic** lives in new `src/present/*` and `src/project/file.ts` modules, built test-first on top of the unchanged engine and the 2a `src/app` logic.
- **React components** in `src/ui/*` only call those modules.
- **Order:** the pure modules land first (Tasks 1–8), then the interface (Tasks 9–13), then a real-data acceptance walkthrough (Task 14).

**Tech Stack:**
- TypeScript 5.9.3 run directly by Node (`--experimental-strip-types`), so: `.ts` import extensions, `import type`, no enums or parameter properties;
- React 19.2.6 and Vite 8.0.13;
- `node:test` with `node:assert/strict`;
- SVG for the drawings, the existing canvas `PlotPane` for the Engineer plots, and IndexedDB for autosave.

**Spec:** `docs/superpowers/specs/2026-10-15-rf-network-modeller-ux-design.md` (read it; §-references below point there). The engine spec `docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md` §4–§10 still governs behaviour.

## Global Constraints

- **Repo:** `~/code/put_github_repos_here/rf-network-modeller`, branch `feat/plan3a-task-ui`. Never push from a task; the finishing step merges and pushes.
- **Commands:** `npm test` runs every test; `npm run typecheck` is `tsc --noEmit`; `npm run build` is the typecheck plus `vite build`.
- **Module rules:** imports use explicit `.ts`/`.tsx` extensions; type-only imports use `import type`; no `enum`, `namespace` or constructor parameter properties.
- **Never** `arr.map(gammaFromZ)` or `arr.map(zFromGamma)`: the index becomes z0. Always `arr.map((g) => zFromGamma(g))`.
- **Unknown never renders as healthy** (spec §12). Missing data is grey "Can't tell yet," never green or a number.
- **`src/ui/nanovna.css` is a verbatim copy; never edit it.** Add styles to `src/ui/app.css`.
- **No new dependencies.**
- **No superfluous code:** build only what this plan's tasks name; delete what a task makes dead.
- **Every commit message** ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Plain wording:** user-facing text uses the spec §11 words (e.g. "what the tuner can match", "cable assumption"). Never "AIT window", "variant" or "landing" on screen.

## Review Focus

1. **A saved project that no longer validates on reopen** (an older or corrupt IndexedDB record). The app should open the O7 example with a notice, never a blank screen. Task 8 tests that `fromProjectJson` rejects a record missing `structure`; Task 9's browser gate checks the fallback.
2. **A sweep with no points near 13.56 MHz** (e.g. a 1–10 MHz zoom). It should read "Can't tell yet," with agreement unknown and no crash. Tasks 3 and 4 add synthetic-sweep tests.
3. **Removing the active sweep.** The result view should fall back to "predicted" and the measured verdict should disappear. Task 1 adds a test that `activeIsMeasured` is false after `removeSweep`.
4. **Recommending with no stock at all.** It should report "none of your stock combinations…" with no closest list and no crash. Task 5 adds an empty-output test.
5. **An |S11| trace with no finite values** (an open circuit). The axis should fall back to −5…0 dB. Task 12 adds a `dbRange` all-NaN test.

---

### Task 1: Circuit identity, trust, and the state changes

**Files:**
- Create: `src/present/circuit.ts`
- Test: `src/present/circuit.test.ts`
- Modify: `src/app/state.ts` (types, `emptyState`, reducer; move `snapshotState` out)
- Modify: `src/app/example.ts` (tags get `structure`; fits get the new fields)
- Modify: `src/app/state.test.ts` (the `base.fits` literal gains the new fields; new reducer tests)

**Interfaces:**
- Produces, all in `src/present/circuit.ts`:
  - `snapshotState(chain: Chain): StateOverrides`, moved here and re-exported from `state.ts` so old imports still work;
  - `structureKey(chain: Chain): string`;
  - `knownState(chain: Chain, state: StateOverrides): StateOverrides`;
  - `sameState(chain: Chain, a: StateOverrides, b: StateOverrides): boolean`;
  - `type Trust = 'measured' | 'within' | 'beyond'`;
  - `interface TagLike { sweepId: string; state: StateOverrides; include: boolean; structure: string }`;
  - `trust(chain: Chain, tagged: readonly TagLike[]): Trust`;
  - `activeIsMeasured(chain: Chain, tagged: readonly TagLike[], activeSweep: string | null): boolean`;
  - `trustText(t: Trust, level: Level): string | null`.
- Produces, in `src/app/state.ts`:
  - `FitValues` gains `converged: boolean | null`, `rms: number | null`, `illDetermined: [string, string][]`;
  - `TagRef` gains `structure: string`;
  - `AppState` gains `powerW: number` (default 500);
  - new actions `{ type: 'retagSweep'; sweepId: string }`, `{ type: 'setFits'; fits: Record<string, FitValues> }`, `{ type: 'setCircuitState'; state: StateOverrides }`.
- `Level` comes from Task 2. This task uses `import type { Level } from './level.ts'`. Because type-only imports are erased, Node runs it before Task 2 exists. `npm run typecheck` will fail until Task 2 creates `level.ts`, so this task's verification runs only `npm test`.
- **Ruling carried from the spec:** the reducer's `view` field and `setView` action stay until Task 9, which deletes `CircuitStrip.tsx`, their only user.

- [ ] **Step 1: Write the failing test** `src/present/circuit.test.ts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { O7_FILES, o7Chain, o7State } from '../chain/presets.ts';
import { applyState, updateBlock } from '../chain/state.ts';
import { insertAfter, newBlock } from '../app/chainEdit.ts';
import { type AppState, emptyState, reducer } from '../app/state.ts';
import { loadFixtureSweep } from '../testutil.ts';
import { activeIsMeasured, sameState, snapshotState, structureKey, trust, trustText } from './circuit.ts';

const chain = o7Chain('capfree');
const key = structureKey(chain);
const tag = (series: number[], shunt: number[], loop: boolean, id: string) => ({
  sweepId: id, state: o7State(counts(series[0], series[1], series[2]), counts(shunt[0], shunt[1], shunt[2]), loop), include: true, structure: key,
});
// The five tagged O7 builds of 2026-10-13 (spec §7.1 example): 130/230, 100/200, 80/200, 80/200 + loop, 80/180 + loop.
const tags = [tag([1, 0, 1], [2, 0, 1], false, 'a'), tag([1, 0, 0], [2, 0, 0], false, 'b'), tag([0, 1, 1], [2, 0, 0], false, 'c'), tag([0, 1, 1], [2, 0, 0], true, 'd'), tag([0, 1, 1], [1, 1, 1], true, 'e')];

test('structureKey ignores bank parts, the loop flag, labels and recommender settings', () => {
  let c = applyState(chain, o7State(counts(2, 0, 0), counts(0, 0, 1), false));
  c = updateBlock(c, 'ser', { label: 'renamed', slots: 7, searchable: false });
  assert.equal(structureKey(c), key);
});

test('structureKey changes when a value is retyped, a part is added, or a param is freed only in badge', () => {
  const ls = updateBlock(chain, 'Ls', { L: { value: 410e-9, badge: 'typed', free: true, lo: 150e-9, hi: 700e-9 } });
  assert.notEqual(structureKey(ls), key);
  assert.notEqual(structureKey(insertAfter(chain, 'Ls', newBlock(chain, 'inductor'))), key);
  const badgeOnly = updateBlock(chain, 'Ls', { L: { value: 300e-9, badge: 'fit', free: false, lo: 0, hi: 1 } });
  assert.equal(structureKey(badgeOnly), key, 'badge, free and bounds do not change the circuit');
});

test('sameState normalises the o7State and snapshotState shapes', () => {
  const s = o7State(counts(0, 1, 1), counts(1, 1, 1), true);
  assert.ok(sameState(chain, s, snapshotState(applyState(chain, s))));
  assert.ok(!sameState(chain, s, o7State(counts(0, 1, 1), counts(1, 1, 1), false)));
});

test('trust: measured, within, beyond (spec §7.3)', () => {
  assert.equal(trust(chain, tags), 'measured', 'the preset is the 80/180 + loop build');
  assert.equal(trust(updateBlock(chain, 'ser', { counts: counts(1, 0, 0) }), tags), 'within', '100 pF lies inside 80–130 pF');
  assert.equal(trust(updateBlock(chain, 'ser', { counts: counts(2, 0, 0) }), tags), 'beyond', '200 pF is above every series build');
  assert.equal(trust(updateBlock(chain, 'sh', { counts: counts(1, 0, 1) }), tags), 'beyond', '130 pF is below every shunt build');
  const ls = updateBlock(chain, 'Ls', { L: { value: 410e-9, badge: 'typed', free: true, lo: 150e-9, hi: 700e-9 } });
  assert.equal(trust(ls, tags), 'beyond', 'a retyped value is a different circuit');
  assert.equal(trust(chain, []), 'beyond', 'no sweeps: everything is a prediction');
  assert.equal(trust(chain, tags.filter((t) => !t.state.branch.loop)), 'beyond', 'loop on was never measured in these tags');
  assert.equal(trust(chain, tags.map((t) => ({ ...t, include: false }))), 'beyond', 'excluded sweeps do not count');
});

test('activeIsMeasured needs the active sweep itself to match, and is false once it is removed', () => {
  assert.ok(activeIsMeasured(chain, tags, 'e'));
  assert.ok(!activeIsMeasured(chain, tags, 'a'));
  assert.ok(!activeIsMeasured(chain, tags, null));
  const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const s: AppState = { ...emptyState(), chain, sweeps: { capfree, e: { ...capfree, id: 'e' } }, tagged: [{ ...tags[4], label: 'e' }], activeSweep: 'e' };
  const after = reducer(s, { type: 'removeSweep', sweepId: 'e' });
  assert.ok(!activeIsMeasured(after.chain, after.tagged, after.activeSweep));
});

test('trustText says nothing for measured and words the rest by level', () => {
  assert.equal(trustText('measured', 'builder'), null);
  assert.equal(trustText('within', 'beginner'), '(prediction: not measured yet)');
  assert.equal(trustText('beyond', 'engineer'), "Beyond anything you've measured: the model is extrapolating");
  assert.equal(trustText('within', 'builder'), "Within what you've measured");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/circuit.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./circuit.ts`.

- [ ] **Step 3: Write `src/present/circuit.ts`**

```ts
import { type Counts, countsPf } from '../blocks/ht50.ts';
import { type StateOverrides, allBlocks, applyState, findBlock } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';
import type { Level } from './level.ts';

/** Fields a sweep's circuit state sets: bank parts and the sense-loop flag (spec §7.3). */
const STATE_FIELDS: Partial<Record<Block['type'], readonly string[]>> = { capBank: ['counts', 'nSeries', 'customPf'], measuredBranch: ['loop'] };
/** Fields that do not change the circuit: names and recommender settings. */
const NON_CIRCUIT: readonly string[] = ['label', 'slots', 'searchable'];

const isParam = (o: Record<string, unknown>): boolean => 'value' in o && 'badge' in o && 'free' in o;

/** Key-sorted plain value; a Param reduces to its value, since badge, free and bounds do not change the circuit. */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (isParam(o)) return o.value;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canon(o[k])]));
  }
  return v;
}

/** The circuit state a new sweep is tagged with: every bank's parts and every measured branch's loop flag. */
export function snapshotState(chain: Chain): StateOverrides {
  const out: StateOverrides = {};
  for (const b of allBlocks(chain.blocks)) {
    if (b.type === 'capBank') out[b.id] = { counts: { ...b.counts }, nSeries: b.nSeries, customPf: b.customPf };
    if (b.type === 'measuredBranch') out[b.id] = { loop: b.loop };
  }
  return out;
}

function strip(b: Block): Record<string, unknown> {
  const drop = new Set([...NON_CIRCUIT, ...(STATE_FIELDS[b.type] ?? [])]);
  const o: Record<string, unknown> = Object.fromEntries(Object.entries(b).filter(([k]) => !drop.has(k)));
  if (b.type === 'shunt') o.chain = b.chain.map(strip);
  if (b.type === 'parallel') o.chains = b.chains.map((c) => c.map(strip));
  return o;
}

/** The circuit without its sweep-state fields: equal keys mean the same parts with the same values (spec §7.3). */
export const structureKey = (chain: Chain): string => JSON.stringify(canon(chain.blocks.map(strip)));

/** Overrides for blocks that still exist; a tag can outlive a removed block. */
export const knownState = (chain: Chain, state: StateOverrides): StateOverrides =>
  Object.fromEntries(Object.entries(state).filter(([id]) => findBlock(chain, id) !== undefined));

const stateText = (chain: Chain, s: StateOverrides): string => JSON.stringify(canon(snapshotState(applyState(chain, knownState(chain, s)))));

/** Two tags describe the same build. Compared after applying them, so o7State and snapshotState shapes agree. */
export const sameState = (chain: Chain, a: StateOverrides, b: StateOverrides): boolean => stateText(chain, a) === stateText(chain, b);

export type Trust = 'measured' | 'within' | 'beyond';
export interface TagLike { sweepId: string; state: StateOverrides; include: boolean; structure: string }

const bankPf = (e: Record<string, unknown> | undefined): number =>
  e ? (countsPf(e.counts as Counts) + (e.customPf as number)) / (e.nSeries as number) : Number.NaN;

/** How the current circuit relates to the included sweeps; beyond is checked first (spec §7.3). */
export function trust(chain: Chain, tagged: readonly TagLike[]): Trust {
  const key = structureKey(chain);
  const same = tagged.filter((t) => t.include && t.structure === key);
  if (!same.length) return 'beyond';
  const cur = snapshotState(chain);
  const states = same.map((t) => snapshotState(applyState(chain, knownState(chain, t.state))));
  for (const [id, v] of Object.entries(cur)) {
    if ('counts' in v) {
      const pf = states.map((st) => bankPf(st[id]));
      const x = bankPf(v);
      if (x < Math.min(...pf) || x > Math.max(...pf)) return 'beyond';
    } else if (!states.some((st) => st[id]?.loop === v.loop)) {
      return 'beyond';
    }
  }
  return same.some((t) => sameState(chain, t.state, cur)) ? 'measured' : 'within';
}

/** The circuit is the one the active sweep was taken on, so the measured verdict applies (spec §7.4). */
export function activeIsMeasured(chain: Chain, tagged: readonly TagLike[], activeSweep: string | null): boolean {
  const t = tagged.find((x) => x.sweepId === activeSweep);
  return t !== undefined && t.structure === structureKey(chain) && sameState(chain, t.state, snapshotState(chain));
}

/** Trust wording by level; nothing to say when the circuit was measured (spec §7.3). */
export function trustText(t: Trust, level: Level): string | null {
  if (t === 'measured') return null;
  if (level === 'beginner') return '(prediction: not measured yet)';
  return t === 'within' ? "Within what you've measured" : "Beyond anything you've measured: the model is extrapolating";
}
```

- [ ] **Step 4: Change `src/app/state.ts`**

1. Replace the local `snapshotState` function with an import and re-export. Add the import:

```ts
import { knownState, snapshotState, structureKey } from '../present/circuit.ts';
```

and, after the imports:

```ts
export { snapshotState };
```

2. Extend the types:

```ts
/** One variant's fitted parameter values (fit variables in FIT_UNIT / unitOf units, as fromFitVars expects). */
export interface FitValues {
  refs: ParamRef[];
  x: number[];
  source: string;
  /** null for fits imported from the Python, which carry no flag. */
  converged: boolean | null;
  rms: number | null;
  illDetermined: [string, string][];
}

/** A loaded caps-in sweep, the circuit state it was taken in, the circuit's structure then, and whether fits use it. */
export interface TagRef {
  sweepId: string;
  label: string;
  state: StateOverrides;
  include: boolean;
  structure: string;
}
```

3. Add `powerW: number;` to `AppState` after `window`, and `powerW: 500,` to `emptyState()` after `window: AIT_WINDOW,`.

4. Add these to the `Action` union:

```ts
  | { type: 'retagSweep'; sweepId: string }
  | { type: 'setFits'; fits: Record<string, FitValues> }
  | { type: 'setCircuitState'; state: StateOverrides }
```

5. In the reducer:
   - change `addSweep`'s tag to `{ sweepId: a.sweep.id, label: a.label, state: snapshotState(s.chain), include: true, structure: structureKey(s.chain) }`;
   - change `applySweepState` to use `knownState(s.chain, tag.state)` instead of its inline filter;
   - add the new cases:

```ts
    case 'retagSweep':
      return { ...s, tagged: s.tagged.map((t) => (t.sweepId === a.sweepId ? { ...t, state: snapshotState(s.chain), structure: structureKey(s.chain) } : t)) };
    case 'setFits':
      return { ...s, fits: a.fits };
    case 'setCircuitState':
      return { ...s, chain: applyState(s.chain, knownState(s.chain, a.state)) };
```

Leave `view`, `setView` and every other case as they are.

- [ ] **Step 5: Change `src/app/example.ts`**

Add the import `import { structureKey } from '../present/circuit.ts';`. In `exampleState`:
- build the chain once as `const chain = { ...o7Chain('capfree'), name: m.name };` and use it for `chain:`;
- fits become `{ refs: [...O7_REFS, O7_LOOP_REF], x: [...f.x, f.q], source: f.source, converged: null, rms: null, illDetermined: [] }`;
- tags become `{ sweepId: s.id, label: s.label, state: o7State(c3(s.series), c3(s.shunt), s.loop), include: true, structure: structureKey(chain) }`;
- add `powerW: 500,` after `window: AIT_WINDOW,`.

- [ ] **Step 6: Add reducer tests to `src/app/state.test.ts`, and update the `base.fits` literal**

In `base.fits`, add `converged: null, rms: null, illDetermined: []` to both entries. Then append:

```ts
test('addSweep tags the sweep with the circuit structure; retagSweep re-tags it with the current circuit', () => {
  const sweep: Sweep = { id: 'n', name: 'n.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  let s = reducer(base, { type: 'addSweep', sweep, label: 'n' });
  assert.equal(s.tagged.at(-1)?.structure, structureKey(base.chain));
  s = reducer(s, { type: 'setCircuitState', state: { ser: { counts: counts(2, 0, 0) } } });
  s = reducer(s, { type: 'retagSweep', sweepId: 'n' });
  assert.deepEqual((s.tagged.at(-1)?.state.ser as { counts: unknown }).counts, counts(2, 0, 0));
});

test('setCircuitState applies bank picks and skips blocks that are gone; setFits replaces the fits', () => {
  const s = reducer(base, { type: 'setCircuitState', state: { ser: { counts: counts(1, 0, 0), nSeries: 1 }, gone: { loop: true } } });
  const ser = findBlock(s.chain, 'ser');
  assert.ok(ser?.type === 'capBank' && ser.counts[100] === 1);
  assert.deepEqual(reducer(base, { type: 'setFits', fits: {} }).fits, {});
});

test('emptyState plans for 500 W', () => {
  assert.equal(emptyState().powerW, 500);
});
```

Add `structureKey` to the imports from `'../present/circuit.ts'`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, every test (187 before this plan, plus the new ones). `npm run typecheck` is not run yet: it fails until Task 2 creates `level.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/present/circuit.ts src/present/circuit.test.ts src/app/state.ts src/app/state.test.ts src/app/example.ts
git commit -m "feat(present): circuit identity, trust, and tag structure; refit and re-tag actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Levels, plain words, and plain preset labels

**Files:**
- Create: `src/present/level.ts`, `src/present/words.ts`
- Test: `src/present/level.test.ts`
- Modify: `src/chain/presets.ts` (O7 and C+D inductor labels and the O7 measured-branch label)

**Interfaces:**
- Produces, in `level.ts`:
  - `type Level = 'beginner' | 'builder' | 'engineer'`;
  - `type DrawingKind = 'flow' | 'hardware' | 'schematic'`;
  - `type ResultKind = 'verdict' | 'target' | 'plots'`;
  - `type FieldSet = 'stock' | 'physical' | 'all'`;
  - `type SheetKind = 'parts' | 'sweeps'`;
  - `interface LevelProfile { label: string; drawing: DrawingKind; result: ResultKind; showOhms: boolean; nameAssumptions: boolean; fields: FieldSet; sheets: readonly SheetKind[] }`;
  - `LEVELS: readonly Level[]`;
  - `PROFILES: Readonly<Record<Level, LevelProfile>>`;
  - `parseLevel(v: string | null): Level`;
  - `DRAWING_LABEL: Readonly<Record<DrawingKind, string>>`;
  - `RESULT_LABEL: Readonly<Record<ResultKind, string>>`.
- Produces, in `words.ts`: `WORDS` and `ACRONYMS`.

- [ ] **Step 1: Write the failing test** `src/present/level.test.ts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { findBlock } from '../chain/state.ts';
import { LEVELS, PROFILES, parseLevel } from './level.ts';
import { WORDS } from './words.ts';

test('each level sets the drawing, the result view and the field set (spec §5)', () => {
  assert.deepEqual(LEVELS, ['beginner', 'builder', 'engineer']);
  assert.deepEqual([PROFILES.beginner.drawing, PROFILES.builder.drawing, PROFILES.engineer.drawing], ['flow', 'hardware', 'schematic']);
  assert.deepEqual([PROFILES.beginner.result, PROFILES.builder.result, PROFILES.engineer.result], ['verdict', 'target', 'plots']);
  assert.deepEqual([PROFILES.beginner.fields, PROFILES.builder.fields, PROFILES.engineer.fields], ['stock', 'physical', 'all']);
  assert.equal(PROFILES.beginner.showOhms, false);
  assert.ok(PROFILES.engineer.nameAssumptions && !PROFILES.builder.nameAssumptions);
  assert.deepEqual(PROFILES.beginner.sheets, ['parts']);
  assert.deepEqual(PROFILES.builder.sheets, ['parts', 'sweeps']);
});

test('a missing or unknown stored level falls back to Builder', () => {
  assert.equal(parseLevel(null), 'builder');
  assert.equal(parseLevel('wizard'), 'builder');
  assert.equal(parseLevel('engineer'), 'engineer');
});

test('screen words carry none of the internal jargon (spec §11)', () => {
  for (const w of Object.values(WORDS)) assert.doesNotMatch(w, /AIT|variant|landing/i);
});

test('preset parts carry plain names', () => {
  const o7 = o7Chain('capfree');
  assert.equal(findBlock(o7, 'Ls')?.label, 'Wiring inductance');
  assert.equal(findBlock(o7, 'Lb')?.label, 'Loop inductance');
  assert.equal(findBlock(o7, 'branch')?.label, 'Transformer pair + plates');
  assert.equal(findBlock(cdChain(), 'Ls')?.label, 'Wiring inductance');
  assert.equal(findBlock(cdChain(), 'Lb')?.label, 'Loop inductance');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/level.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./level.ts`.

- [ ] **Step 3: Write `src/present/level.ts` and `src/present/words.ts`**

```ts
// src/present/level.ts
export type Level = 'beginner' | 'builder' | 'engineer';
export type DrawingKind = 'flow' | 'hardware' | 'schematic';
export type ResultKind = 'verdict' | 'target' | 'plots';
export type FieldSet = 'stock' | 'physical' | 'all';
export type SheetKind = 'parts' | 'sweeps';

/** What one level shows (spec §5). */
export interface LevelProfile {
  label: string;
  drawing: DrawingKind;
  result: ResultKind;
  showOhms: boolean;
  nameAssumptions: boolean;
  fields: FieldSet;
  sheets: readonly SheetKind[];
}

export const LEVELS: readonly Level[] = ['beginner', 'builder', 'engineer'];

export const PROFILES: Readonly<Record<Level, LevelProfile>> = {
  beginner: { label: 'Beginner', drawing: 'flow', result: 'verdict', showOhms: false, nameAssumptions: false, fields: 'stock', sheets: ['parts'] },
  builder: { label: 'Builder', drawing: 'hardware', result: 'target', showOhms: true, nameAssumptions: false, fields: 'physical', sheets: ['parts', 'sweeps'] },
  engineer: { label: 'Engineer', drawing: 'schematic', result: 'plots', showOhms: true, nameAssumptions: true, fields: 'all', sheets: ['parts', 'sweeps'] },
};

export const DRAWING_LABEL: Readonly<Record<DrawingKind, string>> = { flow: 'Power flow', hardware: 'Hardware', schematic: 'Schematic' };
export const RESULT_LABEL: Readonly<Record<ResultKind, string>> = { verdict: 'Verdict', target: 'Target box', plots: 'Plots' };

/** A stored level, or Builder when it is missing or unrecognised (spec §5). */
export const parseLevel = (v: string | null): Level => (v === 'beginner' || v === 'builder' || v === 'engineer' ? v : 'builder');
```

```ts
// src/present/words.ts
/** Plain names for internal terms; every view takes its wording from here (spec §11). */
export const WORDS = {
  window: 'what the tuner can match',
  landing: 'where the tuner lands',
  atTuner: 'at the tuner',
  assumption: 'cable assumption',
  measuredPart: 'measured part',
  room: 'room to drift',
} as const;

/** Tooltips for the acronyms that stay on screen. */
export const ACRONYMS: Readonly<Record<string, string>> = {
  VNA: 'Vector network analyzer: the instrument that measures the sweep',
  HT50: 'The high-voltage doorknob capacitors the banks are built from',
  S11: 'Reflection coefficient: how much power bounces back',
  VSWR: 'Voltage standing-wave ratio: 1 is a perfect match',
};
```

- [ ] **Step 4: Rename the preset labels in `src/chain/presets.ts`**

- In `o7Chain`, set `label: 'Wiring inductance'` (block `Ls`), `label: 'Loop inductance'` (block `Lb`) and `label: 'Transformer pair + plates'` (block `branch`).
- In `cdChain`, set `label: 'Wiring inductance'` (`Ls`) and `label: 'Loop inductance'` (`Lb`).

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The typecheck is now clean, because `level.ts` exists.

- [ ] **Step 6: Commit**

```bash
git add src/present/level.ts src/present/words.ts src/present/level.test.ts src/chain/presets.ts
git commit -m "feat(present): level profiles, plain words, plain preset part names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tuner verdict

**Files:**
- Create: `src/present/verdict.ts`
- Test: `src/present/verdict.test.ts`
- Modify: `src/app/evaluate.ts` (`measuredLanding` and `evaluateVariants` share `nearF0Index` / `landingNearF0`)

**Interfaces:**
- Consumes:
  - `landing`, `F0`, `ROOM_SEG`, `type Landing` from `src/recommend/landing.ts`;
  - `ROOM_CAP` from `src/recommend/rank.ts`;
  - `Level` (Task 2).
- Produces:
  - `LITTLE_ROOM = 1`;
  - `type VerdictState = 'unknown' | 'outside' | 'little' | 'some' | 'plenty'`;
  - `type OffSide = 'rLow' | 'rHigh' | 'xLow' | 'xHigh'`;
  - `interface Verdict { state: VerdictState; z: Complex | null; roomUp: number | null; off: OffSide[] }`;
  - `UNKNOWN: Verdict`;
  - `nearF0Index(f: number[]): number | null`;
  - `landingNearF0(f: number[], z: Complex[], w: Window): Landing | null`;
  - `windowDistance(z: Complex, w: Window): number`;
  - `verdictOf(l: Landing | null, w: Window): Verdict`;
  - `interface Combined { state: VerdictState; agree: number; total: number }`;
  - `combine(states: readonly VerdictState[]): Combined`;
  - `representative(vs: readonly Verdict[], primary: number, state: VerdictState): Verdict`;
  - `verdictText(v: Verdict, level: Level, c?: Combined): string`;
  - `type Tone = 'good' | 'warn' | 'bad' | 'unknown'`;
  - `toneOf(s: VerdictState): Tone`.

- [ ] **Step 1: Write the failing test** `src/present/verdict.test.ts`

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { zFromGamma } from '../io/sweep.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { ROOT } from '../testutil.ts';
import { combine, landingNearF0, nearF0Index, verdictOf, verdictText, windowDistance } from './verdict.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const measured = (id: string) => {
  const sw = ex.sweeps[id];
  return verdictOf(landingNearF0(sw.f, sw.gamma.map((g) => zFromGamma(g)), ex.window), ex.window);
};

test('O7 model: two cable assumptions give some room, the third is outside, so the majority says some room (spec §7.1)', () => {
  const vs = evaluateVariants(ex, evalGrid(ex.chain, ex.sweeps)).map((r) => verdictOf(r.landing, ex.window));
  assert.deepEqual(vs.map((v) => v.state), ['some', 'some', 'outside']);
  assert.deepEqual(combine(vs.map((v) => v.state)), { state: 'some', agree: 2, total: 3 });
});

test('O7 measured: 80/180 + loop has little room (0.82 % up); 80/200 is outside with reactance too low', () => {
  const v = measured('o7-80-180-loop');
  assert.equal(v.state, 'little');
  assert.ok(v.roomUp !== null && Math.abs(v.roomUp - 0.82) < 0.01);
  assert.deepEqual(measured('o7-80-200').off, ['xLow']);
  assert.deepEqual(measured('o7-130-230').off, ['rHigh', 'xHigh']);
});

test('a sweep with no point near 13.56 MHz gives no landing, so the verdict is unknown (review focus 2)', () => {
  const f = Array.from({ length: 50 }, (_, i) => 1e6 + i * 0.2e6);
  assert.equal(nearF0Index(f), null);
  assert.equal(landingNearF0(f, f.map(() => cx(10, 20)), AIT_WINDOW), null);
  assert.equal(verdictOf(null, AIT_WINDOW).state, 'unknown');
  assert.equal(nearF0Index([]), null);
});

test('room thresholds: below 1 % is little, below 2.5 % some, otherwise plenty', () => {
  const l = (roomUp: number) => ({ z: cx(10, 20), f: 13.56e6, inWindow: true, roomUp, roomDown: 1 });
  assert.deepEqual([0.99, 1, 2.49, 2.5].map((r) => verdictOf(l(r), AIT_WINDOW).state), ['little', 'some', 'some', 'plenty']);
});

test('combine: the majority wins; with no majority the worst state wins, and unknown is worst', () => {
  assert.equal(combine(['plenty', 'plenty', 'outside']).state, 'plenty');
  assert.equal(combine(['plenty', 'some', 'outside']).state, 'outside');
  assert.equal(combine(['plenty', 'some', 'unknown']).state, 'unknown');
  assert.deepEqual(combine([]), { state: 'unknown', agree: 0, total: 0 });
});

test('windowDistance is the distance in ohms to the window rectangle', () => {
  assert.equal(windowDistance(cx(10, 20), AIT_WINDOW), 0);
  assert.equal(windowDistance(cx(2, 30), AIT_WINDOW), 3);
  assert.equal(windowDistance(cx(0, 0), AIT_WINDOW), Math.hypot(5, 6));
  assert.equal(windowDistance(cx(Number.POSITIVE_INFINITY, 0), AIT_WINDOW), Number.POSITIVE_INFINITY);
});

test('verdict wording by level; Beginner shows no ohms; Builder notes when the assumptions disagree', () => {
  const out = verdictOf({ z: cx(5.03, 4.3), f: 13.56e6, inWindow: false, roomUp: -99, roomDown: -99 }, AIT_WINDOW);
  assert.equal(verdictText(out, 'beginner'), "The tuner can't match this (reactance too low)");
  const little = verdictOf({ z: cx(7.8, 27.9), f: 13.56e6, inWindow: true, roomUp: 0.82, roomDown: 1.04 }, AIT_WINDOW);
  assert.equal(verdictText(little, 'beginner'), 'Matches, but with little room: warming up may push it out');
  assert.equal(verdictText(little, 'builder', { state: 'little', agree: 2, total: 3 }), 'The tuner can match it, with little room (room to drift up 0.8 %) (depends on the cable assumption)');
  assert.equal(verdictText(verdictOf(null, AIT_WINDOW), 'engineer'), "Can't tell yet");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/verdict.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./verdict.ts`.

- [ ] **Step 3: Write `src/present/verdict.ts`**

```ts
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
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return Number.POSITIVE_INFINITY;
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
  if (!l || Number.isNaN(l.z.re) || Number.isNaN(l.z.im)) return { ...UNKNOWN, z: l?.z ?? null };
  if (!l.inWindow) return { state: 'outside', z: l.z, roomUp: null, off: offSides(l.z, w) };
  const state: VerdictState = l.roomUp < LITTLE_ROOM ? 'little' : l.roomUp < ROOM_CAP ? 'some' : 'plenty';
  return { state, z: l.z, roomUp: l.roomUp, off: [] };
}

export interface Combined { state: VerdictState; agree: number; total: number }

/** Worst first. */
const SEVERITY: readonly VerdictState[] = ['unknown', 'outside', 'little', 'some', 'plenty'];

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
  little: 'Matches, but with little room: warming up may push it out',
  some: 'Matches, with some room',
  plenty: 'Matches, with plenty of room',
};

/** Verdict wording by level (spec §7.1). Beginner never shows ohms; Builder notes when assumptions disagree. */
export function verdictText(v: Verdict, level: Level, c?: Combined): string {
  const depends = level === 'builder' && c && c.agree < c.total ? ' (depends on the cable assumption)' : '';
  if (v.state === 'unknown') return "Can't tell yet";
  if (v.state === 'outside') {
    const sides = v.off.map((s) => SIDE[s]).join(', ');
    return level === 'beginner' ? `The tuner can't match this${sides ? ` (${sides})` : ''}` : `The tuner can't match this${sides ? `: ${sides}` : ''}${depends}`;
  }
  if (level === 'beginner') return BEGINNER[v.state];
  return `The tuner can match it, with ${ROOM[v.state]} (room to drift up ${(v.roomUp ?? 0).toFixed(1)} %)${depends}`;
}

export type Tone = 'good' | 'warn' | 'bad' | 'unknown';
export const toneOf = (s: VerdictState): Tone => (s === 'unknown' ? 'unknown' : s === 'outside' ? 'bad' : s === 'little' ? 'warn' : 'good');
```

- [ ] **Step 4: Make `src/app/evaluate.ts` share the near-13.56 MHz rule**

Replace the body of `measuredLanding` and the landing line in `evaluateVariants`:

```ts
import { landingNearF0, nearF0Index } from '../present/verdict.ts';
// ...inside evaluateVariants, replace the `const l = ...` line with:
      const l = seg.length ? landingNearF0(seg.map((k) => grid[k]), seg.map((k) => z[k]), s.window) : null;
// ...
export function measuredLanding(s: Sweep): MeasuredLanding | null {
  const k = nearF0Index(s.f);
  return k === null ? null : { z: zFromGamma(s.gamma[k]), f: s.f[k] };
}
```

Delete the now-unused imports from `evaluate.ts`: `landing`, and `F0` if `k0` no longer needs it. Keep `nearestIndex` and `F0` for `k0`, and `ROOM_SEG` for `seg`.

- [ ] **Step 5: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The existing `measuredLanding` and `evaluateVariants` tests stay green.

- [ ] **Step 6: Commit**

```bash
git add src/present/verdict.ts src/present/verdict.test.ts src/app/evaluate.ts
git commit -m "feat(present): tuner verdict by room up, majority across cable assumptions, plain wording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Does the model agree?

**Files:**
- Create: `src/present/agreement.ts`
- Test: `src/present/agreement.test.ts`

**Interfaces:**
- Consumes: `evaluateVariants`, `measuredLanding` (`src/app/evaluate.ts`); `knownState` (Task 1); `Level` (Task 2).
- Produces:
  - `AGREE_OHMS = 3`, `ROUGH_OHMS = 12`;
  - `type Grade = 'agrees' | 'rough' | 'off' | 'unknown'`;
  - `interface GradeResult { grade: Grade; dR: number | null; dX: number | null }`;
  - `gradeOf(meas: Complex | null, pred: Complex | null): GradeResult`;
  - `combineGrades(gs: readonly Grade[]): Grade`;
  - `capUnsettled(g: Grade, unsettled: boolean): Grade`;
  - `interface Agreement { perVariant: GradeResult[]; combined: Grade; unsettled: boolean }`;
  - `agreementFor(s: AppState, grid: number[], caches?: BranchCache[]): Agreement | null`;
  - `agreementText(a: Agreement, level: Level, primary: number): string`.

- [ ] **Step 1: Write the failing test** `src/present/agreement.test.ts`

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { ROOT } from '../testutil.ts';
import { agreementFor, agreementText, capUnsettled, combineGrades, gradeOf } from './agreement.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('O7 80/180 + loop: reactance off 9.9 / 11.0 / 16.4 ohm, so rough, rough, off; the majority is rough (spec §7.2)', () => {
  const a = agreementFor(ex, evalGrid(ex.chain, ex.sweeps));
  assert.ok(a);
  assert.deepEqual(a.perVariant.map((g) => g.grade), ['rough', 'rough', 'off']);
  const dx = a.perVariant.map((g) => g.dX ?? Number.NaN);
  [-9.9, -11.0, -16.4].forEach((want, i) => assert.ok(Math.abs(dx[i] - want) < 0.1, `variant ${i}: ${dx[i]}`));
  assert.equal(a.combined, 'rough');
});

test('the model is evaluated in the sweep\'s own state, not the current circuit', () => {
  const grid = evalGrid(ex.chain, ex.sweeps);
  const moved = { ...ex, chain: { ...ex.chain, blocks: ex.chain.blocks.map((b) => (b.id === 'ser' && b.type === 'capBank' ? { ...b, counts: { 100: 2, 50: 0, 30: 0 } } : b)) } };
  assert.deepEqual(agreementFor(moved, grid)?.perVariant.map((g) => g.grade), ['rough', 'rough', 'off']);
});

test('grade bands: 3 ohm agrees, 12 ohm rough, beyond is off; missing data is unknown', () => {
  assert.equal(gradeOf(cx(10, 20), cx(13, 17)).grade, 'agrees');
  assert.equal(gradeOf(cx(10, 20), cx(10, 32)).grade, 'rough');
  assert.equal(gradeOf(cx(10, 20), cx(10, 32.01)).grade, 'off');
  assert.equal(gradeOf(null, cx(1, 1)).grade, 'unknown');
  assert.equal(gradeOf(cx(1, 1), cx(Number.NaN, 1)).grade, 'unknown');
});

test('combineGrades takes the majority, else the worst; an unsettled fit caps agrees at rough', () => {
  assert.equal(combineGrades(['agrees', 'agrees', 'off']), 'agrees');
  assert.equal(combineGrades(['agrees', 'rough', 'off']), 'off');
  assert.equal(combineGrades(['agrees', 'rough', 'unknown']), 'unknown');
  assert.equal(capUnsettled('agrees', true), 'rough');
  assert.equal(capUnsettled('off', true), 'off');
});

test('no active tagged sweep: nothing to compare', () => {
  assert.equal(agreementFor({ ...ex, activeSweep: null }, evalGrid(ex.chain, ex.sweeps)), null);
});

test('agreement wording carries the near-edge warning for rough and the unsettled note', () => {
  const a = { perVariant: [{ grade: 'rough' as const, dR: -0.57, dX: -9.89 }], combined: 'rough' as const, unsettled: true };
  assert.equal(agreementText(a, 'beginner', 0), "The model is close, not exact. The last refit didn't settle.");
  assert.equal(agreementText(a, 'builder', 0),
    "Close enough to rank changes, not exact: resistance −0.6 Ω, reactance −9.9 Ω (model minus sweep). Near the edge of the tuner's range it can be wrong about matching. The last refit didn't settle.");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/agreement.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./agreement.ts`.

- [ ] **Step 3: Write `src/present/agreement.ts`**

```ts
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

export interface Agreement { perVariant: GradeResult[]; combined: Grade; unsettled: boolean }

/** The active sweep against the model in that sweep's own tagged state; null without an active tagged sweep. */
export function agreementFor(s: AppState, grid: number[], caches: BranchCache[] = []): Agreement | null {
  const tag = s.tagged.find((t) => t.sweepId === s.activeSweep);
  const sweep = s.activeSweep ? s.sweeps[s.activeSweep] : undefined;
  if (!tag || !sweep) return null;
  const meas = measuredLanding(sweep)?.z ?? null;
  const results = evaluateVariants({ ...s, chain: applyState(s.chain, knownState(s.chain, tag.state)) }, grid, caches);
  const perVariant = results.map((r) => gradeOf(meas, r.landing?.z ?? null));
  const unsettled = Object.values(s.fits).some((f) => f.converged === false);
  return { perVariant, combined: capUnsettled(combineGrades(perVariant.map((g) => g.grade)), unsettled), unsettled };
}

const ohm = (v: number | null): string => (v === null ? '?' : `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)} Ω`);

/** Agreement wording by level, with the near-edge warning on rough (spec §7.2). */
export function agreementText(a: Agreement, level: Level, primary: number): string {
  const tail = a.unsettled ? " The last refit didn't settle." : '';
  const g = a.perVariant[primary] ?? a.perVariant[0];
  switch (a.combined) {
    case 'agrees':
      return `The model agrees with this sweep (within ${AGREE_OHMS} Ω).${tail}`;
    case 'rough':
      return level === 'beginner'
        ? `The model is close, not exact.${tail}`
        : `Close enough to rank changes, not exact: resistance ${ohm(g?.dR ?? null)}, reactance ${ohm(g?.dX ?? null)} (model minus sweep). Near the edge of the tuner's range it can be wrong about matching.${tail}`;
    case 'off':
      return `The model doesn't agree with this sweep: refit before trusting suggestions.${tail}`;
    case 'unknown':
      return `Can't compare yet: the sweep or the model has no point at 13.56 MHz.${tail}`;
  }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/present/agreement.ts src/present/agreement.test.ts
git commit -m "feat(present): model-vs-sweep agreement in the sweep's own state, majority across cable assumptions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Recommendation rows, refit, and guide status

**Files:**
- Create: `src/present/recs.ts`, `src/present/refit.ts`, `src/present/guide.ts`
- Test: `src/present/recs.test.ts`, `src/present/refit.test.ts`

**Interfaces:**
- Consumes:
  - `recommend`, `RecommendOutput`, `Recommendation` (`src/recommend/recommend.ts`);
  - `lowerMedian` (`rank.ts`);
  - `fitNetwork` (`src/fit/network.ts`);
  - `freeRefs` (`src/fit/params.ts`);
  - Task 3's `verdictOf`, `combine`, `windowDistance`;
  - Task 1's `knownState`.
- Produces, in `recs.ts`:
  - `MAX_ROWS = 5`;
  - `type StressFlag = 'ok' | 'amber' | 'red' | 'unknown'`;
  - `stressFlag(pct: number | null): StressFlag`;
  - `type RecNote = 'nothing-beats' | 'none-fit' | 'all-red'`;
  - `interface RecRow { picks: Record<string, Pick>; movesText: string[]; isCurrent: boolean; verdict: VerdictState; inCount: number; total: number; stressPct: number | null; stress: StressFlag }`;
  - `interface RecView { rows: RecRow[]; closest: RecRow[]; notes: RecNote[]; currentStressPct: number | null }`;
  - `shapeRecs(out: RecommendOutput, w: Window): RecView`;
  - `noChangeNeeded(v: VerdictState, currentStressPct: number | null): boolean`;
  - `picksState(picks: Record<string, Pick>): StateOverrides`.
- Produces, in `refit.ts`:
  - `refitRefs(s: AppState): ParamRef[]`;
  - `refitVariant(s: AppState, i: number, refs: ParamRef[]): FitValues`;
  - `refitAll(s: AppState, progress: (i: number, n: number) => void, pause?: () => Promise<void>): Promise<{ fits: Record<string, FitValues> } | { error: string }>`.
- Produces, in `guide.ts`: `type StepStatus = 'done' | 'current' | 'waiting'` and `newSweepStatus(confirmed: boolean, loaded: boolean): StepStatus[]`.

- [ ] **Step 1: Write the failing tests**

`src/present/recs.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import type { Landing } from '../recommend/landing.ts';
import { type Recommendation, type RecommendOutput, recommend } from '../recommend/recommend.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { variantChain } from '../app/state.ts';
import { ROOT } from '../testutil.ts';
import { noChangeNeeded, picksState, shapeRecs, stressFlag } from './recs.ts';
import { newSweepStatus } from './guide.ts';

const land = (re: number, im: number, inWindow: boolean, roomUp = 1.5): Landing => ({ z: cx(re, im), f: 13.56e6, inWindow, roomUp: inWindow ? roomUp : -99, roomDown: inWindow ? 1 : -99 });
const rec = (moves: number, stress: number | null, ls: Landing[]): Recommendation => ({
  candidate: { picks: { ser: { counts: counts(moves, 0, 0), nSeries: 1 } } }, landings: ls, inCount: ls.filter((l) => l.inWindow).length, roomScore: 1, moves, maxStressPct: stress, movesText: [`move ${moves}`],
});
const out = (ranked: Recommendation[], all: Recommendation[] = ranked): RecommendOutput => ({ ranked, all, current: {} });

test('the current build ranking first means nothing in stock beats it; every row red adds the power note', () => {
  const inside = [land(10, 20, true), land(10, 20, true), land(2, 2, false)];
  const v = shapeRecs(out([rec(0, 111, inside), rec(2, 129, inside)]), AIT_WINDOW);
  assert.ok(v.rows[0].isCurrent);
  assert.deepEqual(v.notes, ['nothing-beats', 'all-red']);
  assert.equal(v.rows[0].verdict, 'some');
  assert.equal(v.currentStressPct, 111);
});

test('nothing ranks: say so and list the three closest by median distance outside the window', () => {
  const far = (d: number) => rec(d, 50, [land(17 + d, 20, false), land(17 + d, 20, false), land(17 + d, 20, false)]);
  const v = shapeRecs(out([], [far(9), far(1), far(5), far(3)]), AIT_WINDOW);
  assert.deepEqual(v.notes, ['none-fit']);
  assert.deepEqual(v.closest.map((r) => r.movesText[0]), ['move 1', 'move 3', 'move 5']);
});

test('no stock at all: none-fit with no closest list and no crash (review focus 4)', () => {
  assert.deepEqual(shapeRecs(out([], []), AIT_WINDOW), { rows: [], closest: [], notes: ['none-fit'], currentStressPct: null });
});

test('stress flags at 80 and 100 percent; unknown stays unknown; at most five rows', () => {
  assert.deepEqual([null, 79.9, 80, 99.9, 100].map(stressFlag), ['unknown', 'ok', 'amber', 'amber', 'red']);
  const many = Array.from({ length: 8 }, (_, i) => rec(i + 1, 10, [land(10, 20, true)]));
  assert.equal(shapeRecs(out(many), AIT_WINDOW).rows.length, 5);
});

test('"No change needed" needs plenty of room and capacitor stress under 100 % (spec §8.1)', () => {
  assert.ok(noChangeNeeded('plenty', 60));
  assert.ok(!noChangeNeeded('plenty', 111));
  assert.ok(!noChangeNeeded('plenty', null));
  assert.ok(!noChangeNeeded('some', 10));
});

test('picksState turns picks into circuit-state overrides', () => {
  assert.deepEqual(picksState({ ser: { counts: counts(1, 0, 0), nSeries: 1 } }), { ser: { counts: counts(1, 0, 0), nSeries: 1 } });
});

test('O7 example: four rows rank, the current build is first and over its rating at 500 W', () => {
  const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
  const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
  const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
  const o = recommend({ fitted: ex.variants.map((variant, i) => ({ variant, chain: variantChain(ex, i) })), sweeps: ex.sweeps, grid: evalGrid(ex.chain, ex.sweeps), window: ex.window, stock: ex.stock, stressWatts: ex.powerW });
  const v = shapeRecs(o, ex.window);
  assert.equal(v.rows.length, 4);
  assert.ok(v.rows[0].isCurrent && v.notes.includes('nothing-beats'));
  assert.ok(v.currentStressPct !== null && v.currentStressPct > 100);
});

test('guide steps: confirm, then load, then the rest open together', () => {
  assert.deepEqual(newSweepStatus(false, false), ['current', 'waiting', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(newSweepStatus(true, false), ['done', 'current', 'waiting', 'waiting', 'waiting']);
  assert.deepEqual(newSweepStatus(true, true), ['done', 'done', 'current', 'current', 'current']);
});
```

`src/present/refit.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { ROOT } from '../testutil.ts';
import { refitAll, refitRefs, refitVariant } from './refit.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('refit reuses the current fits\' parameters and converges on the five O7 sweeps (spec §8.1)', () => {
  const refs = refitRefs(ex);
  assert.equal(refs.length, 6);
  const f = refitVariant(ex, 0, refs);
  assert.equal(f.converged, true);
  assert.ok(f.rms !== null && f.rms < 0.1, `rms ${f.rms}`);
  assert.equal(f.source, 'in-app refit (5 sweeps)');
  assert.ok(f.x[0] > 550 && f.x[0] < 650, `wiring L ${f.x[0]} nH`);
});

test('a failing refit returns its reason and no fits, so the caller keeps the previous ones', async () => {
  const broken = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[0], sweepId: 'missing' }] };
  const r = await refitAll(broken, () => {}, async () => {});
  assert.ok('error' in r);
});

test('nothing marked free and no fits: refitAll says there is nothing to refit', async () => {
  const bare = { ...ex, fits: {}, chain: { ...ex.chain, blocks: [ex.chain.blocks[0]] } };
  assert.deepEqual(await refitAll(bare, () => {}, async () => {}), { error: 'Nothing to refit: no value is marked free to fit.' });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --experimental-strip-types --test src/present/recs.test.ts src/present/refit.test.ts`
Expected: FAIL. The errors should be `Cannot find module` for `./recs.ts` and `./refit.ts`.

- [ ] **Step 3: Write the three modules**

```ts
// src/present/recs.ts
import type { StateOverrides } from '../chain/state.ts';
import type { Window } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import type { Recommendation, RecommendOutput } from '../recommend/recommend.ts';
import { lowerMedian } from '../recommend/rank.ts';
import { type VerdictState, combine, verdictOf, windowDistance } from './verdict.ts';

export const MAX_ROWS = 5;
export type StressFlag = 'ok' | 'amber' | 'red' | 'unknown';
export type RecNote = 'nothing-beats' | 'none-fit' | 'all-red';
export interface RecRow { picks: Record<string, Pick>; movesText: string[]; isCurrent: boolean; verdict: VerdictState; inCount: number; total: number; stressPct: number | null; stress: StressFlag }
export interface RecView { rows: RecRow[]; closest: RecRow[]; notes: RecNote[]; currentStressPct: number | null }

/** Capacitor stress at the planned power: amber from 80 %, red from 100 %; no number is unknown, never ok. */
export const stressFlag = (pct: number | null): StressFlag => (pct === null ? 'unknown' : pct >= 100 ? 'red' : pct >= 80 ? 'amber' : 'ok');

function row(r: Recommendation, w: Window): RecRow {
  return {
    picks: r.candidate.picks, movesText: r.movesText, isCurrent: r.moves === 0,
    verdict: combine(r.landings.map((l) => verdictOf(l, w).state)).state,
    inCount: r.inCount, total: r.landings.length, stressPct: r.maxStressPct, stress: stressFlag(r.maxStressPct),
  };
}
const medianDistance = (r: Recommendation, w: Window): number => lowerMedian(r.landings.map((l) => windowDistance(l.z, w)));

/** Step 4's list from the recommender's real output (spec §8.1): current-build row, notes, and the closest fallback. */
export function shapeRecs(out: RecommendOutput, w: Window): RecView {
  const rows = out.ranked.slice(0, MAX_ROWS).map((r) => row(r, w));
  const notes: RecNote[] = [];
  let closest: RecRow[] = [];
  if (!rows.length) {
    notes.push('none-fit');
    closest = [...out.all].sort((a, b) => medianDistance(a, w) - medianDistance(b, w)).slice(0, 3).map((r) => row(r, w));
  } else {
    if (rows[0].isCurrent) notes.push('nothing-beats');
    if (rows.every((r) => r.stress === 'red')) notes.push('all-red');
  }
  return { rows, closest, notes, currentStressPct: out.all.find((r) => r.moves === 0)?.maxStressPct ?? null };
}

/** "No change needed" only with plenty of room and capacitor stress under 100 % at the planned power (spec §8.1). */
export const noChangeNeeded = (v: VerdictState, currentStressPct: number | null): boolean => v === 'plenty' && currentStressPct !== null && currentStressPct < 100;

export const picksState = (picks: Record<string, Pick>): StateOverrides =>
  Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { counts: p.counts, nSeries: p.nSeries }]));
```

```ts
// src/present/refit.ts
import { fitNetwork } from '../fit/network.ts';
import { type ParamRef, freeRefs } from '../fit/params.ts';
import { type AppState, type FitValues, variantChain } from '../app/state.ts';
import { knownState } from './circuit.ts';

/** The parameters to refit: the current fits' (spec §8.1), else every value marked free. */
export function refitRefs(s: AppState): ParamRef[] {
  const f = Object.values(s.fits).find((x) => x.refs.length > 0);
  return f ? f.refs : freeRefs(s.chain);
}

/** One cable assumption refitted against every included tagged sweep, started from its current fit. */
export function refitVariant(s: AppState, i: number, refs: ParamRef[]): FitValues {
  const sweeps = s.tagged.map((t) => ({ sweep: s.sweeps[t.sweepId], state: knownState(s.chain, t.state), include: t.include }));
  const fit = fitNetwork({ chain: variantChain(s, i), refs, sweeps, variant: s.variants[i], allSweeps: s.sweeps });
  return { refs, x: fit.x, source: `in-app refit (${sweeps.filter((t) => t.include).length} sweeps)`, converged: fit.converged, rms: fit.rms, illDetermined: fit.illDetermined };
}

const nextFrame = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Refit every cable assumption in turn, yielding before each so progress can render; any failure returns its reason. */
export async function refitAll(s: AppState, progress: (i: number, n: number) => void, pause: () => Promise<void> = nextFrame): Promise<{ fits: Record<string, FitValues> } | { error: string }> {
  const refs = refitRefs(s);
  if (!refs.length) return { error: 'Nothing to refit: no value is marked free to fit.' };
  const fits: Record<string, FitValues> = {};
  for (let i = 0; i < s.variants.length; i += 1) {
    progress(i, s.variants.length);
    await pause();
    try {
      fits[s.variants[i].name] = refitVariant(s, i, refs);
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return { fits };
}
```

```ts
// src/present/guide.ts
export type StepStatus = 'done' | 'current' | 'waiting';

/** "I measured a new sweep": confirm, then load; steps 3–5 open together once a sweep is loaded (spec §8.1). */
export function newSweepStatus(confirmed: boolean, loaded: boolean): StepStatus[] {
  if (!confirmed) return ['current', 'waiting', 'waiting', 'waiting', 'waiting'];
  if (!loaded) return ['done', 'current', 'waiting', 'waiting', 'waiting'];
  return ['done', 'done', 'current', 'current', 'current'];
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS. The O7 recommend test adds about 1 s and the refit test about 2 s.

- [ ] **Step 5: Commit**

```bash
git add src/present/recs.ts src/present/refit.ts src/present/guide.ts src/present/recs.test.ts src/present/refit.test.ts
git commit -m "feat(present): recommendation rows with honest notes, in-app refit, new-sweep step status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Ladder layout for the hardware and schematic drawings

**Files:**
- Create: `src/present/layout.ts`
- Test: `src/present/layout.test.ts`

**Interfaces:**
- Produces:
  - `type PartKind = 'coax' | 'capBank' | 'inductor' | 'wire' | 'R' | 'L' | 'C' | 'short' | 'stack' | 'ideal' | 'measured' | 'plates'`;
  - `type Dir = 'h' | 'v'`;
  - `interface Pt { x: number; y: number }`;
  - `interface PartBox { id: string; kind: PartKind; x: number; y: number; w: number; h: number; dir: Dir }`, where x, y is the top-left corner in grid units;
  - `interface Seg { a: Pt; b: Pt }`;
  - `interface Layout { parts: PartBox[]; wires: Seg[]; junctions: Pt[]; grounds: Pt[]; port: Pt; minX: number; minY: number; maxX: number; maxY: number }`;
  - `PITCH = 2`, `BOX = 1.4`;
  - `layoutChain(chain: Chain): Layout`.
- Geometry contract the renderers rely on (Task 10):
  - a horizontal part's terminals are `(x, y + 0.5)` and `(x + w, y + 0.5)`; a vertical part's are `(x + 0.5, y)` and `(x + 0.5, y + h)`;
  - the main line runs at y = 0 from the port at (0, 0);
  - ground points are where a ground symbol is drawn, extending 0.6 units downward.

- [ ] **Step 1: Write the failing test** `src/present/layout.test.ts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { allBlocks } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';
import { type Layout, type PartBox, type Pt, layoutChain } from './layout.ts';

const EPS = 1e-9;
const near = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const terminals = (p: PartBox): Pt[] => (p.dir === 'h' ? [{ x: p.x, y: p.y + 0.5 }, { x: p.x + p.w, y: p.y + 0.5 }] : [{ x: p.x + 0.5, y: p.y }, { x: p.x + 0.5, y: p.y + p.h }]);
const overlap = (a: PartBox, b: PartBox): boolean => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const leafIds = (c: Chain): string[] => allBlocks(c.blocks).filter((b) => b.type !== 'shunt' && b.type !== 'parallel').map((b) => b.id).sort();

/** The three properties of spec §6.1: every leaf once, no overlapping boxes, no dangling wire ends. */
function checkProperties(c: Chain, l: Layout): void {
  assert.deepEqual(l.parts.map((p) => p.id).sort(), leafIds(c), 'every leaf block appears exactly once');
  for (let i = 0; i < l.parts.length; i += 1) for (let k = i + 1; k < l.parts.length; k += 1) assert.ok(!overlap(l.parts[i], l.parts[k]), `${l.parts[i].id} overlaps ${l.parts[k].id}`);
  const anchors = [l.port, ...l.junctions, ...l.grounds, ...l.parts.flatMap(terminals)];
  const ends = l.wires.flatMap((w) => [w.a, w.b]);
  for (const e of ends) {
    const anchored = anchors.some((a) => near(a, e));
    const shared = ends.filter((o) => near(o, e)).length >= 2;
    assert.ok(anchored || shared, `wire end (${e.x}, ${e.y}) is dangling`);
  }
}

test('O7: six parts, the shunt bank hangs down, the transformer arm ends the line as its load (spec §6.1)', () => {
  const c = o7Chain('capfree');
  const l = layoutChain(c);
  checkProperties(c, l);
  const by = (id: string): PartBox => l.parts.find((p) => p.id === id) as PartBox;
  assert.equal(by('sh').dir, 'v');
  for (const id of ['coax', 'ser', 'Ls', 'Lb', 'branch']) {
    assert.equal(by(id).dir, 'h');
    assert.ok(Math.abs(by(id).y + 0.5) < EPS, `${id} sits on the main line`);
  }
  assert.equal(by('branch').kind, 'measured');
  assert.equal(l.junctions.length, 1);
  assert.equal(l.grounds.length, 2);
});

test('C+D: the plates arm is the end load; stack and plates sit on the main line', () => {
  const c = cdChain();
  const l = layoutChain(c);
  checkProperties(c, l);
  assert.deepEqual(['stack', 'plates'].map((id) => l.parts.find((p) => p.id === id)?.dir), ['h', 'h']);
});

test('nested shunts and parallel arms still lay out without overlaps or dangling wires', () => {
  const prim = (id: string, kind: 'R' | 'L' | 'C'): Block => ({ id, label: id, type: 'primitive', kind, value: param(1) });
  const c: Chain = {
    name: 'nested',
    blocks: [
      prim('L1', 'L'),
      { id: 'S1', label: '', type: 'shunt', chain: [prim('L2', 'L'), { id: 'S2', label: '', type: 'shunt', chain: [prim('C1', 'C')] }, { id: 'P1', label: '', type: 'parallel', chains: [[prim('R1', 'R')], [prim('C2', 'C'), prim('L3', 'L')]] }] },
      prim('C3', 'C'),
      { id: 'P2', label: '', type: 'parallel', chains: [[], [prim('R2', 'R')]] },
    ],
  };
  checkProperties(c, layoutChain(c));
});

test('an empty chain is just the port', () => {
  const l = layoutChain({ name: 'blank', blocks: [] });
  assert.deepEqual([l.parts.length, l.wires.length, l.minX, l.maxX, l.minY, l.maxY], [0, 0, 0, 0, 0, 0]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/layout.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./layout.ts`.

- [ ] **Step 3: Write `src/present/layout.ts`**

```ts
import type { Block, Chain } from '../chain/types.ts';

export type PartKind = 'coax' | 'capBank' | 'inductor' | 'wire' | 'R' | 'L' | 'C' | 'short' | 'stack' | 'ideal' | 'measured' | 'plates';
export type Dir = 'h' | 'v';
export interface Pt { x: number; y: number }
/** A part's box in grid units: (x, y) is its top-left corner; it runs along `dir`. */
export interface PartBox { id: string; kind: PartKind; x: number; y: number; w: number; h: number; dir: Dir }
export interface Seg { a: Pt; b: Pt }
export interface Layout { parts: PartBox[]; wires: Seg[]; junctions: Pt[]; grounds: Pt[]; port: Pt; minX: number; minY: number; maxX: number; maxY: number }

/** Each series part takes PITCH along its line; its box is BOX long and 1 wide. */
export const PITCH = 2;
export const BOX = 1.4;
const GAP = (PITCH - BOX) / 2;

function kindOf(b: Block): PartKind {
  switch (b.type) {
    case 'primitive':
      return b.kind;
    case 'measuredBranch':
      return 'measured';
    case 'shunt':
    case 'parallel':
      throw new Error(`"${b.id}" is a container, not a part`);
    default:
      return b.type;
  }
}

/** A line: origin and direction. u runs along it; w runs across (+w is down for 'h', right for 'v'). */
interface Line { o: Pt; dir: Dir }
const at = (l: Line, u: number, w: number): Pt => (l.dir === 'h' ? { x: l.o.x + u, y: l.o.y + w } : { x: l.o.x + w, y: l.o.y + u });
const perp = (d: Dir): Dir => (d === 'h' ? 'v' : 'h');

interface Acc { parts: PartBox[]; wires: Seg[]; junctions: Pt[]; grounds: Pt[] }
/** After laying a run: the last terminal, the next free u, and how far anything reached across (+w). */
interface Run { cursor: Pt; u: number; extent: number }

function part(acc: Acc, l: Line, b: Block, u: number): Pt {
  const s = at(l, u + GAP, 0);
  acc.parts.push(l.dir === 'h'
    ? { id: b.id, kind: kindOf(b), x: s.x, y: s.y - 0.5, w: BOX, h: 1, dir: 'h' }
    : { id: b.id, kind: kindOf(b), x: s.x - 0.5, y: s.y, w: 1, h: BOX, dir: 'v' });
  return at(l, u + GAP + BOX, 0);
}

/** Lay blocks along a line from u0, wiring from `cursor`; with `endLoad`, a final shunt continues the line to ground. */
function run(acc: Acc, blocks: readonly Block[], l: Line, cursor: Pt, u0: number, endLoad: boolean): Run {
  let u = u0;
  let cur = cursor;
  let extent = 0.5;
  blocks.forEach((b, i) => {
    if (b.type === 'shunt' && endLoad && i === blocks.length - 1) {
      const r = run(acc, b.chain, l, cur, u, false);
      const g = at(l, r.u + GAP, 0);
      acc.wires.push({ a: r.cursor, b: g });
      acc.grounds.push(g);
      extent = Math.max(extent, r.extent);
      cur = g;
      u = r.u + PITCH;
    } else if (b.type === 'shunt') {
      const j = at(l, u + 0.5, 0);
      acc.wires.push({ a: cur, b: j });
      acc.junctions.push(j);
      const child: Line = { o: j, dir: perp(l.dir) };
      const r = run(acc, b.chain, child, j, 0, false);
      const g = at(child, r.u + GAP, 0);
      acc.wires.push({ a: r.cursor, b: g });
      acc.grounds.push(g);
      extent = Math.max(extent, r.u + GAP);
      cur = j;
      u += 0.5 + Math.max(1, r.extent + 0.5);
    } else if (b.type === 'parallel') {
      const a = at(l, u + 0.5, 0);
      acc.wires.push({ a: cur, b: a });
      acc.junctions.push(a);
      const arms: { r: Run; off: number }[] = [];
      let off = 0;
      for (const arm of b.chains) {
        const armLine: Line = { o: at(l, 0, off), dir: l.dir };
        const start = at(armLine, u + 0.5, 0);
        if (off !== 0) acc.wires.push({ a, b: start });
        const r = run(acc, arm, armLine, start, u + 0.5, false);
        arms.push({ r, off });
        off += r.extent + 1;
      }
      const uB = Math.max(u + 1, ...arms.map((x) => x.r.u)) + GAP;
      const bj = at(l, uB, 0);
      for (const { r, off: o } of arms) {
        const end = at(l, uB, o);
        if (r.cursor.x !== end.x || r.cursor.y !== end.y) acc.wires.push({ a: r.cursor, b: end });
        if (o !== 0) acc.wires.push({ a: end, b: bj });
      }
      acc.junctions.push(bj);
      const last = arms.at(-1);
      if (last) extent = Math.max(extent, last.off + last.r.extent);
      cur = bj;
      u = uB;
    } else {
      acc.wires.push({ a: cur, b: at(l, u + GAP, 0) });
      cur = part(acc, l, b, u);
      u += PITCH;
    }
  });
  return { cursor: cur, u, extent };
}

/** Ladder geometry for a chain: main line rightward from the port, shunts perpendicular to their line (spec §6.1). */
export function layoutChain(chain: Chain): Layout {
  const acc: Acc = { parts: [], wires: [], junctions: [], grounds: [] };
  const port: Pt = { x: 0, y: 0 };
  run(acc, chain.blocks, { o: port, dir: 'h' }, port, 0, true);
  const xs = [port.x, ...acc.parts.flatMap((p) => [p.x, p.x + p.w]), ...acc.wires.flatMap((s) => [s.a.x, s.b.x]), ...acc.grounds.map((g) => g.x)];
  const ys = [port.y, ...acc.parts.flatMap((p) => [p.y, p.y + p.h]), ...acc.wires.flatMap((s) => [s.a.y, s.b.y]), ...acc.grounds.map((g) => g.y + 0.6)];
  const flat = acc.parts.length === 0;
  return { ...acc, port, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: flat ? 0 : Math.max(...ys) };
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/present/layout.ts src/present/layout.test.ts
git commit -m "feat(present): ladder layout shared by the hardware and schematic drawings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Power-flow stages

**Files:**
- Create: `src/present/stages.ts`
- Test: `src/present/stages.test.ts`

**Interfaces:**
- Produces:
  - `type StageKind = 'generator' | 'tuner' | 'cable' | 'matching' | 'transformer' | 'plates'`;
  - `interface Stage { kind: StageKind; blockIds: string[]; measuredTogether: boolean }`;
  - `stagesOf(chain: Chain): Stage[]`;
  - `stageTitle(s: Stage): string`.

- [ ] **Step 1: Write the failing test** `src/present/stages.test.ts`

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { allBlocks } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import { stageTitle, stagesOf } from './stages.ts';

const leaves = (c: Chain): string[] => allBlocks(c.blocks).filter((b) => b.type !== 'shunt' && b.type !== 'parallel').map((b) => b.id).sort();
const ids = (c: Chain): string[] => stagesOf(c).flatMap((s) => s.blockIds).sort();

test('O7: the measured pair is "Transformer + plates (measured together)" and there is no separate Plates stage', () => {
  const s = stagesOf(o7Chain('capfree'));
  assert.deepEqual(s.map((x) => x.kind), ['generator', 'tuner', 'cable', 'matching', 'transformer']);
  assert.deepEqual(s.find((x) => x.kind === 'matching')?.blockIds, ['ser', 'Ls', 'sh']);
  const t = s.find((x) => x.kind === 'transformer');
  assert.deepEqual(t?.blockIds, ['Lb', 'branch']);
  assert.equal(t && stageTitle(t), 'Transformer + plates (measured together)');
});

test('C+D: wiring before the stack is matching; the stack is the transformer; plates are their own stage', () => {
  const s = stagesOf(cdChain());
  assert.deepEqual(s.map((x) => x.kind), ['generator', 'tuner', 'cable', 'matching', 'transformer', 'plates']);
  assert.deepEqual(s.find((x) => x.kind === 'transformer')?.blockIds, ['stack']);
  assert.deepEqual(s.find((x) => x.kind === 'plates')?.blockIds, ['plates']);
});

test('every leaf block lands in exactly one stage', () => {
  for (const c of [o7Chain('capfree'), cdChain()]) assert.deepEqual(ids(c), leaves(c));
});

test('a blank network keeps generator, tuner and cable only', () => {
  const blank: Chain = { name: 'blank', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] };
  assert.deepEqual(stagesOf(blank).map((x) => [x.kind, x.blockIds]), [['generator', []], ['tuner', []], ['cable', ['coax']]]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/stages.test.ts`
Expected: FAIL. The error should be `Cannot find module` for `./stages.ts`.

- [ ] **Step 3: Write `src/present/stages.ts`**

```ts
import { allBlocks } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';

export type StageKind = 'generator' | 'tuner' | 'cable' | 'matching' | 'transformer' | 'plates';
export interface Stage { kind: StageKind; blockIds: string[]; measuredTogether: boolean }

const TRANSFORMER: ReadonlySet<Block['type']> = new Set(['stack', 'ideal', 'measuredBranch']);
const leaves = (b: Block): Block[] => allBlocks([b]).filter((x) => x.type !== 'shunt' && x.type !== 'parallel');

/** The power-flow grouping for the Beginner drawing: every leaf block in exactly one stage (spec §6.2). */
export function stagesOf(chain: Chain): Stage[] {
  const t = chain.blocks.findIndex((b) => leaves(b).some((x) => TRANSFORMER.has(x.type)));
  const before = (t < 0 ? chain.blocks : chain.blocks.slice(0, t)).flatMap(leaves);
  const after = (t < 0 ? [] : chain.blocks.slice(t)).flatMap(leaves);
  const first = after.find((x) => TRANSFORMER.has(x.type));
  const stage = (kind: StageKind, blocks: Block[], measuredTogether = false): Stage => ({ kind, blockIds: blocks.map((b) => b.id), measuredTogether });
  const all = [
    stage('generator', []),
    stage('tuner', []),
    stage('cable', before.filter((x) => x.type === 'coax')),
    stage('matching', before.filter((x) => x.type !== 'coax' && x.type !== 'plates')),
    stage('transformer', after.filter((x) => x.type !== 'plates'), first?.type === 'measuredBranch'),
    stage('plates', [...before, ...after].filter((x) => x.type === 'plates')),
  ];
  return all.filter((s) => s.blockIds.length > 0 || s.kind === 'generator' || s.kind === 'tuner' || s.kind === 'cable');
}

export function stageTitle(s: Stage): string {
  switch (s.kind) {
    case 'generator':
      return 'Generator';
    case 'tuner':
      return 'Auto-tuner';
    case 'cable':
      return 'Cable';
    case 'matching':
      return 'Matching box';
    case 'transformer':
      return s.measuredTogether ? 'Transformer + plates (measured together)' : 'Transformer';
    case 'plates':
      return 'Plates + part';
  }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/present/stages.ts src/present/stages.test.ts
git commit -m "feat(present): power-flow stages for the Beginner drawing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Project file (rfnm/1) and sweep-file loading

**Files:**
- Create: `src/project/file.ts`, `src/app/sweepFile.ts`
- Test: `src/project/file.test.ts`, `src/app/sweepFile.test.ts`

**Interfaces:**
- Produces, in `file.ts`:
  - `FORMAT = 'rfnm/1'`;
  - `class ProjectFileError extends Error`;
  - `interface OpenedProject { name: string; savedAt: string; state: AppState }`;
  - `toProjectJson(s: AppState, savedAt: string): string`;
  - `fromProjectJson(text: string): OpenedProject`.
- Produces, in `sweepFile.ts`:
  - `sweepFromFile(name: string, text: string, taken: Record<string, Sweep>): Sweep`, which throws `Error("<name>: <reason>")`;
  - `sweepLabel(name: string): string`.
- **Persisted fields** (spec §9): `chain`, `variants`, `primary`, `fits`, `sweeps`, `tagged`, `activeSweep`, `stock`, `window`, `powerW`. `selected` and `panes` are not saved; `fromProjectJson` fills them from `emptyState()`.

- [ ] **Step 1: Write the failing tests**

`src/project/file.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { O7_FILES, cdChain } from '../chain/presets.ts';
import { findBlock } from '../chain/state.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { type AppState, emptyState } from '../app/state.ts';
import { snapshotState, structureKey } from '../present/circuit.ts';
import { ROOT, loadFixtureSweep } from '../testutil.ts';
import { fromProjectJson, toProjectJson } from './file.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const cd: AppState = (() => {
  const chain = cdChain();
  return { ...emptyState(), chain, sweeps: { cd: loadFixtureSweep('cd', O7_FILES.cdNet) }, tagged: [{ sweepId: 'cd', label: 'cd', state: snapshotState(chain), include: true, structure: structureKey(chain) }], activeSweep: 'cd' };
})();
const T = '2026-10-15T00:00:00.000Z';

test('save then open gives the same project: the O7 example and a C+D project (spec §9)', () => {
  assert.deepEqual(fromProjectJson(toProjectJson(ex, T)).state, ex);
  assert.deepEqual(fromProjectJson(toProjectJson(cd, T)).state, cd);
});

test('unbounded parameters survive the file: ±Infinity is written as null and read back', () => {
  const back = fromProjectJson(toProjectJson(cd, T)).state;
  const ls = findBlock(back.chain, 'Ls');
  assert.ok(ls?.type === 'inductor');
  assert.equal(ls.L.lo, Number.NEGATIVE_INFINITY);
  assert.equal(ls.L.hi, Number.POSITIVE_INFINITY);
  assert.match(toProjectJson(cd, T), /"lo":null/);
});

test('open reports what is wrong, never crashes', () => {
  const good = (): Record<string, any> => JSON.parse(toProjectJson(ex, T));
  const bad = (mut: (j: Record<string, any>) => void): string => { const j = good(); mut(j); return JSON.stringify(j); };
  assert.throws(() => fromProjectJson('{nope'), /isn't a modeller project: it is not valid JSON/);
  assert.throws(() => fromProjectJson(bad((j) => { j.format = 'rfnm/0'; })), /its format is "rfnm\/0"/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.sweeps['o7-80-200'].gamma.pop(); })), /sweep "o7-80-200" has (\d+) frequencies but \d+ points/);
  assert.throws(() => fromProjectJson(bad((j) => { delete j.project.tagged[0].structure; })), /a tagged sweep is malformed/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.tagged[0].sweepId = 'missing'; })), /refers to a missing sweep/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.activeSweep = 'missing'; })), /its shown sweep is missing/);
  assert.throws(() => fromProjectJson(bad((j) => { j.project.primary = 9; })), /cable assumption is out of range/);
});
```

`src/app/sweepFile.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { O7_FILES } from '../chain/presets.ts';
import { ROOT } from '../testutil.ts';
import { sweepFromFile, sweepLabel } from './sweepFile.ts';

test('a sweep file becomes a sweep with a unique id; a bad file names itself in the error', () => {
  const text = readFileSync(new URL(`fixtures/sweeps/${O7_FILES.s80_180_loop}`, ROOT), 'utf8');
  const s = sweepFromFile('80-180-loop.s1p', text, {});
  assert.equal(s.id, '80-180-loop');
  assert.equal(s.f.length, s.gamma.length);
  assert.equal(sweepFromFile('80-180-loop.s1p', text, { [s.id]: s }).id, '80-180-loop-2');
  assert.throws(() => sweepFromFile('notes.s1p', 'hello', {}), /^Error: notes\.s1p: /);
  assert.equal(sweepLabel('80-180-loop.S1P'), '80-180-loop');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --experimental-strip-types --test src/project/file.test.ts src/app/sweepFile.test.ts`
Expected: FAIL. The errors should be `Cannot find module` for `./file.ts` and `./sweepFile.ts`.

- [ ] **Step 3: Write the two modules**

```ts
// src/project/file.ts
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
    state: { ...emptyState(), chain: p.chain, variants: p.variants, primary: p.primary, fits: p.fits, sweeps, tagged: p.tagged, activeSweep: p.activeSweep, stock: p.stock, window: p.window, powerW: p.powerW },
  };
}
```

```ts
// src/app/sweepFile.ts
import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
import { uniqueSweepId } from './state.ts';

/** A sweep from an .s1p file's text, with an id unique among the loaded sweeps; errors name the file. */
export function sweepFromFile(name: string, text: string, taken: Record<string, Sweep>): Sweep {
  try {
    const t = parseS1p(text);
    return { id: uniqueSweepId(taken, name), name, f: t.f, gamma: t.gamma };
  } catch (e) {
    throw new Error(`${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export const sweepLabel = (name: string): string => name.replace(/\.s1p$/i, '');
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS (`parseS1p('hello')` throws "Touchstone data contain a non-numeric token.", probed 2026-10-15).

- [ ] **Step 5: Commit**

```bash
git add src/project/file.ts src/project/file.test.ts src/app/sweepFile.ts src/app/sweepFile.test.ts
git commit -m "feat(project): rfnm/1 project files with honest validation; sweep files name themselves in errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Shell — home, top bar, sheets, autosave, project files; delete the 2a layout

**Not unit-testable:** this task is React wiring plus IndexedDB, and Node has no IndexedDB. Its verification gate is the browser check in Step 7, which also covers Review Focus 1. The pure pieces it calls are tested in Tasks 1–8.

**Files:**
- Create: `src/project/store.ts`, `src/ui/TopBar.tsx`, `src/ui/Home.tsx`, `src/ui/Sheet.tsx`, `src/ui/EngineerPanel.tsx`, `src/ui/Workbench.tsx`
- Rewrite: `src/ui/App.tsx`, `src/ui/app.css`, `src/ui/SweepsPanel.tsx`
- Modify:
  - `src/app/state.ts`: delete the `view` field, the `setView` action and its case;
  - `src/app/example.ts`: delete `view: 'physical',`.
- Delete: `src/ui/CircuitStrip.tsx`, `src/ui/BlockArt.tsx`, `src/ui/LandingStrip.tsx`

**Interfaces:**
- Produces:
  - `type Task = 'home' | 'newSweep'` (in `Home.tsx`);
  - `type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed'` (in `TopBar.tsx`);
  - `interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }`;
  - `EngineerPanel({ state, dispatch, grid, results, theme })`;
  - `VARIANT_COLORS`.
- Produces, in `store.ts`:
  - `interface LibraryEntry { id: string; name: string; savedAt: string; json: string }`;
  - `putProject(e: LibraryEntry): Promise<IDBValidKey>`;
  - `getProject(id: string): Promise<LibraryEntry | undefined>`;
  - `setCurrentId(id: string): Promise<IDBValidKey>`;
  - `getCurrentId(): Promise<string | undefined>`.

- [ ] **Step 1: Write `src/project/store.ts`**

```ts
/** The browser library: one record per project (its rfnm/1 JSON) and the id of the current one (spec §9). */
export interface LibraryEntry { id: string; name: string; savedAt: string; json: string }

const DB = 'rf-network-modeller';
const PROJECTS = 'projects';
const META = 'meta';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PROJECTS, { keyPath: 'id' });
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('the browser refused to open its project store'));
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    const fail = (): void => {
      db.close();
      reject(t.error ?? new Error('the browser could not save the project'));
    };
    t.onerror = fail;
    t.onabort = fail;
  });
}

export const putProject = (e: LibraryEntry): Promise<IDBValidKey> => tx(PROJECTS, 'readwrite', (s) => s.put(e));
export const getProject = (id: string): Promise<LibraryEntry | undefined> => tx(PROJECTS, 'readonly', (s) => s.get(id) as IDBRequest<LibraryEntry | undefined>);
export const setCurrentId = (id: string): Promise<IDBValidKey> => tx(META, 'readwrite', (s) => s.put(id, 'current'));
export const getCurrentId = (): Promise<string | undefined> => tx(META, 'readonly', (s) => s.get('current') as IDBRequest<string | undefined>);
```

- [ ] **Step 2: Write `src/ui/Home.tsx`, `src/ui/TopBar.tsx`, `src/ui/Sheet.tsx`**

```tsx
// src/ui/Home.tsx
export type Task = 'home' | 'newSweep';

const TILES: readonly { task: Task | null; title: string; text: string }[] = [
  { task: 'newSweep', title: 'I measured a new sweep', text: 'Load it, see how it compares, get the next change to make' },
  { task: null, title: 'Try a change first', text: 'Swap a part and see what the VNA would show' },
  { task: null, title: 'Safe at full power?', text: 'Cap voltage and current, transformer flux' },
  { task: null, title: 'Start a new network', text: 'From a template or a blank board' },
  { task: null, title: 'Look back at past builds', text: 'Every build and its sweeps; compare two' },
];

/** What are you doing today? Tasks not built yet are disabled tiles marked "coming next" (spec §3). */
export function Home({ onTask }: { onTask: (t: Task) => void }) {
  return (
    <main className="home">
      <h2>What are you doing today?</h2>
      <div className="tiles">
        {TILES.map((t) => (
          <button key={t.title} className="tile" disabled={t.task === null} onClick={() => { if (t.task) onTask(t.task); }}>
            <b>{t.title}</b>
            <span>{t.text}</span>
            {t.task === null ? <em>coming next</em> : null}
          </button>
        ))}
      </div>
    </main>
  );
}
```

```tsx
// src/ui/TopBar.tsx
import { LEVELS, type Level, PROFILES, type SheetKind } from '../present/level.ts';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed';
const SAVE_TEXT: Record<SaveStatus, string> = { idle: '', pending: 'Saving…', saved: 'Saved ✓', failed: 'Not saved: use Save project' };
const SHEET_TEXT: Record<SheetKind, string> = { parts: 'Parts on hand', sweeps: 'Sweeps' };

export interface TopBarProps {
  name: string;
  taskTitle: string;
  onHome: (() => void) | null;
  level: Level;
  onLevel: (l: Level) => void;
  save: SaveStatus;
  sheets: readonly SheetKind[];
  onSheet: (s: SheetKind) => void;
  onSave: () => void;
  onOpen: (f: File) => void;
  theme: 'light' | 'dark';
  onTheme: () => void;
}

export function TopBar(p: TopBarProps) {
  return (
    <div className="window-title">
      <span className="topbar-left">
        {p.onHome ? <button onClick={p.onHome}>⌂ Home</button> : null}
        <b>RF NETWORK MODELLER</b>
        <span>{p.name}</span>
        {p.taskTitle ? <b>· {p.taskTitle}</b> : null}
      </span>
      <div className="window-actions">
        <span className={`save-status ${p.save}`} role="status">{SAVE_TEXT[p.save]}</span>
        {p.sheets.map((s) => <button key={s} onClick={() => p.onSheet(s)}>{SHEET_TEXT[s]}</button>)}
        <button onClick={p.onSave}>Save project</button>
        <label className="file-picker">Open project<input type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onOpen(f); e.target.value = ''; }} /></label>
        <label className="title-select">Level
          <select value={p.level} onChange={(e) => p.onLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{PROFILES[l].label}</option>)}
          </select>
        </label>
        <button className="theme-toggle" onClick={p.onTheme}>{p.theme === 'light' ? 'Dark' : 'Light'}</button>
      </div>
    </div>
  );
}
```

```tsx
// src/ui/Sheet.tsx
import type { ReactNode } from 'react';

/** A side sheet over the page, closed by its × or a click outside. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header><b>{title}</b><button onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
        {children}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/ui/EngineerPanel.tsx` and the first `src/ui/Workbench.tsx`**

The plot traces move here unchanged from 2a's `App.tsx`.

```tsx
// src/ui/EngineerPanel.tsx
import { type Dispatch, useMemo } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Variant } from '../chain/types.ts';
import { getParam, refName } from '../fit/params.ts';
import { zFromGamma } from '../io/sweep.ts';
import { type VariantResult, measuredLanding } from '../app/evaluate.ts';
import { type Action, type AppState, type FitValues, type PaneMode, variantChain } from '../app/state.ts';
import { displayUnit, fmtZ, toDisplay } from '../app/units.ts';
import { type Dot, PlotPane, type Trace } from './PlotPane.tsx';

export const VARIANT_COLORS = ['#a9008b', '#173de3', '#20aa35'];

function FitTable({ state }: { state: AppState }) {
  const rows = state.variants.map((v, i) => ({ v, i, f: state.fits[v.name] })).filter((r): r is { v: Variant; i: number; f: FitValues } => r.f !== undefined);
  if (!rows.length) return <small>No fitted values yet.</small>;
  const value = (i: number, k: number): string => {
    const ref = rows[0].f.refs[k];
    const b = findBlock(state.chain, ref.blockId);
    if (!b) return 'part removed';
    const u = displayUnit(b, ref.key);
    try {
      return `${toDisplay(getParam(variantChain(state, i), ref).value, u).toPrecision(4)} ${u.unit}`;
    } catch {
      return 'missing';
    }
  };
  return (
    <table className="numbers">
      <thead><tr><th>Fitted values</th>{rows.map(({ v }) => <th key={v.name}>{v.name}</th>)}</tr></thead>
      <tbody>
        {rows[0].f.refs.map((ref, k) => (
          <tr key={refName(ref)}><td>{findBlock(state.chain, ref.blockId)?.label ?? ref.blockId} · {ref.key}</td>{rows.map(({ v, i }) => <td key={v.name}>{value(i, k)}</td>)}</tr>
        ))}
        <tr><td>Settled?</td>{rows.map(({ v, f }) => <td key={v.name}>{f.converged === null ? 'imported (no flag)' : f.converged ? 'yes' : <span className="bad">no</span>}</td>)}</tr>
        <tr><td>RMS |ΔΓ|</td>{rows.map(({ v, f }) => <td key={v.name}>{f.rms === null ? '–' : f.rms.toFixed(4)}</td>)}</tr>
        <tr><td>Can't be told apart</td>{rows.map(({ v, f }) => <td key={v.name}>{f.illDetermined.length ? f.illDetermined.map((p) => p.join(' ~ ')).join('; ') : 'none'}</td>)}</tr>
        <tr><td>Source</td>{rows.map(({ v, f }) => <td key={v.name}>{f.source}</td>)}</tr>
      </tbody>
    </table>
  );
}

/** Engineer result: the four VNA panes, Z at 13.56 MHz per cable assumption, and the fit (spec §7.4). */
export function EngineerPanel({ state, dispatch, grid, results, theme }: { state: AppState; dispatch: Dispatch<Action>; grid: number[]; results: VariantResult[]; theme: 'light' | 'dark' }) {
  const colors = state.variants.map((_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length]);
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const measuredColor = theme === 'dark' ? '#b0b0aa' : '#777777';
  const traces = useMemo<Trace[]>(() => {
    const out: Trace[] = [];
    results.forEach((r, i) => {
      if (r.z.length) out.push({ key: `v${i}`, label: state.variants[i].name, color: colors[i], f: grid, z: r.z, role: i === state.primary ? 'primary' : 'variant', clamped: r.clamped });
    });
    if (active) out.push({ key: 'measured', label: `${active.name} (measured)`, color: measuredColor, f: active.f, z: active.gamma.map((g) => zFromGamma(g)), role: 'measured' });
    return out;
  }, [results, active, grid, state.primary, state.variants, theme]);
  const dots = useMemo<Dot[]>(() => results.flatMap((r, i) => (r.landing ? [{ key: `d${i}`, z: r.landing.z, color: colors[i] }] : [])), [results]);
  const m = active ? measuredLanding(active) : null;
  return (
    <div className="engineer">
      <div className="plots">
        {state.panes.map((mode, i) => <PlotPane key={i} mode={mode} traces={traces} dots={dots} aitWindow={state.window} theme={theme} onMode={(md: PaneMode) => dispatch({ type: 'setPane', index: i, mode: md })} />)}
      </div>
      <label className="title-select">Cable assumption
        <select value={state.primary} onChange={(e) => dispatch({ type: 'setPrimary', index: Number(e.target.value) })}>
          {state.variants.map((v, i) => <option key={v.name} value={i}>{v.name}{v.flag ? ' (poor fit)' : ''}</option>)}
        </select>
      </label>
      <table className="numbers">
        <thead><tr><th>At 13.56 MHz, at the tuner</th><th>Z</th><th>Room to drift up</th></tr></thead>
        <tbody>
          <tr><td>Measured{active ? ` (${active.name})` : ''}</td><td>{active ? (m ? fmtZ(m.z) : 'no point at 13.56 MHz') : 'no sweep shown'}</td><td /></tr>
          {results.map((r, i) => (
            <tr key={state.variants[i].name}>
              <td><span className="swatch" style={{ background: colors[i] }} />{state.variants[i].name}{state.variants[i].flag ? ' (poor fit)' : ''}{i === state.primary ? ' · chosen' : ''}</td>
              <td>{r.error ? `can't evaluate: ${r.error}` : r.landing ? fmtZ(r.landing.z) : 'no point at 13.56 MHz'}</td>
              <td>{r.landing?.inWindow ? `${r.landing.roomUp.toFixed(2)} %` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FitTable state={state} />
    </div>
  );
}
```

```tsx
// src/ui/Workbench.tsx (first version; Tasks 10–13 grow it)
import type { Dispatch } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { VariantResult } from '../app/evaluate.ts';
import type { Action, AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import { EngineerPanel } from './EngineerPanel.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

export function Workbench({ state, dispatch, grid, results, theme }: WorkbenchProps) {
  const clamped = results.some((r) => r.outOfRange);
  return (
    <main className="workbench">
      <div className="wb-main">
        <section className="panel">
          <header className="panel-head"><h3>Where the tuner lands at 13.56 MHz</h3></header>
          <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} />
          {clamped ? <small className="warn-text">The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side" />
    </main>
  );
}
```

- [ ] **Step 4: Rewrite `src/ui/App.tsx`**

```tsx
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { loadExample } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { emptyState, reducer } from '../app/state.ts';
import { type Level, PROFILES, type SheetKind, parseLevel } from '../present/level.ts';
import { fromProjectJson, toProjectJson } from '../project/file.ts';
import { getCurrentId, getProject, putProject, setCurrentId } from '../project/store.ts';
import { Home, type Task } from './Home.tsx';
import { Sheet } from './Sheet.tsx';
import { StockPanel } from './StockPanel.tsx';
import { SweepsPanel } from './SweepsPanel.tsx';
import { type SaveStatus, TopBar } from './TopBar.tsx';
import { Workbench } from './Workbench.tsx';

type Theme = 'light' | 'dark';
const LEVEL_KEY = 'rfnm-level';
const TASK_TITLE: Record<Task, string> = { home: '', newSweep: 'I measured a new sweep' };
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const newId = (): string => `p-${Date.now().toString(36)}`;

function readLevel(): Level {
  try {
    return parseLevel(localStorage.getItem(LEVEL_KEY));
  } catch {
    return 'builder';
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [level, setLevel] = useState<Level>(readLevel);
  const [task, setTask] = useState<Task>('home');
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const caches = useRef<BranchCache[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rfnm-theme', theme);
    } catch {
      // storage unavailable: the theme still applies for this session
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1e20' : '#cfcfcd');
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(LEVEL_KEY, level);
    } catch {
      // the level is a per-viewer convenience; it still applies for this session
    }
    setSheet((s) => (s && PROFILES[level].sheets.includes(s) ? s : null));
  }, [level]);

  // Reopen the last project; fall back to the O7 example with a notice (review focus 1).
  useEffect(() => {
    let live = true;
    const start = async (): Promise<void> => {
      try {
        const id = await getCurrentId();
        const entry = id ? await getProject(id) : undefined;
        if (entry) {
          const p = fromProjectJson(entry.json);
          if (live) {
            dispatch({ type: 'load', state: p.state });
            setProjectId(entry.id);
          }
          return;
        }
      } catch (e) {
        if (live) setNotice(`Couldn't reopen your saved project (${message(e)}). Showing the O7 example instead.`);
      }
      try {
        const s = await loadExample();
        if (live) {
          dispatch({ type: 'load', state: s });
          setProjectId(newId());
        }
      } catch (e) {
        if (live) setNotice(`Couldn't load the O7 example: ${message(e)}`);
      }
    };
    void start();
    return () => {
      live = false;
    };
  }, []);

  // Autosave one second after the last change; "Saved ✓" only after a confirmed write (spec §9).
  useEffect(() => {
    if (!projectId) return undefined;
    setSave('pending');
    const t = setTimeout(() => {
      const savedAt = new Date().toISOString();
      putProject({ id: projectId, name: state.chain.name, savedAt, json: toProjectJson(state, savedAt) })
        .then(() => setCurrentId(projectId))
        .then(() => setSave('saved'), () => setSave('failed'));
    }, 1000);
    return () => clearTimeout(t);
  }, [state, projectId]);

  const saveFile = (): void => {
    const url = URL.createObjectURL(new Blob([toProjectJson(state, new Date().toISOString())], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.chain.name.replace(/[^A-Za-z0-9_-]+/g, '-') || 'project'}.rfnm.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const openFile = async (file: File): Promise<void> => {
    try {
      const p = fromProjectJson(await file.text());
      dispatch({ type: 'load', state: p.state });
      setProjectId(newId());
      setTask('home');
      setNotice(null);
    } catch (e) {
      setNotice(message(e));
    }
  };

  const grid = useMemo(() => evalGrid(state.chain, state.sweeps), [state.chain, state.sweeps]);
  const results = useMemo(() => evaluateVariants(state, grid, caches.current), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);

  return (
    <div className="application">
      <TopBar name={state.chain.name} taskTitle={TASK_TITLE[task]} onHome={task === 'home' ? null : () => setTask('home')} level={level} onLevel={setLevel}
        save={save} sheets={PROFILES[level].sheets} onSheet={setSheet} onSave={saveFile} onOpen={(f) => { void openFile(f); }}
        theme={theme} onTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      {notice ? <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}
      {task === 'home' ? <Home onTask={setTask} /> : <Workbench state={state} dispatch={dispatch} level={level} grid={grid} results={results} caches={caches.current} theme={theme} />}
      {sheet ? (
        <Sheet title={sheet === 'parts' ? 'Parts on hand' : 'Sweeps'} onClose={() => setSheet(null)}>
          {sheet === 'parts' ? <StockPanel state={state} dispatch={dispatch} /> : <SweepsPanel state={state} dispatch={dispatch} />}
        </Sheet>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite `src/ui/SweepsPanel.tsx`, remove `view`, delete the dead files**

```tsx
import { type Dispatch, useState } from 'react';
import type { Sweep } from '../io/sweep.ts';
import type { Action, AppState } from '../app/state.ts';
import { sweepFromFile, sweepLabel } from '../app/sweepFile.ts';
import { tagSummary } from '../app/units.ts';

export function SweepsPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [error, setError] = useState<string | null>(null);
  async function onFiles(files: FileList | null): Promise<void> {
    setError(null);
    const taken: Record<string, Sweep> = { ...state.sweeps };
    const problems: string[] = [];
    for (const file of Array.from(files ?? [])) {
      try {
        const sweep = sweepFromFile(file.name, await file.text(), taken);
        taken[sweep.id] = sweep;
        dispatch({ type: 'addSweep', sweep, label: sweepLabel(file.name) });
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (problems.length) setError(problems.join(' · '));
  }
  return (
    <div className="sweeps">
      <label className="file-picker">Load .s1p sweep(s)…<input type="file" accept=".s1p" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
      {error ? <small className="bad">{error}</small> : null}
      <small>A loaded sweep is tagged with the circuit as it is now. If a tag is wrong, set the circuit to match and press Re-tag.</small>
      <div className="sweep-list">
        {state.tagged.map((t) => (
          <div className={`sweep-row ${state.activeSweep === t.sweepId ? 'active' : ''}`} key={t.sweepId}>
            <input type="radio" name="active-sweep" checked={state.activeSweep === t.sweepId} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: t.sweepId })} title="Show this sweep" />
            <label className="sweep-name"><input type="checkbox" checked={t.include} onChange={() => dispatch({ type: 'toggleInclude', sweepId: t.sweepId })} title="Use in refits" /> {t.label}</label>
            <button onClick={() => dispatch({ type: 'applySweepState', sweepId: t.sweepId })} title="Set the circuit to the build this sweep was taken on">Set circuit</button>
            <button onClick={() => dispatch({ type: 'retagSweep', sweepId: t.sweepId })} title="This sweep was taken on the circuit as it is now">Re-tag</button>
            <button className="marker-remove" onClick={() => dispatch({ type: 'removeSweep', sweepId: t.sweepId })} aria-label={`Remove ${t.label}`}>×</button>
            <small className="sweep-tag">{tagSummary(state.chain, t.state)}</small>
          </div>
        ))}
      </div>
      <label className="check-row"><input type="radio" name="active-sweep" checked={state.activeSweep === null} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: null })} /> Show no sweep</label>
    </div>
  );
}
```

Then:
- In `src/app/state.ts`, delete `view: 'physical' | 'symbol';` from `AppState`, the `setView` action, its reducer case, and `view: 'physical',` in `emptyState()`.
- In `src/app/example.ts`, delete `view: 'physical',`.
- Run `git rm src/ui/CircuitStrip.tsx src/ui/BlockArt.tsx src/ui/LandingStrip.tsx`.

- [ ] **Step 6: Rewrite `src/ui/app.css`**

Keep only rules still used and add the shell's.

```css
/* RF Network Modeller additions on top of the NanoVNA Web stylesheet (nanovna.css is a verbatim copy; never edit it). */
.title-select { display: flex; align-items: center; gap: 5px; font-size: 10px; letter-spacing: .03em; }
.form-row { display: grid; grid-template-columns: 1fr 1.1fr; gap: 6px; align-items: center; margin-bottom: 5px; }
.form-row input, .form-row select { width: 100%; text-align: right; }
.inspector-body { margin-top: 8px; }
.param-row { display: grid; grid-template-columns: 1fr 1fr 26px auto 36px; gap: 4px; align-items: center; margin-bottom: 5px; }
.param-row input { width: 100%; text-align: right; }
.free-toggle { display: flex; align-items: center; gap: 2px; font-size: 10px; }
.free-toggle input { min-height: 0; margin: 0; }
.badge { padding: 1px 4px; border-radius: 2px; font-size: 8px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; }
.badge.fit { background: #d9f2dc; color: #0b6b1d; }
.badge.est { background: #fde9c4; color: #8a5a00; }
.badge.typed { background: #e3e3e0; color: #555; }
.ok { color: #067723; }
.bad { color: #a11414; }
.warn-text { color: #8a5a00; }
.sweep-list { display: grid; gap: 4px; margin: 6px 0; }
.sweep-row { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto auto 27px; gap: 4px; align-items: center; padding: 3px; border-radius: 3px; }
.sweep-row.active { background: rgba(241,213,28,.17); }
.sweep-row input { min-height: 0; margin: 0; }
.sweep-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sweep-tag { grid-column: 2 / -1; margin-top: 0; }
.stock-grid { display: grid; grid-template-columns: auto 1fr auto auto; gap: 4px 8px; align-items: center; }
.stock-grid input { width: 100%; text-align: right; }
.topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.topbar-left span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.save-status { font-size: 10px; letter-spacing: .03em; }
.save-status.failed { color: #a11414; font-weight: 800; }
.notice { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 8px; padding: 6px 10px; border: 1px solid var(--edge); border-left: 4px solid var(--yellow); border-radius: 3px; background: var(--surface); }
.home { max-width: 980px; margin: 24px auto; padding: 0 16px; }
.home h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.tile { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-height: 96px; padding: 12px; font-weight: 400; text-align: left; }
.tile b { font-size: 14px; }
.tile span { color: #555; font-size: 12px; }
.tile em { margin-top: auto; color: #777; font-size: 10px; font-style: normal; letter-spacing: .06em; text-transform: uppercase; }
.workbench { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr); gap: 8px; padding: 8px; align-items: start; }
.wb-main, .wb-side { display: grid; gap: 8px; min-width: 0; }
@media (max-width: 960px) { .workbench { grid-template-columns: 1fr; } }
.panel { min-width: 0; padding: 8px 10px; border: 1px solid var(--edge); border-radius: 6px; background: var(--surface); }
.panel-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.panel-head h3 { margin: 0; font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.plots { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 8px; margin-bottom: 8px; }
.numbers { width: 100%; margin-top: 8px; border-collapse: collapse; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10px; }
.numbers th, .numbers td { padding: 3px 6px; border-bottom: 1px solid var(--edge); text-align: left; }
.swatch { display: inline-block; width: 12px; height: 3px; margin-right: 5px; vertical-align: middle; }
.sheet-backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.25); }
.sheet { position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100vw); overflow: auto; padding: 10px; border-left: 1px solid var(--edge); background: var(--surface-high); box-shadow: -6px 0 18px rgba(0,0,0,.2); }
.sheet > header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
html[data-theme='dark'] .badge.typed { background: #45464a; color: #d0d0cb; }
html[data-theme='dark'] .badge.fit { background: #1f4a28; color: #a9e7b4; }
html[data-theme='dark'] .badge.est { background: #4d3a12; color: #f3cf86; }
html[data-theme='dark'] .bad { color: #ff8a80; }
html[data-theme='dark'] .ok { color: #8be39b; }
html[data-theme='dark'] .tile span { color: #c7c7c2; }
html[data-theme='dark'] .panel, html[data-theme='dark'] .notice, html[data-theme='dark'] .sheet { border-color: #111214; background: #2c2d30; }
```

- [ ] **Step 7: Verify: tests, typecheck, build, then the browser gate**

Run: `npm test && npm run build`
Expected: PASS. The build is clean with no reference to the deleted files.

Browser gate. Use the dev server on port 5181; if it is not running, start it with `npm run dev`. Read every screenshot yourself.
1. **Home:** open `http://localhost:5181`. Home shows five tiles; only "I measured a new sweep" is enabled, and the others say "coming next". The console has no errors.
2. **Level persists:** set the level to Engineer and reload; it is still Engineer.
3. **Workbench:** open "I measured a new sweep". The four plots, the Z table and the fitted-values table render. "Imported (no flag)" shows under Settled?
4. **Autosave:** within about 2 s the top bar reads "Saved ✓". Open **Parts on hand**, set 100 pF on hand to 9, reload, and confirm 9 persisted. Set it back to 10.
5. **Sweeps sheet:** it lists the five tagged sweeps, each with a Re-tag button. At Beginner the Sweeps button is hidden.
6. **Fallback (Review Focus 1):** in the browser console, run the snippet below, then reload. Expected: the notice "Couldn't reopen your saved project (This file isn't a modeller project: it is not valid JSON). Showing the O7 example instead." and the O7 example loaded, with no blank screen.

```js
indexedDB.open('rf-network-modeller').onsuccess = (e) => {
  const db = e.target.result;
  const t = db.transaction('meta', 'readonly');
  t.objectStore('meta').get('current').onsuccess = (r) => {
    db.transaction('projects', 'readwrite').objectStore('projects').put({ id: r.target.result, name: 'x', savedAt: 'x', json: '{bad' });
  };
};
```

7. **Save and open:** Save project triggers a download. That can't be observed in the pane, so it is covered by Task 8's round-trip test. Record that in the ledger.

- [ ] **Step 8: Commit**

```bash
git add -A src/ui src/project/store.ts src/app/state.ts src/app/example.ts
git commit -m "feat(ui): home, top bar, sheets, autosave and project files; drop the 2a three-column layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The three circuit drawings

**Visual work:** the geometry and grouping are unit-tested (Tasks 6 and 7). The rendering's gate is the browser check in Step 4.

**Files:**
- Create: `src/ui/drawing/symbols.tsx`, `src/ui/drawing/SchematicView.tsx`, `src/ui/drawing/HardwareView.tsx`, `src/ui/drawing/FlowView.tsx`, `src/ui/drawing/Drawing.tsx`
- Rewrite: `src/ui/Workbench.tsx`
- Modify: `src/ui/app.css` (append the drawing rules)

**Interfaces:**
- Consumes: `layoutChain`, `PartBox`, `Layout`, `Pt`, `BOX` (Task 6); `stagesOf`, `stageTitle`, `Stage` (Task 7); `Tone`, `verdictOf`, `combine`, `representative`, `verdictText`, `toneOf`, `UNKNOWN` (Task 3).
- Produces, in `symbols.tsx`:
  - `interface DrawingProps { chain: Chain; selected: string | null; highlight: readonly string[]; onSelect: (id: string) => void; cableM: number }`;
  - `S = 46` (px per grid unit);
  - `partValue(b: Block, cableM: number): string`.
- Produces, in `Drawing.tsx`: `Drawing(props: DrawingProps & { kind: DrawingKind; tuner: { text: string; tone: Tone } })`.
- **Drawings receive the chosen assumption's chain** (`variantChain(state, state.primary)`), so the shown inductances are the fitted values.

- [ ] **Step 1: Write `src/ui/drawing/symbols.tsx`**

```tsx
import type { ReactNode } from 'react';
import { partTotal } from '../../blocks/ht50.ts';
import type { Block, Chain } from '../../chain/types.ts';
import { blockSummary } from '../../app/units.ts';
import { BOX, type Layout, type PartBox, type Pt } from '../../present/layout.ts';

export interface DrawingProps { chain: Chain; selected: string | null; highlight: readonly string[]; onSelect: (id: string) => void; cableM: number }

/** px per grid unit; HALF is half a part box's length in px. */
export const S = 46;
const HALF = (BOX * S) / 2;
export const COPPER = '#c97a3a';

/** A part's local frame: it runs along +x centred on (0, 0); vertical parts are rotated 90°. */
export const frame = (p: PartBox): string => `translate(${(p.x + p.w / 2) * S} ${(p.y + p.h / 2) * S}) rotate(${p.dir === 'v' ? 90 : 0})`;
export const viewBox = (l: Layout): string => `${l.minX * S - 60} ${l.minY * S - 46} ${(l.maxX - l.minX) * S + 210} ${(l.maxY - l.minY) * S + 106}`;
export const groundPath = (g: Pt): string => {
  const x = g.x * S;
  const y = g.y * S;
  return `M${x - 12} ${y} H${x + 12} M${x - 8} ${y + 5} H${x + 8} M${x - 4} ${y + 10} H${x + 4}`;
};
/** Value text under a part; a coax says its length, never "variant" (spec §11). */
export const partValue = (b: Block, cableM: number): string => (b.type === 'coax' ? `${cableM} m cable` : blockSummary(b));

export function schematicSymbol(p: PartBox): ReactNode {
  const L = HALF;
  switch (p.kind) {
    case 'capBank':
    case 'C':
      return <path className="sym" d={`M${-L} 0 H-4 M4 0 H${L} M-4 -13 V13 M4 -13 V13`} />;
    case 'inductor':
    case 'L':
      return <path className="sym" d={`M${-L} 0 H-20 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 H${L}`} />;
    case 'R':
      return <path className="sym" d={`M${-L} 0 H-18 l3 -7 l6 14 l6 -14 l6 14 l6 -14 l6 14 l3 -7 H${L}`} />;
    case 'wire':
    case 'short':
      return <path className="sym" d={`M${-L} 0 H${L}`} />;
    case 'coax':
      return <g><path d={`M${-L} 0 H${L}`} stroke="#8a8a8e" strokeWidth={7} /><path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={2} /></g>;
    case 'stack':
    case 'ideal':
      return (
        <g className="sym">
          <path d={`M${-L} 0 H-18 V-15 H-12 M${L} 0 H18 V-15 H12`} />
          <path d="M-12 -15 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 M12 -15 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10" />
          <path d="M-3 -17 V17 M3 -17 V17" />
          <path d="M-12 15 H-18 V22 M-24 22 H-12 M-21 26 H-15 M12 15 H18 V22 M12 22 H24 M15 26 H21" />
        </g>
      );
    case 'measured':
      return (
        <g className="sym">
          <path d={`M${-L} 0 H-16 M16 0 H${L}`} />
          <rect x={-16} y={-14} width={32} height={28} rx={3} strokeDasharray="4 3" />
          <path d="M-6 -8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 M6 -8 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 M0 -9 V9" />
        </g>
      );
    case 'plates':
      return <g><path className="sym" d={`M${-L} 0 H-6 M6 0 H${L}`} /><path d="M-6 -14 V14 M6 -14 V14" stroke={COPPER} strokeWidth={4} /><rect x={-3} y={-3} width={6} height={6} className="cube" /></g>;
  }
}

export function hardwareSymbol(p: PartBox, b: Block | undefined): ReactNode {
  const L = HALF;
  const lead = (inner: number): ReactNode => <path d={`M${-L} 0 H${-inner} M${inner} 0 H${L}`} stroke={COPPER} strokeWidth={5} />;
  switch (p.kind) {
    case 'wire':
    case 'inductor':
    case 'L':
    case 'short':
      return <path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={5} strokeLinecap="round" />;
    case 'coax':
      return <g><path d={`M${-L} 0 H${L}`} stroke="#8a8a8e" strokeWidth={8} /><path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={2} /></g>;
    case 'capBank':
    case 'C': {
      const n = b?.type === 'capBank' ? Math.min(4, Math.max(1, partTotal(b.counts))) : 1;
      const h = n * 11;
      return (
        <g>
          {lead(L - 5)}
          <rect x={-L + 4} y={-h / 2} width={4} height={h} fill={COPPER} />
          <rect x={L - 8} y={-h / 2} width={4} height={h} fill={COPPER} />
          {Array.from({ length: n }, (_, i) => <rect key={i} x={-L + 10} y={-h / 2 + i * 11 + 1.5} width={2 * L - 20} height={8} rx={3} className="puck" />)}
        </g>
      );
    }
    case 'R':
      return <g>{lead(14)}<rect x={-14} y={-6} width={28} height={12} rx={3} fill="#8a5a2b" /></g>;
    case 'stack':
      return <g>{lead(16)}<rect x={-15} y={-20} width={12} height={40} rx={3} className="ferrite" /><rect x={3} y={-20} width={12} height={40} rx={3} className="ferrite" /><path d="M-18 -8 H18 M-18 0 H18 M-18 8 H18" stroke={COPPER} strokeWidth={2} /></g>;
    case 'ideal':
      return <g>{lead(10)}<rect x={-8} y={-20} width={16} height={40} rx={3} className="ferrite" /><path d="M-12 -8 H12 M-12 0 H12 M-12 8 H12" stroke={COPPER} strokeWidth={2} /></g>;
    case 'measured':
      return <g>{lead(20)}<rect x={-20} y={-20} width={40} height={40} rx={4} className="dashed" /><rect x={-15} y={-14} width={10} height={28} rx={2} className="ferrite" /><path d="M3 -14 V14 M13 -14 V14" stroke={COPPER} strokeWidth={4} /><rect x={5} y={-4} width={6} height={8} className="cube" /></g>;
    case 'plates':
      return <g>{lead(10)}<path d="M-10 -20 V20 M10 -20 V20" stroke={COPPER} strokeWidth={5} /><rect x={-7} y={-12} width={14} height={24} className="bed" /><rect x={-4} y={-4} width={8} height={8} className="cube" /></g>;
  }
}

/** Name above (horizontal parts) or to the right (vertical parts), value below or under the name. */
export function PartLabel({ p, title, value }: { p: PartBox; title: string; value: string }) {
  const cx = (p.x + p.w / 2) * S;
  const cy = (p.y + p.h / 2) * S;
  if (p.dir === 'h') {
    return <g><text x={cx} y={p.y * S - 6} textAnchor="middle" className="t">{title}</text><text x={cx} y={(p.y + p.h) * S + 13} textAnchor="middle" className="s">{value}</text></g>;
  }
  return <g><text x={(p.x + p.w) * S + 6} y={cy - 3} className="t">{title}</text><text x={(p.x + p.w) * S + 6} y={cy + 11} className="s">{value}</text></g>;
}
```

- [ ] **Step 2: Write the four views**

```tsx
// src/ui/drawing/SchematicView.tsx
import { useMemo } from 'react';
import { findBlock } from '../../chain/state.ts';
import { layoutChain } from '../../present/layout.ts';
import { type DrawingProps, PartLabel, S, frame, groundPath, partValue, schematicSymbol, viewBox } from './symbols.tsx';

/** Engineer drawing: a wired schematic with plain labels (spec §6.1). */
export function SchematicView({ chain, selected, highlight, onSelect, cableM }: DrawingProps) {
  const l = useMemo(() => layoutChain(chain), [chain]);
  return (
    <svg className="drawing" viewBox={viewBox(l)} role="img" aria-label="Circuit schematic">
      {l.wires.map((w, i) => <line key={i} x1={w.a.x * S} y1={w.a.y * S} x2={w.b.x * S} y2={w.b.y * S} className="sym" />)}
      {l.junctions.map((j, i) => <circle key={i} cx={j.x * S} cy={j.y * S} r={4} className="dot" />)}
      {l.grounds.map((g, i) => <path key={i} d={groundPath(g)} className="sym" />)}
      <circle cx={l.port.x * S - 10} cy={l.port.y * S} r={8} className="sym" />
      <text x={l.port.x * S - 10} y={l.port.y * S - 16} textAnchor="middle" className="t">Tuner</text>
      {l.parts.map((p) => {
        const b = findBlock(chain, p.id);
        return (
          <g key={p.id} className={`part${selected === p.id ? ' selected' : ''}${highlight.includes(p.id) ? ' highlight' : ''}`} onClick={() => onSelect(p.id)} role="button" aria-label={b?.label ?? p.id}>
            <rect x={p.x * S - 4} y={p.y * S - 4} width={p.w * S + 8} height={p.h * S + 8} className="hit" />
            <g transform={frame(p)}>{schematicSymbol(p)}</g>
            <PartLabel p={p} title={b?.label ?? p.id} value={b ? partValue(b, cableM) : ''} />
          </g>
        );
      })}
    </svg>
  );
}
```

```tsx
// src/ui/drawing/HardwareView.tsx
import { useMemo } from 'react';
import { findBlock } from '../../chain/state.ts';
import { layoutChain } from '../../present/layout.ts';
import { COPPER, type DrawingProps, PartLabel, S, frame, hardwareSymbol, partValue } from './symbols.tsx';

/** Builder drawing: the cage side view; every ground drops to the cage floor (spec §6.1). */
export function HardwareView({ chain, selected, highlight, onSelect, cableM }: DrawingProps) {
  const l = useMemo(() => layoutChain(chain), [chain]);
  const top = l.minY * S - 44;
  const floor = (l.maxY + 1) * S;
  const left = l.minX * S - 24;
  const right = l.maxX * S + 150;
  const py = l.port.y * S;
  return (
    <svg className="drawing" viewBox={`${left - 190} ${top - 6} ${right - left + 200} ${floor - top + 26}`} role="img" aria-label="Circuit hardware view">
      <rect x={left} y={top} width={right - left} height={floor - top} className="cage" />
      <text x={left + 6} y={top + 14} className="s">Faraday cage (its walls and floor are ground)</text>
      <line x1={left} y1={floor} x2={right} y2={floor} className="floor" />
      <rect x={left - 170} y={py - 30} width={100} height={60} rx={6} className="genbox" />
      <text x={left - 120} y={py - 4} textAnchor="middle" className="t">Generator</text>
      <text x={left - 120} y={py + 12} textAnchor="middle" className="s">+ auto-tuner</text>
      <line x1={left - 70} y1={py} x2={l.port.x * S} y2={py} stroke={COPPER} strokeWidth={5} />
      {l.wires.map((w, i) => <line key={i} x1={w.a.x * S} y1={w.a.y * S} x2={w.b.x * S} y2={w.b.y * S} stroke={COPPER} strokeWidth={5} strokeLinecap="round" />)}
      {l.grounds.map((g, i) => <line key={i} x1={g.x * S} y1={g.y * S} x2={g.x * S} y2={floor} stroke={COPPER} strokeWidth={5} />)}
      {l.junctions.map((j, i) => <circle key={i} cx={j.x * S} cy={j.y * S} r={5} fill={COPPER} />)}
      {l.parts.map((p) => {
        const b = findBlock(chain, p.id);
        return (
          <g key={p.id} className={`part${selected === p.id ? ' selected' : ''}${highlight.includes(p.id) ? ' highlight' : ''}`} onClick={() => onSelect(p.id)} role="button" aria-label={b?.label ?? p.id}>
            <rect x={p.x * S - 4} y={p.y * S - 4} width={p.w * S + 8} height={p.h * S + 8} className="hit" />
            <g transform={frame(p)}>{hardwareSymbol(p, b)}</g>
            <PartLabel p={p} title={b?.label ?? p.id} value={b ? partValue(b, cableM) : ''} />
          </g>
        );
      })}
    </svg>
  );
}
```

```tsx
// src/ui/drawing/FlowView.tsx
import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { countsPf } from '../../blocks/ht50.ts';
import { findBlock } from '../../chain/state.ts';
import { type Stage, type StageKind, stageTitle, stagesOf } from '../../present/stages.ts';
import type { Tone } from '../../present/verdict.ts';
import { COPPER, type DrawingProps, partValue } from './symbols.tsx';

const ICON: Record<StageKind, ReactNode> = {
  generator: <path className="sym" d="M6 20 q8 -14 16 0 t16 0 t16 0" />,
  tuner: <><circle cx="30" cy="20" r="13" className="sym" /><path className="sym" d="M30 20 L39 11" /></>,
  cable: <><path d="M6 26 c8 -22 16 22 24 0 s16 -22 24 -6" stroke="#8a8a8e" strokeWidth="6" fill="none" /><path d="M6 26 c8 -22 16 22 24 0 s16 -22 24 -6" stroke={COPPER} strokeWidth="2" fill="none" /></>,
  matching: <path className="sym" d="M6 12 H22 M22 4 V20 M28 4 V20 M28 12 H54 M40 12 V24 M32 24 H48 M32 29 H48 M40 29 V38" />,
  transformer: <><path className="sym" d="M22 4 v4 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 v4 M38 4 v4 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 v4" /><path className="sym" d="M28 4 V36 M32 4 V36" /></>,
  plates: <><path d="M14 8 H46 M14 32 H46" stroke={COPPER} strokeWidth="4" /><rect x="22" y="13" width="16" height="14" className="bed" /><rect x="26" y="16" width="8" height="8" className="cube" /></>,
};

/** Beginner drawing: the rig as stages; a stage opens to list its parts (spec §6.2). */
export function FlowView({ chain, selected, highlight, onSelect, cableM, tuner }: DrawingProps & { tuner: { text: string; tone: Tone } }) {
  const stages = useMemo(() => stagesOf(chain), [chain]);
  const [open, setOpen] = useState<StageKind>('matching');
  const line = (s: Stage): string => {
    const blocks = s.blockIds.map((id) => findBlock(chain, id));
    switch (s.kind) {
      case 'generator':
        return '13.56 MHz';
      case 'tuner':
        return 'fixes small errors';
      case 'cable':
        return `${cableM} m coax`;
      case 'matching': {
        const banks = blocks.flatMap((b) => (b?.type === 'capBank' ? [`${b.label.replace(/ bank$/i, '')} ${(countsPf(b.counts) + b.customPf) / b.nSeries} pF`] : []));
        return banks.join(' · ') || `${s.blockIds.length} parts`;
      }
      case 'transformer':
        return blocks.flatMap((b) => (b && (b.type === 'stack' || b.type === 'ideal' || b.type === 'measuredBranch') ? [b.label] : [])).join(', ');
      case 'plates':
        return 'where the heat goes';
    }
  };
  const shown = stages.find((s) => s.kind === open && s.blockIds.length > 0);
  return (
    <div className="flow">
      <div className={`tuner-tag ${tuner.tone}`}>{tuner.text}</div>
      <div className="flow-row">
        {stages.map((s, i) => (
          <Fragment key={s.kind}>
            {i ? <span className="flow-arrow" aria-hidden="true">→</span> : null}
            <button className={`stage${open === s.kind ? ' open' : ''}${s.blockIds.some((id) => highlight.includes(id)) ? ' highlight' : ''}`} disabled={!s.blockIds.length} onClick={() => setOpen(s.kind)}>
              <svg viewBox="0 0 60 40" className="stage-icon" aria-hidden="true">{ICON[s.kind]}</svg>
              <b>{stageTitle(s)}</b>
              <small>{line(s)}</small>
            </button>
          </Fragment>
        ))}
      </div>
      {shown ? (
        <div className="stage-parts">
          <small>Parts in the {stageTitle(shown).toLowerCase()}:</small>
          {shown.blockIds.map((id) => {
            const b = findBlock(chain, id);
            return <button key={id} className={selected === id ? 'selected' : ''} onClick={() => onSelect(id)}><b>{b?.label ?? id}</b> <span>{b ? partValue(b, cableM) : ''}</span></button>;
          })}
        </div>
      ) : null}
    </div>
  );
}
```

```tsx
// src/ui/drawing/Drawing.tsx
import type { DrawingKind } from '../../present/level.ts';
import type { Tone } from '../../present/verdict.ts';
import { FlowView } from './FlowView.tsx';
import { HardwareView } from './HardwareView.tsx';
import { SchematicView } from './SchematicView.tsx';
import type { DrawingProps } from './symbols.tsx';

export function Drawing({ kind, tuner, ...p }: DrawingProps & { kind: DrawingKind; tuner: { text: string; tone: Tone } }) {
  if (kind === 'flow') return <FlowView {...p} tuner={tuner} />;
  if (kind === 'hardware') return <HardwareView {...p} />;
  return <SchematicView {...p} />;
}
```

- [ ] **Step 3: Rewrite `src/ui/Workbench.tsx` with the drawing panel, and append CSS**

```tsx
import { type Dispatch, useEffect, useMemo, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { VariantResult } from '../app/evaluate.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { DRAWING_LABEL, type DrawingKind, type Level, PROFILES } from '../present/level.ts';
import { UNKNOWN, combine, representative, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { Drawing } from './drawing/Drawing.tsx';
import { EngineerPanel } from './EngineerPanel.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

const DRAWINGS: readonly DrawingKind[] = ['flow', 'hardware', 'schematic'];

export function Workbench({ state, dispatch, level, grid, results, theme }: WorkbenchProps) {
  const [drawing, setDrawing] = useState<DrawingKind | null>(null);
  useEffect(() => { setDrawing(null); }, [level]);
  const view = useMemo(() => variantChain(state, state.primary), [state]);
  const verdicts = results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, state.window)));
  const combined = combine(verdicts.map((v) => v.state));
  const rep = representative(verdicts, state.primary, combined.state);
  const dKind = drawing ?? PROFILES[level].drawing;
  const clamped = results.some((r) => r.outOfRange);
  return (
    <main className="workbench">
      <div className="wb-main">
        <section className="panel">
          <header className="panel-head">
            <h3>Your circuit{dKind === 'flow' ? '' : ': click any part to change it'}</h3>
            <label className="override">Drawing <select value={dKind} onChange={(e) => setDrawing(e.target.value as DrawingKind)}>{DRAWINGS.map((k) => <option key={k} value={k}>{DRAWING_LABEL[k]}</option>)}</select></label>
          </header>
          <Drawing kind={dKind} chain={view} selected={state.selected} highlight={[]} onSelect={(id) => dispatch({ type: 'select', id })} cableM={state.variants[state.primary].cable.length} tuner={{ text: verdictText(rep, 'beginner'), tone: toneOf(rep.state) }} />
        </section>
        <section className="panel">
          <header className="panel-head"><h3>Where the tuner lands at 13.56 MHz</h3></header>
          <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} />
          {clamped ? <small className="warn-text">The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side" />
    </main>
  );
}
```

Append to `src/ui/app.css`:

```css
.override { display: flex; align-items: center; gap: 4px; font-size: 10px; }
.drawing { display: block; width: 100%; height: auto; max-height: 470px; color: #2c2c2a; }
.drawing text { fill: currentColor; font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; }
.drawing .t { font-size: 11px; font-weight: 700; }
.drawing .s { font-size: 10px; opacity: .75; }
.drawing .sym { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.drawing .dot { fill: currentColor; }
.drawing .hit { fill: transparent; stroke: none; }
.drawing .part { cursor: pointer; }
.drawing .part.selected .hit { stroke: #f1d51c; stroke-width: 3; }
.drawing .part.highlight .hit { stroke: #f1d51c; stroke-width: 2; stroke-dasharray: 5 3; }
.drawing .puck { fill: #3b6fb6; stroke: #2a4f86; }
.drawing .ferrite { fill: #5a5a5e; stroke: #3a3a3e; }
.drawing .bed, .stage-icon .bed { fill: #d8c8a0; opacity: .8; }
.drawing .cube, .stage-icon .cube { fill: #4a4a48; }
.drawing .dashed { fill: none; stroke: currentColor; stroke-dasharray: 4 3; }
.drawing .cage { fill: none; stroke: currentColor; stroke-dasharray: 6 4; opacity: .5; }
.drawing .floor { stroke: #8a8a8e; stroke-width: 4; }
.drawing .genbox { fill: rgba(127,127,120,.12); stroke: currentColor; opacity: .8; }
.flow { display: grid; gap: 8px; }
.flow-row { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px; }
.flow-arrow { align-self: center; color: #777; }
.stage { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 112px; padding: 6px; font-weight: 400; }
.stage b { font-size: 11px; text-align: center; }
.stage small { color: #555; font-size: 10px; text-align: center; }
.stage.open { border-color: #aa9710; box-shadow: 0 0 0 2px rgba(241,213,28,.55); }
.stage.highlight { outline: 2px dashed #f1d51c; }
.stage-icon { width: 60px; height: 40px; color: #2c2c2a; }
.stage-icon .sym { fill: none; stroke: currentColor; stroke-width: 2; }
.stage-parts { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.stage-parts button.selected { border-color: #aa9710; box-shadow: 0 0 0 2px rgba(241,213,28,.55); }
.tuner-tag { justify-self: start; padding: 4px 10px; border: 1px solid #aaa; border-radius: 12px; font-size: 11px; font-weight: 700; }
.tuner-tag.good { border-color: #34c759; color: #067723; }
.tuner-tag.warn { border-color: #ff9f0a; color: #8a5a00; }
.tuner-tag.bad { border-color: #ff3b30; color: #a11414; }
.tuner-tag.unknown { color: #666; }
html[data-theme='dark'] .drawing, html[data-theme='dark'] .stage-icon { color: #d6d6d0; }
html[data-theme='dark'] .stage small { color: #c7c7c2; }
```

- [ ] **Step 4: Verify: tests, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate at `http://localhost:5181` → "I measured a new sweep". Read each screenshot yourself.
1. **Engineer (schematic):** every O7 part is wired; one junction dot; a ground symbol under the shunt bank and at the line's end; labels read "Wiring inductance · 586.8 nH" (fitted) and "Transformer pair + plates · measured, loop on". No label overlaps another.
2. **Builder (hardware):** the cage, the cage floor, every ground dropping to the floor, cap pucks (2 in series, 3 in shunt), copper straps. The coax reads "1.245 m cable".
3. **Beginner (flow):**
   - stages Generator → Auto-tuner → Cable → Matching box → Transformer + plates (measured together);
   - the matching box reads "Series 80 pF · Shunt 180 pF";
   - clicking Matching box lists its three parts; the tuner tag shows a verdict.
4. **Selection:** clicking a part in each drawing outlines it in yellow.
5. **Drawing override:** switching it changes only the drawing; changing the level resets it.
6. **Fixing overlaps:** if labels overlap, fix them by raising `PITCH` in `layout.ts` (the tests depend only on the properties, not the value) and record a `Ruling:` with the value used.

- [ ] **Step 5: Commit**

```bash
git add src/ui/drawing src/ui/Workbench.tsx src/ui/app.css
git commit -m "feat(ui): power-flow, hardware and schematic drawings of the same circuit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The part editor by level

**UI-only:** the gate is the browser check in Step 3. Field logic is the 2a Inspector's, unchanged except for the level filter.

**Files:**
- Rename: `git mv src/ui/Inspector.tsx src/ui/PartEditor.tsx`, then rewrite it as below
- Modify: `src/ui/ParamField.tsx` (gains `showFree`), `src/ui/Workbench.tsx` (side column shows the editor), `src/ui/app.css`

**Interfaces:**
- Produces: `PartEditor({ state, dispatch, level }: { state: AppState; dispatch: Dispatch<Action>; level: Level })`. It returns `null` when nothing is selected.

- [ ] **Step 1: Rewrite `src/ui/PartEditor.tsx`**

```tsx
import type { Dispatch, ReactNode } from 'react';
import { CAP_VALUES, physicalParts, stockLeft, sumCounts } from '../blocks/ht50.ts';
import { type Design, estimateUnit } from '../blocks/design.ts';
import { estimateWire } from '../blocks/wire.ts';
import { allBlocks, findBlock } from '../chain/state.ts';
import { type Block, type CapBankBlock, type Param, param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary, designEquals } from '../app/units.ts';
import { type FieldSet, type Level, PROFILES } from '../present/level.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';
import { ParamField } from './ParamField.tsx';

type Num = (label: string, value: number, onCommit: (v: number) => void, attrs?: { min?: string; step?: string }) => ReactNode;
type Field = (k: ParamKey, label: string) => ReactNode;
type Patch = (p: Record<string, unknown>) => void;

const PRIMITIVE_DEFAULT: Record<'R' | 'L' | 'C' | 'short', Param> = {
  R: param(50),
  L: param(100e-9, 'typed', false, 1e-9, 10e-6),
  C: param(100e-12, 'typed', false, 1e-12, 10e-9),
  short: param(0),
};

const readOnly = (b: Block): ReactNode => <small key="ro">{blockSummary(b)}. Switch to Builder level to change it.</small>;

/** Fields by level (spec §5): Beginner edits stock picks and the loop; Builder adds physical values; Engineer sees everything. */
function fields(b: Block, s: AppState, num: Num, field: Field, patch: Patch, set: FieldSet): ReactNode[] {
  const phys = set !== 'stock';
  const all = set === 'all';
  switch (b.type) {
    case 'capBank':
      return [
        ...CAP_VALUES.map((v) => num(`${v} pF parts`, b.counts[v], (n) => patch({ counts: { ...b.counts, [v]: Math.max(0, Math.round(n)) } }), { min: '0', step: '1' })),
        ...(phys ? [
          num('Custom pF (per group)', b.customPf, (n) => patch({ customPf: Math.max(0, n) }), { min: '0' }),
          <div className="form-row" key="ns"><label>Groups in series</label><select value={b.nSeries} onChange={(e) => patch({ nSeries: e.target.value === '2' ? 2 : 1 })}><option value={1}>1</option><option value={2}>2</option></select></div>,
        ] : []),
        ...(all ? [
          num('Slots in this bank', b.slots, (n) => patch({ slots: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
          field('k', 'Cap scale k'),
          num('ESR (Ω)', b.esr, (n) => patch({ esr: Math.max(0, n) }), { min: '0' }),
          <label className="check-row" key="search"><input type="checkbox" checked={b.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> Suggestions may change this bank</label>,
        ] : []),
      ];
    case 'inductor':
      if (!phys) return [readOnly(b)];
      return [field('L', 'Inductance'), ...(all ? [num('Series R (Ω)', b.R, (n) => patch({ R: Math.max(0, n) }), { min: '0' })] : [])];
    case 'wire': {
      if (!phys) return [readOnly(b)];
      const e = estimateWire(b.lengthMm, b.awg, b.strands, 13.56e6);
      return [
        num('Length (mm)', b.lengthMm, (n) => patch({ lengthMm: Math.max(0, n) }), { min: '0' }),
        num('AWG', b.awg, (n) => patch({ awg: Math.round(n) }), { step: '1' }),
        num('Strands', b.strands, (n) => patch({ strands: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <small key="est">At 13.56 MHz: L ≈ {(e.L * 1e9).toFixed(1)} nH, R ≈ {(e.R * 1e3).toFixed(1)} mΩ <span className="badge est">est</span></small>,
      ];
    }
    case 'measuredBranch':
      return [
        <label className="check-row" key="loop"><input type="checkbox" checked={b.loop} onChange={(e) => patch({ loop: e.target.checked })} /> Sense loop installed</label>,
        ...(phys ? [<div className="form-row" key="sw"><label>Measured with</label><select value={b.sweepId} onChange={(e) => patch({ sweepId: e.target.value })}>{Object.values(s.sweeps).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>] : []),
        ...(all ? [field('kr', 'Branch R scale'), field('d', 'Loop shift'), field('dLb', 'Loop ΔL')] : []),
      ];
    case 'stack': {
      if (!phys) return [readOnly(b)];
      const d: Design = b.design ?? { N_p: b.unit.N_p, N_s: Math.round(b.unit.n * b.unit.N_p), N_c: b.unit.N_c, strap: false };
      const set2 = (next: Design): void => {
        if (!designEquals(next, d)) patch({ design: next, unit: estimateUnit(next), source: 'estimate' }); // a no-change blur keeps a fitted model
      };
      const u = b.unit;
      return [
        num('Primary turns', d.N_p, (n) => set2({ ...d, N_p: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Secondary turns', d.N_s, (n) => set2({ ...d, N_s: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Cores (Material 67)', d.N_c, (n) => set2({ ...d, N_c: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <label className="check-row" key="strap"><input type="checkbox" checked={d.strap} onChange={(e) => set2({ ...d, strap: e.target.checked })} /> Strap primary</label>,
        ...(all ? [<small key="unit">Model <span className={`badge ${b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}`}>{b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}</span>: n {u.n.toFixed(3)}, L_leak {(u.L_leak * 1e6).toFixed(3)} µH, L_m {(u.L_m * 1e6).toFixed(3)} µH, R1 {u.R1.toFixed(3)} Ω, R2 {u.R2.toFixed(2)} Ω, C_w {(u.C_w * 1e12).toFixed(2)} pF. Changing turns or cores re-estimates it with the design.py scaling laws.</small>] : []),
      ];
    }
    case 'plates':
      if (!phys) return [readOnly(b)];
      return [field('C', 'Plate C'), ...(all ? [field('G_cube', 'Cube conductance'), field('G_fix', 'Fixture conductance')] : [])];
    case 'primitive':
      if (!all) return [readOnly(b)];
      return [
        <div className="form-row" key="kind"><label>Kind</label><select value={b.kind} onChange={(e) => { const k = e.target.value as 'R' | 'L' | 'C' | 'short'; patch({ kind: k, value: PRIMITIVE_DEFAULT[k] }); }}><option value="R">Resistor</option><option value="L">Inductor</option><option value="C">Capacitor</option><option value="short">Short</option></select></div>,
        ...(b.kind === 'short' ? [] : [field('value', 'Value')]),
      ];
    case 'ideal':
      if (!all) return [readOnly(b)];
      return [num('Turns ratio n (1:n)', b.n, (n) => patch({ n: n > 0 ? n : b.n }), { min: '0' })];
    case 'coax': {
      const c = s.variants[s.primary].cable;
      return [<small key="c">{all ? `Uses the chosen cable assumption: ${c.length} m, VF ${c.vf}, Z₀ ${c.z0} Ω, loss ${c.alpha13} Np.` : `${c.length} m of coax from the tuner.`}</small>];
    }
    case 'shunt':
      return [<small key="s">Everything inside runs from this point to ground.</small>];
    case 'parallel':
      return [<small key="p">{b.chains.length} paths between the same two points.</small>];
  }
}

function StockLine({ s }: { s: AppState }) {
  const used = sumCounts(allBlocks(s.chain.blocks).filter((x): x is CapBankBlock => x.type === 'capBank').map((x) => physicalParts(x)));
  const left = stockLeft(s.stock, used);
  return <small className={CAP_VALUES.some((v) => left[v] < 0) ? 'bad' : ''}>{CAP_VALUES.map((v) => `${v} pF: ${s.stock[v]} on hand, ${used[v]} in circuit, ${left[v]} left`).join(' · ')}</small>;
}

export function PartEditor({ state, dispatch, level }: { state: AppState; dispatch: Dispatch<Action>; level: Level }) {
  const set = PROFILES[level].fields;
  const b = state.selected ? findBlock(variantChain(state, state.primary), state.selected) : undefined;
  if (!b) return null;
  const patch: Patch = (p) => dispatch({ type: 'patchBlock', id: b.id, patch: p });
  const field: Field = (k, label) => (
    <ParamField key={k} block={b} k={k} label={label} param={(b as unknown as Record<string, Param>)[k]} showFree={set === 'all'}
      onValue={(v) => dispatch({ type: 'setParam', ref: { blockId: b.id, key: k }, value: v })}
      onFree={(free) => dispatch({ type: 'setFree', ref: { blockId: b.id, key: k }, free })} />
  );
  const num: Num = (label, value, onCommit, attrs = {}) => <div className="form-row" key={label}><label>{label}</label><DraftNumberInput step="any" {...attrs} value={value} onCommit={onCommit} /></div>;
  return (
    <section className="panel part-editor">
      <header className="panel-head"><h3>{b.label}</h3><button onClick={() => dispatch({ type: 'select', id: null })} aria-label="Close the part editor">×</button></header>
      {set !== 'stock' ? <div className="form-row"><label>Name</label><input value={b.label} onChange={(e) => patch({ label: e.target.value })} /></div> : null}
      <small>{blockSummary(b)}{PROFILES[level].nameAssumptions ? ` · values for ${state.variants[state.primary].name}` : ''}</small>
      <div className="inspector-body">{fields(b, state, num, field, patch, set)}</div>
      {b.type === 'capBank' ? <StockLine s={state} /> : null}
    </section>
  );
}
```

- [ ] **Step 2: Add `showFree` to `ParamField`, and show the editor in the Workbench**

In `src/ui/ParamField.tsx`:
- add `showFree = true` to the destructured props;
- add `showFree?: boolean` to the props type;
- wrap the `free-toggle` label as `{showFree ? <label className="free-toggle" …>…</label> : null}`.

In `src/ui/Workbench.tsx`:
- add `import { PartEditor } from './PartEditor.tsx';`;
- replace `<aside className="wb-side" />` with:

```tsx
      <aside className="wb-side">
        {state.selected ? <PartEditor state={state} dispatch={dispatch} level={level} /> : null}
      </aside>
```

Append to `src/ui/app.css`:

```css
.part-editor .inspector-body { margin-top: 6px; }
.check-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
```

- [ ] **Step 3: Verify: tests, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate (read each screenshot):
1. **Beginner:** clicking Matching box, then the series bank, shows only three part counts plus the stock line. The wiring inductance says "… Switch to Builder level to change it."
2. **Builder:** the series bank adds Custom pF and Groups in series. The wiring inductance shows its value, a FIT badge, and no fit toggle.
3. **Engineer:** every field, with fit toggles.
4. **Live edit:** setting the series 50 pF count to 0 updates the drawing (one fewer puck) and the plots immediately. The × closes the editor.

- [ ] **Step 4: Commit**

```bash
git add -A src/ui/PartEditor.tsx src/ui/Inspector.tsx src/ui/ParamField.tsx src/ui/Workbench.tsx src/ui/app.css
git commit -m "feat(ui): part editor that shows the fields each level needs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Result views — verdict card, target box, auto-ranged |S11|

**Files:**
- Modify: `src/app/plotmath.ts` (add `dbRange`, `TARGET`, `targetPos`), `src/app/plotmath.test.ts`, `src/ui/PlotPane.tsx` (the |S11| axis uses `dbRange`)
- Create: `src/ui/VerdictCard.tsx`, `src/ui/TargetBox.tsx`
- Rewrite: `src/ui/Workbench.tsx`
- Modify: `src/ui/app.css`

**Interfaces:**
- Produces:
  - `dbRange(values: number[]): [number, number]`;
  - `interface TargetAxes { rMax: number; xMax: number }`;
  - `TARGET: TargetAxes` (25 Ω, 60 Ω);
  - `targetPos(z: Complex, a?: TargetAxes): { u: number; v: number; pinned: boolean } | null`;
  - `VerdictCard({ text, tone, source, trustNote, state })`;
  - `TargetBox({ window, measured, measuredLabel, predicted, ghost })`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/plotmath.test.ts`. Add `dbRange` and `targetPos` to its import from `./plotmath.ts`, and import `cx` from `../engine/complex.ts` if it isn't already.

```ts
test('|S11| axis follows the data: 5 dB below the lowest value, between −60 and −5 dB; no data gives −5…0 (review focus 5)', () => {
  assert.deepEqual(dbRange([-0.3, -1.2]), [-10, 0]);
  assert.deepEqual(dbRange([-23]), [-30, 0]);
  assert.deepEqual(dbRange([-100]), [-60, 0]);
  assert.deepEqual(dbRange([Number.NaN, Number.NaN]), [-5, 0]);
  assert.deepEqual(dbRange([]), [-5, 0]);
});

test('target box positions are fractions of 25 Ω × 60 Ω, pinned to the edge beyond them, absent when not finite', () => {
  assert.deepEqual(targetPos(cx(12.5, 30)), { u: 0.5, v: 0.5, pinned: false });
  assert.deepEqual(targetPos(cx(715.8, 184.7)), { u: 1, v: 1, pinned: true });
  assert.deepEqual(targetPos(cx(5, -3)), { u: 0.2, v: 0, pinned: true });
  assert.equal(targetPos(cx(Number.POSITIVE_INFINITY, 0)), null);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --experimental-strip-types --test src/app/plotmath.test.ts`
Expected: FAIL. The error should be a SyntaxError saying `dbRange` (or `targetPos`) is not exported.

- [ ] **Step 3: Implement in `src/app/plotmath.ts`, then use `dbRange` in `PlotPane`**

```ts
/** |S11| axis: 0 dB down to 5 dB below the lowest finite value, rounded to 5 dB and kept within −60…−5 dB (no fixed −40 floor). */
export function dbRange(values: number[]): [number, number] {
  const lo = values.reduce((m, v) => (Number.isFinite(v) ? Math.min(m, v) : m), 0);
  return [Math.max(-60, Math.min(-5, Math.floor(lo / 5) * 5 - 5)), 0];
}

export interface TargetAxes { rMax: number; xMax: number }
/** The Builder target box spans R 0–25 Ω and X 0–60 Ω (spec §7.4). */
export const TARGET: TargetAxes = { rMax: 25, xMax: 60 };

/** z on the target box as fractions of its axes, pinned to the edge (pinned: true) beyond them; null when z is not finite. */
export function targetPos(z: Complex, a: TargetAxes = TARGET): { u: number; v: number; pinned: boolean } | null {
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return null;
  const u = z.re / a.rMax;
  const v = z.im / a.xMax;
  const cu = Math.min(1, Math.max(0, u));
  const cv = Math.min(1, Math.max(0, v));
  return { u: cu, v: cv, pinned: cu !== u || cv !== v };
}
```

In `src/ui/PlotPane.tsx`:
- add `dbRange` to the import from `../app/plotmath.ts`;
- in `drawRect`, after `for (const t of traces) push(t, p.mode, t.color);`, add:

```ts
    if (p.mode === 's11db') [min, max] = dbRange(lines.flatMap((l) => l.pts.map((q) => q.v)));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `VerdictCard.tsx` and `TargetBox.tsx`, rewrite `Workbench.tsx`, append CSS**

```tsx
// src/ui/VerdictCard.tsx
import type { Tone, VerdictState } from '../present/verdict.ts';

const NEXT: Record<VerdictState, string> = {
  unknown: 'Load a sweep in the guide, or fix the circuit, to get a verdict.',
  outside: 'The guide (step 4) lists changes you can make from your parts.',
  little: 'It works. The guide lists changes that would add room.',
  some: 'It works. Check the guide before changing anything.',
  plenty: 'It works with margin. Check the guide before changing anything.',
};

/** Beginner result: one plain verdict and one next step (spec §7.4). */
export function VerdictCard({ text, tone, source, trustNote, state }: { text: string; tone: Tone; source: 'measured' | 'predicted'; trustNote: string | null; state: VerdictState }) {
  return (
    <div className={`verdict-card ${tone}`}>
      <small>{source === 'measured' ? 'From your sweep' : 'Predicted by the model'}</small>
      <b>{text}</b>
      {source === 'predicted' && trustNote ? <small>{trustNote}</small> : null}
      <p>{NEXT[state]}</p>
    </div>
  );
}
```

```tsx
// src/ui/TargetBox.tsx
import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { TARGET, targetPos } from '../app/plotmath.ts';
import { WORDS } from '../present/words.ts';

const X0 = 44;
const Y0 = 186;
const PW = 246;
const PH = 168;
const X = (u: number): number => X0 + u * PW;
const Y = (v: number): number => Y0 - v * PH;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function Marker({ z, kind, label }: { z: Complex | null; kind: 'measured' | 'predicted' | 'ghost'; label: string }) {
  const t = z ? targetPos(z) : null;
  if (!t) return null;
  return (
    <g className={`mark ${kind}`}>
      <circle cx={X(t.u)} cy={Y(t.v)} r={6} fill={kind === 'measured' ? undefined : 'none'} strokeDasharray={kind === 'ghost' ? '3 2' : undefined} />
      <text x={X(t.u) + 10} y={Y(t.v) + 4}>{label}{t.pinned ? ' (off the scale)' : ''}</text>
    </g>
  );
}

/** Builder result: the tuner's window, your sweep's point and the model's (spec §7.4). */
export function TargetBox({ window: w, measured, measuredLabel, predicted, ghost }: { window: Window; measured: Complex | null; measuredLabel: string; predicted: Complex | null; ghost: Complex | null }) {
  const x1 = X(clamp01(w.rLo / TARGET.rMax));
  const x2 = X(clamp01(w.rHi / TARGET.rMax));
  const y1 = Y(clamp01(w.xHi / TARGET.xMax));
  const y2 = Y(clamp01(w.xLo / TARGET.xMax));
  return (
    <svg className="target" viewBox="0 0 310 214" role="img" aria-label={`${WORDS.landing} at 13.56 MHz`}>
      <line x1={X0} y1={Y0} x2={X(1)} y2={Y0} className="axis" />
      <line x1={X0} y1={Y0} x2={X0} y2={Y(1)} className="axis" />
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} className="win" />
      <text x={(x1 + x2) / 2} y={y1 - 5} textAnchor="middle">{WORDS.window}</text>
      <text x={X(0.5)} y={208} textAnchor="middle">resistance at 13.56 MHz (Ω), 0 to {TARGET.rMax}</text>
      <text x={14} y={Y(0.5)} transform={`rotate(-90 14 ${Y(0.5)})`} textAnchor="middle">reactance (Ω), 0 to {TARGET.xMax}</text>
      <Marker z={predicted} kind="predicted" label="model predicts" />
      <Marker z={ghost} kind="ghost" label="with the change" />
      <Marker z={measured} kind="measured" label={measuredLabel ? `your sweep (${measuredLabel})` : 'your sweep'} />
    </svg>
  );
}
```

```tsx
// src/ui/Workbench.tsx
import { type Dispatch, useEffect, useMemo, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { zFromGamma } from '../io/sweep.ts';
import { type VariantResult, measuredLanding } from '../app/evaluate.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { activeIsMeasured, trust, trustText } from '../present/circuit.ts';
import { DRAWING_LABEL, type DrawingKind, type Level, PROFILES, RESULT_LABEL, type ResultKind } from '../present/level.ts';
import { UNKNOWN, combine, landingNearF0, representative, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { Drawing } from './drawing/Drawing.tsx';
import { EngineerPanel } from './EngineerPanel.tsx';
import { PartEditor } from './PartEditor.tsx';
import { TargetBox } from './TargetBox.tsx';
import { VerdictCard } from './VerdictCard.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

const DRAWINGS: readonly DrawingKind[] = ['flow', 'hardware', 'schematic'];
const RESULTS: readonly ResultKind[] = ['verdict', 'target', 'plots'];

export function Workbench({ state, dispatch, level, grid, results, theme }: WorkbenchProps) {
  const [drawing, setDrawing] = useState<DrawingKind | null>(null);
  const [result, setResult] = useState<ResultKind | null>(null);
  useEffect(() => {
    setDrawing(null);
    setResult(null);
  }, [level]);
  const view = useMemo(() => variantChain(state, state.primary), [state]);
  const verdicts = useMemo(() => results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, state.window))), [results, state.window]);
  const combined = combine(verdicts.map((v) => v.state));
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const measuredV = useMemo(() => (active ? verdictOf(landingNearF0(active.f, active.gamma.map((g) => zFromGamma(g)), state.window), state.window) : null), [active, state.window]);
  // The measured verdict applies only while the circuit is the one the active sweep was taken on (spec §7.4).
  const shown = activeIsMeasured(state.chain, state.tagged, state.activeSweep) && measuredV
    ? { v: measuredV, c: undefined, source: 'measured' as const }
    : { v: representative(verdicts, state.primary, combined.state), c: combined, source: 'predicted' as const };
  const t = trust(state.chain, state.tagged);
  const modelError = results.find((r) => r.error)?.error ?? null;
  const clamped = results.some((r) => r.outOfRange);
  const dKind = drawing ?? PROFILES[level].drawing;
  const rKind = result ?? PROFILES[level].result;
  const tone = toneOf(shown.v.state);
  const line = verdictText(shown.v, level === 'beginner' ? 'builder' : level, shown.c);
  const tag = state.tagged.find((x) => x.sweepId === state.activeSweep);

  return (
    <main className="workbench">
      <div className="wb-main">
        <section className="panel">
          <header className="panel-head">
            <h3>Your circuit{dKind === 'flow' ? '' : ': click any part to change it'}</h3>
            <label className="override">Drawing <select value={dKind} onChange={(e) => setDrawing(e.target.value as DrawingKind)}>{DRAWINGS.map((k) => <option key={k} value={k}>{DRAWING_LABEL[k]}</option>)}</select></label>
          </header>
          <Drawing kind={dKind} chain={view} selected={state.selected} highlight={[]} onSelect={(id) => dispatch({ type: 'select', id })} cableM={state.variants[state.primary].cable.length} tuner={{ text: verdictText(shown.v, 'beginner'), tone }} />
        </section>
        <section className="panel">
          <header className="panel-head">
            <h3>{shown.source === 'measured' ? 'Your sweep' : 'Predicted'}: where the tuner lands at 13.56 MHz</h3>
            <label className="override">Result <select value={rKind} onChange={(e) => setResult(e.target.value as ResultKind)}>{RESULTS.map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}</select></label>
          </header>
          {modelError ? <p className="bad">The model can't evaluate this circuit: {modelError}</p> : null}
          {rKind === 'verdict' ? <VerdictCard text={verdictText(shown.v, 'beginner')} tone={tone} source={shown.source} trustNote={trustText(t, 'beginner')} state={shown.v.state} /> : null}
          {rKind === 'target' ? <TargetBox window={state.window} measured={active ? measuredLanding(active)?.z ?? null : null} measuredLabel={tag?.label ?? active?.name ?? ''} predicted={results[state.primary]?.landing?.z ?? null} ghost={null} /> : null}
          {rKind !== 'verdict' ? <p className={`verdict-line ${tone}`}>{line}</p> : null}
          {rKind === 'plots' ? <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} /> : null}
          {rKind !== 'verdict' && trustText(t, 'builder') ? <small>{trustText(t, 'builder')}</small> : null}
          {rKind !== 'verdict' && clamped ? <small className="warn-text"> The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side">
        {state.selected ? <PartEditor state={state} dispatch={dispatch} level={level} /> : null}
      </aside>
    </main>
  );
}
```

Append to `src/ui/app.css`:

```css
.verdict-card { display: grid; gap: 4px; padding: 10px 12px; border-left: 5px solid #aaa; border-radius: 4px; background: rgba(127,127,120,.08); }
.verdict-card b { font-size: 18px; }
.verdict-card p { margin: 2px 0 0; }
.verdict-card.good { border-left-color: #34c759; } .verdict-card.good b { color: #067723; }
.verdict-card.warn { border-left-color: #ff9f0a; } .verdict-card.warn b { color: #8a5a00; }
.verdict-card.bad { border-left-color: #ff3b30; } .verdict-card.bad b { color: #a11414; }
.verdict-card.unknown b { color: #666; }
.verdict-line { margin: 6px 0; font-weight: 700; }
.verdict-line.good { color: #067723; } .verdict-line.warn { color: #8a5a00; } .verdict-line.bad { color: #a11414; } .verdict-line.unknown { color: #666; }
.target { display: block; width: 100%; max-width: 540px; color: #2c2c2a; }
.target text { fill: currentColor; font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; font-size: 10px; }
.target .axis { stroke: currentColor; opacity: .5; }
.target .win { fill: rgba(52,199,89,.14); stroke: #34c759; stroke-dasharray: 5 3; }
.target .mark.measured circle { fill: #f1d51c; stroke: #8a7a00; }
.target .mark.predicted circle, .target .mark.ghost circle { stroke: #a9008b; stroke-width: 2.5; }
html[data-theme='dark'] .target { color: #d6d6d0; }
html[data-theme='dark'] .verdict-line.good, html[data-theme='dark'] .verdict-card.good b { color: #8be39b; }
html[data-theme='dark'] .verdict-line.bad, html[data-theme='dark'] .verdict-card.bad b { color: #ff8a80; }
html[data-theme='dark'] .verdict-line.warn, html[data-theme='dark'] .verdict-card.warn b { color: #f3cf86; }
```

- [ ] **Step 6: Verify: tests, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate at "I measured a new sweep" (the active sweep is 80/180 + loop, and the circuit is that build). Read each screenshot.
1. **Beginner:** the card reads "From your sweep · Matches, but with little room: warming up may push it out" (amber).
2. **Builder:** the target box shows the green window, your sweep's yellow dot near (7.8, 27.9), and the model's ring near (7.2, 18.0). The line reads "The tuner can match it, with little room (room to drift up 0.8 %)".
3. **Engineer:** the plots, and the |S11| axis is no longer stuck at −40 dB.
4. **Predicted:** set the series 50 pF count to 0 (Builder part editor). The heading turns to "Predicted", the line shows the model's verdict, and the trust note appears. Undo the edit (set it back to 1).

- [ ] **Step 7: Commit**

```bash
git add src/app/plotmath.ts src/app/plotmath.test.ts src/ui/PlotPane.tsx src/ui/VerdictCard.tsx src/ui/TargetBox.tsx src/ui/Workbench.tsx src/ui/app.css
git commit -m "feat(ui): verdict card, target box and auto-ranged |S11|; measured verdict only on the measured build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The "I measured a new sweep" guide

**UI wiring:** the step status, recommendation rows, refit and agreement are unit-tested (Tasks 4 and 5). The gate is the browser check in Step 3.

**Files:**
- Create: `src/ui/NewSweepGuide.tsx`
- Modify:
  - `src/ui/Workbench.tsx`: preview state, ghost, highlight, the guide in the side column;
  - `src/ui/app.css`.

**Interfaces:**
- Consumes: `newSweepStatus` (Task 5), `shapeRecs` / `noChangeNeeded` / `picksState` (Task 5), `refitAll` (Task 5), `agreementFor` / `agreementText` (Task 4), `sameState` / `snapshotState` / `structureKey` (Task 1), `sweepFromFile` / `sweepLabel` (Task 8), `applyPicks` (`src/recommend/recommend.ts`).
- Produces: `NewSweepGuide(props: GuideProps)`.

- [ ] **Step 1: Write `src/ui/NewSweepGuide.tsx`**

```tsx
import { type Dispatch, type ReactNode, useEffect, useMemo, useState } from 'react';
import { allBlocks } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { recommend } from '../recommend/recommend.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { sweepFromFile, sweepLabel } from '../app/sweepFile.ts';
import { tagSummary } from '../app/units.ts';
import { type Agreement, agreementFor, agreementText } from '../present/agreement.ts';
import { sameState, snapshotState, structureKey } from '../present/circuit.ts';
import { newSweepStatus } from '../present/guide.ts';
import { type Level, PROFILES } from '../present/level.ts';
import { type RecRow, type RecView, noChangeNeeded, picksState, shapeRecs } from '../present/recs.ts';
import { refitAll } from '../present/refit.ts';
import type { Combined, VerdictState } from '../present/verdict.ts';

const SHORT: Record<VerdictState, string> = { unknown: "can't tell", outside: "tuner can't match", little: 'matches, little room', some: 'matches, some room', plenty: 'matches, plenty of room' };

function rowText(r: RecRow, level: Level, watts: number): string {
  const v = `${SHORT[r.verdict]}${level === 'engineer' ? ` (${r.inCount} of ${r.total} cable assumptions)` : ''}`;
  const st = r.stressPct === null ? 'capacitor stress unknown' : r.stress === 'red' ? `over a capacitor rating at ${watts} W (${r.stressPct.toFixed(0)} %)` : `capacitors at ${r.stressPct.toFixed(0)} % of rating at ${watts} W`;
  return `${v} · ${st}`;
}

export interface GuideProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  level: Level;
  grid: number[];
  caches: BranchCache[];
  combined: Combined;
  preview: Record<string, Pick> | null;
  onPreview: (p: Record<string, Pick> | null) => void;
}

/** "I measured a new sweep" (spec §8.1): confirm the build, load the sweep, check the model, choose a change. */
export function NewSweepGuide({ state, dispatch, level, grid, caches, combined, preview, onPreview }: GuideProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refitMsg, setRefitMsg] = useState<string | null>(null);
  const [blind, setBlind] = useState<Agreement | null>(null);
  const [recs, setRecs] = useState<RecView | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const status = newSweepStatus(confirmed, loaded);
  const last = state.tagged.at(-1);
  const sameAsLast = last !== undefined && last.structure === structureKey(state.chain) && sameState(state.chain, last.state, snapshotState(state.chain));
  const activeTag = state.tagged.find((t) => t.sweepId === state.activeSweep);
  const agreement = useMemo(() => (loaded ? agreementFor(state, grid, caches) : null), [loaded, state.chain, state.fits, state.sweeps, state.tagged, state.activeSweep, state.variants, state.window, grid]);

  useEffect(() => {
    setRecs(null);
    setRecError(null);
    if (!loaded) return undefined;
    const t = setTimeout(() => {
      try {
        const out = recommend({ fitted: state.variants.map((variant, i) => ({ variant, chain: variantChain(state, i) })), sweeps: state.sweeps, grid, window: state.window, stock: state.stock, stressWatts: state.powerW });
        setRecs(shapeRecs(out, state.window));
      } catch (e) {
        setRecError(e instanceof Error ? e.message : String(e));
      }
    }, 30);
    return () => clearTimeout(t);
  }, [loaded, state.chain, state.fits, state.sweeps, state.variants, state.window, state.stock, state.powerW, grid]);

  const onFiles = async (files: FileList | null): Promise<void> => {
    setLoadError(null);
    const file = files?.[0];
    if (!file) return;
    try {
      const sweep = sweepFromFile(file.name, await file.text(), state.sweeps);
      dispatch({ type: 'addSweep', sweep, label: sweepLabel(file.name) });
      setLoaded(true);
      setBlind(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const doRefit = async (): Promise<void> => {
    setBlind(agreement);
    setBusy(true);
    setRefitMsg(null);
    const r = await refitAll(state, (i, n) => setRefitMsg(`Refitting ${i + 1} of ${n}…`));
    setBusy(false);
    if ('error' in r) {
      setRefitMsg(`The refit failed, so the previous fit is kept: ${r.error}`);
      setBlind(null);
      return;
    }
    dispatch({ type: 'setFits', fits: r.fits });
    setRefitMsg(null);
  };

  const editBanks = (): void => {
    const b = allBlocks(state.chain.blocks).find((x) => x.type === 'capBank');
    if (b) dispatch({ type: 'select', id: b.id });
  };

  const recBody = (): ReactNode => {
    if (recError) return <small className="bad">Couldn't work out changes: {recError}</small>;
    if (!recs) return <small>Working out changes from your parts…</small>;
    const heads: string[] = [];
    if (noChangeNeeded(combined.state, recs.currentStressPct)) heads.push('No change needed.');
    if (recs.notes.includes('nothing-beats')) heads.push('Nothing in your stock beats what you have.');
    if (recs.notes.includes('none-fit')) heads.push(recs.closest.length ? 'None of your stock combinations lets the tuner match for most cable assumptions. The closest:' : 'None of your stock combinations lets the tuner match, and there is nothing to try: check Parts on hand.');
    if (recs.notes.includes('all-red')) heads.push(`Every option is over a capacitor rating at ${state.powerW} W planned power.`);
    const rows = recs.rows.length ? recs.rows : recs.closest;
    return (
      <div className="recs">
        {heads.map((h) => <p key={h}><b>{h}</b></p>)}
        <ol>
          {rows.map((r, i) => {
            const on = preview === r.picks;
            return (
              <li key={i} className={on ? 'previewing' : ''}>
                <span>{r.isCurrent ? 'Keep what you have' : r.movesText.join('; ')}</span>
                <small className={`stress-${r.stress}`}>{rowText(r, level, state.powerW)}</small>
                {r.isCurrent ? null : (
                  <div className="row">
                    <button onClick={() => onPreview(on ? null : r.picks)}>{on ? 'Hide' : 'Show on drawing'}</button>
                    <button onClick={() => dispatch({ type: 'setCircuitState', state: picksState(r.picks) })}>Use this</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const step = (n: number, title: string, body: ReactNode): ReactNode => (
    <section className={`step ${status[n]}`} key={n}>
      <h4><span className="step-mark">{status[n] === 'done' ? '✓' : n + 1}</span>{title}</h4>
      {status[n] === 'waiting' ? null : body}
    </section>
  );

  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(0, "What's installed right now?", (
        <>
          <p>{tagSummary(state.chain, snapshotState(state.chain)) || 'No capacitor banks or sense loop in this circuit.'}</p>
          {sameAsLast ? <small>Same as your last build.</small> : null}
          <div className="row">
            <button onClick={() => setConfirmed(true)} disabled={confirmed}>{confirmed ? 'Confirmed' : "That's what's installed"}</button>
            <button onClick={editBanks}>Change</button>
          </div>
        </>
      ))}
      {step(1, 'Load the sweep', (
        <>
          <label className="file-picker">Choose an .s1p file…<input type="file" accept=".s1p" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
          {activeTag && !loaded ? <button onClick={() => setLoaded(true)}>Use "{activeTag.label}" (already loaded)</button> : null}
          {loadError ? <small className="bad">{loadError}</small> : null}
          {PROFILES[level].sheets.includes('sweeps') ? <small>Tagged with the wrong build? Fix it in Sweeps (top bar).</small> : null}
        </>
      ))}
      {step(2, 'Does the model agree?', (
        <>
          {blind ? <p><b>Before refit (blind check):</b> {agreementText(blind, level, state.primary)}</p> : null}
          {agreement ? <p>{blind ? <b>Fit to this sweep: </b> : null}{agreementText(agreement, level, state.primary)}</p> : <p>Can't compare: no sweep is shown.</p>}
          <button onClick={() => { void doRefit(); }} disabled={busy}>Refit the model with this sweep</button>
          {refitMsg ? <small>{refitMsg}</small> : null}
        </>
      ))}
      {step(3, 'What to change', recBody())}
      {step(4, 'Safe at full power?', <><button disabled>Check it at full power</button> <small>Coming next.</small></>)}
    </section>
  );
}
```

- [ ] **Step 2: Wire the guide and the preview into `src/ui/Workbench.tsx`, append CSS**

In `src/ui/Workbench.tsx`:

1. Add the imports:

```tsx
import { findBlock } from '../chain/state.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { applyPicks } from '../recommend/recommend.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { NewSweepGuide } from './NewSweepGuide.tsx';
```

Merge `evaluateVariants` into the existing import from `'../app/evaluate.ts'`, and add `caches` to the destructured props.

2. After the `useEffect` that resets the overrides, add:

```tsx
  const [preview, setPreview] = useState<Record<string, Pick> | null>(null);
  useEffect(() => {
    setPreview(null);
  }, [state.chain]);
  const ghost = useMemo(() => (preview ? evaluateVariants({ ...state, chain: applyPicks(state.chain, preview) }, grid)[state.primary]?.landing?.z ?? null : null), [preview, state, grid]);
  const highlight = preview
    ? Object.keys(preview).filter((id) => {
      const b = findBlock(state.chain, id);
      return b?.type === 'capBank' && JSON.stringify(b.counts) !== JSON.stringify(preview[id].counts);
    })
    : [];
```

3. Pass the preview through:
   - `highlight={highlight}` to `<Drawing>`, replacing `highlight={[]}`;
   - `ghost={ghost}` to `<TargetBox>`, replacing `ghost={null}`.

4. In the side column, under the part editor, add:

```tsx
        <NewSweepGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} combined={combined} preview={preview} onPreview={setPreview} />
```

Append to `src/ui/app.css`:

```css
.guide .step { padding: 6px 0; border-bottom: 1px solid var(--edge); }
.guide .step:last-child { border-bottom: none; }
.guide .step h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 4px; font-size: 12px; }
.guide .step.waiting h4 { opacity: .5; }
.step-mark { display: inline-grid; place-items: center; width: 18px; height: 18px; border: 1px solid var(--edge); border-radius: 50%; font-size: 10px; }
.guide .step.done .step-mark { border-color: #34c759; background: #34c759; color: #fff; }
.guide .step.current .step-mark { border-color: #aa9710; background: #f1d51c; color: #1d1d1f; }
.guide p { margin: 4px 0; font-size: 12px; }
.guide .row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.recs ol { margin: 4px 0; padding-left: 18px; }
.recs li { margin-bottom: 6px; font-size: 12px; }
.recs li small { display: block; }
.recs li.previewing { background: rgba(241,213,28,.17); }
.stress-red { color: #a11414; }
.stress-amber { color: #8a5a00; }
.stress-unknown { color: #666; }
html[data-theme='dark'] .stress-red { color: #ff8a80; }
```

- [ ] **Step 3: Verify: tests, build, browser gate**

Run: `npm test && npm run build`
Expected: PASS.

Browser gate (read each screenshot):
1. **Builder, step 1:** "Series bank 80 pF · Shunt bank 180 pF · loop on" with "Same as your last build." Pressing "That's what's installed" ticks it.
2. **Step 2:** "Use "80/180 + loop" (already loaded)" opens steps 3–5.
3. **Step 3** reads: "Close enough to rank changes, not exact: resistance −0.6 Ω, reactance −9.9 Ω (model minus sweep). Near the edge…".
4. **Refit:** "Refit the model with this sweep" shows "Refitting 1 of 3…" and then:
   - step 3 shows "Before refit (blind check): …" and "Fit to this sweep: …";
   - the Engineer fitted-values table shows "in-app refit (5 sweeps)" and Settled? yes.
5. **Step 4:** "Nothing in your stock beats what you have." and the over-rating note at 500 W. Four rows, the first "Keep what you have".
6. **Preview:** "Show on drawing" on row 2 highlights the changed banks (dashed yellow) and puts a dashed "with the change" ring in the target box.
7. **Use this:** the heading switches to "Predicted" and the drawing shows the new pucks.
8. **No sweep near 13.56 MHz (Review Focus 2):**
   - Load a short sweep with no 13.56 MHz point. Create it in the console as a `File` and dispatch through the input's change handler. If file inputs can't be driven from the pane, rely on Task 3 and 4's tests and record that in the ledger.
   - The verdict reads "Can't tell yet" and step 3 reads "Can't compare yet…".

- [ ] **Step 4: Commit**

```bash
git add src/ui/NewSweepGuide.tsx src/ui/Workbench.tsx src/ui/app.css
git commit -m "feat(ui): the 'I measured a new sweep' guide — confirm, load, agree, change, with preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Real-data acceptance walkthrough and README

**Not a code task:** the gate is the walkthrough itself. If any step fails, the code is wrong: use superpowers:systematic-debugging, add the failing test to the owning task's test file, fix, and record a `Ruling:`.

**Files:**
- Modify: `README.md` (what the app does now, in four lines)

- [ ] **Step 1: Built-site check**

Run: `npm run build && npx vite preview --port 5182 --strictPort` (in the background).
Open `http://localhost:5182/` in the browser pane.
Expected:
- the home screen;
- the O7 example loads with no 404s in the network panel (relative `examples/o7/` paths);
- no console errors.

- [ ] **Step 2: The spec §1 success test, at all three levels, on the dev server**

For each level (Beginner, Builder, Engineer), from Home → "I measured a new sweep":
1. confirm the build;
2. use the loaded sweep;
3. read the verdict, the agreement and the change list.

Expected:
- the O7 example states match spec §7.1 ("little room" for the sweep; "some room" for the model when predicted);
- no internal words appear on screen: search the page text for "AIT", "variant", "landing" with `get_page_text`. Engineer may say "cable assumption" but never "variant".

- [ ] **Step 3: Narrow-screen and dark-theme checks**

- Resize the pane to the mobile preset: the workbench stacks to one column, with no horizontal page scroll.
- Switch to the dark theme: the drawings, the target box and the verdicts stay readable.
- Reset the size to desktop.

- [ ] **Step 4: Update `README.md`**

Replace the first paragraph with:

```markdown
Browser tool for designing and tuning the RFAM matching network. Pick a level (Beginner, Builder, Engineer), then a task.
"I measured a new sweep" walks you through: confirm what's installed, load the `.s1p`, see whether the model agrees, and get
changes you can make from the parts on hand. The circuit is drawn as a power-flow diagram, the hardware in its cage, or a
schematic. Work autosaves in the browser; Save project / Open project move it between machines. Design:
`docs/superpowers/specs/2026-10-15-rf-network-modeller-ux-design.md`.
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: describe the task-led interface in the README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

# RF Network Modeller Plan 3C: New Network, Past Builds and Rig History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase C tasks. "Start a new network" gives templates, add/remove/reorder parts by level, and rig settings. "Look back at past builds" covers the browser library, builds, compare two, and open. "Rig history" (Engineer only) bundles every past sweep with the site, read-only, and opens a session as a measured-only copy.

**Architecture:** The pure logic is TDD'd first:
- placement in `src/app/chainEdit.ts`;
- palette by level in `src/present/palette.ts`;
- builds in `src/present/builds.ts`;
- `hasModel` in `src/present/circuit.ts`;
- templates in `src/app/templates.ts`;
- the history manifest, index, CSV conversion and import plan in `src/history/manifest.ts`;
- history copies in `src/history/copy.ts`.

`tools/history/build.ts` turns the curated `history/manifest.json` and the real Dropbox folder into `public/history/`. A project with no circuit model (cable only) is "measured only": it shows measured verdicts and no predictions.

**Tech Stack:** TypeScript 5.9.3 run directly by Node (`--experimental-strip-types`), React 19.2.6, Vite 8.0.13, `node:test`, IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-15-rf-network-modeller-ux-design.md`, mainly §8.4–§8.6 (tasks), §9 (builds and library) and §10 (rig history). §5 (levels), §11 (wording) and §12 (honesty) apply throughout.

## Global Constraints

- **Repo and branch:** `~/code/put_github_repos_here/rf-network-modeller`, branch `feat/plan3c-library-history` off main `0182d36`. Never push from a task.
- **Module rules:** `.ts`/`.tsx` import extensions; `import type` for types; no enums, namespaces or parameter properties.
- **Gamma and Z conversions:** never `arr.map(gammaFromZ)` or `arr.map(zFromGamma)`; write `arr.map((g) => zFromGamma(g))`.
- **Unknown never renders as healthy:**
  - a measured-only project never shows a model prediction;
  - a history field that is `"unknown"` or `null` shows as unknown;
  - a failed library or history fetch says so, and is never shown as an empty list.
- **No jargon on screen:**
  - no "AIT", "variant" or "landing"; Engineer may say "cable assumption";
  - history titles, labels and rig text are screen copy, so they follow the same rule;
  - evidence citations and file paths are data and are shown verbatim.
- **The Dropbox source folder is read-only.** The importer reads it and writes only under `public/history/`.
- `src/ui/nanovna.css` is never edited.
- **No new dependencies; no superfluous code.**
- **Every commit message** ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Opening a history copy.** Each sweep shows its measured verdict. No predicted ring, curve or "can't match" comes from a cable-only model. Pinned by: Task 1 `hasModel` test, Task 7 copy test and browser gate.
2. **"In parallel with it" on a part inside a branch.** The new group wraps exactly that part and leaves its siblings in place. Pinned by: Task 1 `wrapParallel` test on `Lb` inside `branchArm`.
3. **Two sweeps of one build, and sweeps with no stamp.** Two sweeps of the same build group as one. A build with no `nanovna-sweep-<ms>` stamp reads "date unknown", not a made-up date. Sweeps tagged with no circuit state (history copies) group by their label. Pinned by: Task 1 builds tests.
4. **A history CSV that is telemetry or an analysis table.** It is skipped with its reason, never turned into a fake sweep. Pinned by: Task 5 test on captured real headers.
5. **Editing a cable assumption.** If the cable length or jumper L changes, that assumption's fit and transformer model go away. A rename keeps them under the new name. Pinned by: Task 1 `setVariants` test.

---

### Task 1: Placement, palette, builds, measured-only detection and the new reducer actions

**Files:**
- Modify:
  - `src/app/chainEdit.ts`: `Placement`, `wrapParallel`, `placeBlock`;
  - `src/app/state.ts`: actions `place`, `setVariants`, `setWindow`, `setName`;
  - `src/present/circuit.ts`: `hasModel`.
- Create: `src/present/palette.ts`, `src/present/builds.ts`
- Test: `src/app/chainEdit.test.ts`, `src/app/state.test.ts`, `src/present/builds.test.ts`

**Interfaces:**
- Produces, in `chainEdit.ts`:
  - `type Placement = 'inline' | 'ground' | 'parallel'`;
  - `wrapParallel(chain, targetId, block, reserved?)`;
  - `placeBlock(chain, targetId: string | null, where: Placement, block, reserved?)`: with a null target, `inline` and `ground` go at the end.
- Produces, in `palette.ts`:
  - `PaletteItem { kind: NewBlockKind; label: string }`;
  - `paletteFor(level)`;
  - `placementsFor(level)`;
  - `PLACEMENT_LABEL`.
- Produces, in `builds.ts`:
  - `Build { key; label; sweepIds; newest: number | null }`;
  - `stampOf(name)`;
  - `buildsOf(s)`.
- Produces: `hasModel(chain)`.
- Produces, in `state.ts`, these actions:
  - `{ type: 'place'; targetId; where; block }`;
  - `{ type: 'setVariants'; variants }`: a fit or transformer model follows an assumption whose cable and jumper L are unchanged; any other change drops it;
  - `{ type: 'setWindow'; window }`;
  - `{ type: 'setName'; name }`.

- [ ] **Step 1: Write the failing tests**

Append to `src/app/chainEdit.test.ts`, merging `placeBlock` and `wrapParallel` into its `./chainEdit.ts` import:

```ts
test('placeBlock: in line after a part, from that point to ground, or at the end (spec §8.4)', () => {
  const add = newBlock(base, 'inductor');
  const inline = placeBlock(base, 'Ls', 'inline', add);
  assert.equal(inline.blocks[inline.blocks.findIndex((b) => b.id === 'Ls') + 1].id, add.id);
  const ground = placeBlock(base, 'Ls', 'ground', add);
  const sh = ground.blocks[ground.blocks.findIndex((b) => b.id === 'Ls') + 1];
  assert.ok(sh.type === 'shunt' && sh.chain.length === 1 && sh.chain[0].id === add.id);
  assert.equal(placeBlock(base, null, 'inline', add).blocks.at(-1)?.id, add.id);
  const endGround = placeBlock(base, null, 'ground', add).blocks.at(-1);
  assert.ok(endGround?.type === 'shunt' && endGround.chain[0].id === add.id);
  compile(ground, ctx);
});

test('wrapParallel wraps exactly the target, even inside a branch, and leaves its siblings (review focus 2)', () => {
  const add = newBlock(base, 'C');
  const out = wrapParallel(base, 'Lb', add);
  const arm = findBlock(out, 'branchArm');
  assert.ok(arm?.type === 'shunt');
  assert.equal(arm.chain.length, 2, 'Lb is wrapped in place; the measured branch stays beside it');
  const par = arm.chain[0];
  assert.ok(par.type === 'parallel');
  assert.deepEqual(par.chains.map((ch) => ch.map((b) => b.id)), [['Lb'], [add.id]]);
  assert.equal(arm.chain[1].id, 'branch');
  assert.deepEqual(duplicateIds(out), []);
  compile(out, ctx);
});
```

Create `src/present/builds.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { ROOT } from '../testutil.ts';
import { buildsOf, stampOf } from './builds.ts';
import { hasModel } from './circuit.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
export const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));

test('the O7 example has five builds, one per tagged state, labelled by their parts (spec §9)', () => {
  const b = buildsOf(ex);
  assert.equal(b.length, 5);
  assert.equal(b[4].label, 'Series bank 80 pF · Shunt bank 180 pF · loop on');
  assert.deepEqual(b[4].sweepIds, ['o7-80-180-loop']);
});

test('two sweeps of the same build group together; no file stamp means date unknown (review focus 3)', () => {
  const again = { ...ex.sweeps['o7-80-180-loop'], id: 'again', name: 'x_nanovna-sweep-1791933400391.s1p' };
  const twice = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[4], sweepId: 'again', label: 'again' }], sweeps: { ...ex.sweeps, again } };
  const b = buildsOf(twice);
  assert.equal(b.length, 5);
  assert.deepEqual(b[4].sweepIds, ['o7-80-180-loop', 'again']);
  assert.equal(b[4].newest, 1791933400391);
  assert.equal(b[0].newest, null, 'the example files were renamed and carry no stamp');
  assert.equal(stampOf('noAIT_80ser_200sh_nanovna-sweep-1791931754256.s1p'), 1791931754256);
  assert.equal(stampOf('80-200.s1p'), null);
});

test('sweeps tagged with no circuit state (a measured-only project) group by their label (review focus 3)', () => {
  const chain = { name: 'm', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] };
  const tag = (sweepId: string, label: string) => ({ sweepId, label, state: {}, include: true, structure: 's' });
  const b = buildsOf({ chain, sweeps: {}, tagged: [tag('a', '300/300 cold'), tag('b', '300/300 cold'), tag('c', '180/250')] });
  assert.deepEqual(b.map((x) => [x.label, x.sweepIds]), [['300/300 cold', ['a', 'b']], ['180/250', ['c']]]);
});

test('a cable-only project has no circuit model; anything else does (review focus 1)', () => {
  assert.equal(hasModel({ name: 'm', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] }), false);
  assert.equal(hasModel({ name: 'm', blocks: [] }), false);
  assert.equal(hasModel(cdChain()), true);
  assert.equal(hasModel(ex.chain), true);
});
```

Append to `src/app/state.test.ts`:

```ts
test('place puts a new part where asked and selects it; setWindow and setName', () => {
  const add = newBlock(base.chain, 'inductor');
  const s = reducer(base, { type: 'place', targetId: 'Ls', where: 'ground', block: add });
  assert.equal(s.selected, add.id);
  assert.ok(findBlock(s.chain, add.id));
  assert.deepEqual(reducer(base, { type: 'setWindow', window: { rLo: 4, rHi: 18, xLo: 5, xHi: 50 } }).window, { rLo: 4, rHi: 18, xLo: 5, xHi: 50 });
  assert.equal(reducer(base, { type: 'setName', name: 'Pass 6' }).chain.name, 'Pass 6');
});

test('setVariants: a fit follows an unchanged cable and jumper L, even renamed; a changed one loses it (review focus 5)', () => {
  const tm = { variant: DEFAULT_VARIANTS[0].name, sweepId: 'capfree', unit: { n: 5, L_leak: 1e-6, f_pri: 0, L_m: 1e-6, G_core: 0, R1: 0, R2: 0, C_w: 0, N_p: 3, N_c: 4 }, load: { C: 3e-12, G_cube: 0, G_fix: 0 }, rmsRel: 0.01 };
  const s0 = { ...base, tmodel: tm };
  const renamed = reducer(s0, { type: 'setVariants', variants: [{ ...DEFAULT_VARIANTS[0], name: 'Cage cable' }, DEFAULT_VARIANTS[1], DEFAULT_VARIANTS[2]] });
  assert.deepEqual(Object.keys(renamed.fits).sort(), ['1.2825 m + 329 nH', 'Cage cable']);
  assert.equal(renamed.tmodel?.variant, 'Cage cable');
  const longer = reducer(s0, { type: 'setVariants', variants: [{ ...DEFAULT_VARIANTS[0], cable: { ...DEFAULT_VARIANTS[0].cable, length: 1.3 } }, DEFAULT_VARIANTS[1], DEFAULT_VARIANTS[2]] });
  assert.deepEqual(Object.keys(longer.fits), [DEFAULT_VARIANTS[1].name]);
  assert.equal(longer.tmodel, null);
  const fewer = reducer({ ...s0, primary: 2 }, { type: 'setVariants', variants: [DEFAULT_VARIANTS[1]] });
  assert.equal(fewer.primary, 0, 'the chosen assumption stays in range');
  assert.deepEqual(Object.keys(fewer.fits), [DEFAULT_VARIANTS[1].name]);
  assert.equal(reducer(base, { type: 'setVariants', variants: [] }), base, 'at least one cable assumption is kept');
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test 2>&1 | grep -E "^# (pass|fail)|Cannot find|does not provide"`
Expected: FAIL. `./builds.ts` can't be found, and `placeBlock` / `wrapParallel` are not exported.

- [ ] **Step 3: Implement**

Append to `src/app/chainEdit.ts`:

```ts
export type Placement = 'inline' | 'ground' | 'parallel';

/** Wraps the target in a parallel group whose second path is `block` ("in parallel with it", spec §8.4). */
export function wrapParallel(chain: Chain, targetId: string, block: Block, reserved: Iterable<string> = []): Chain {
  const { id } = newBlock(chain, 'parallel', '', reserved);
  const next = editList(chain.blocks, targetId, (list, i) => list.map((x, j): Block => (j === i ? { id, label: 'Parallel', type: 'parallel', chains: [[x], [block]] } : x)));
  return next ? { ...chain, blocks: next } : chain;
}

/** Puts `block` after the target (or at the end), on a new branch from there to ground, or in parallel with the target. */
export function placeBlock(chain: Chain, targetId: string | null, where: Placement, block: Block, reserved: Iterable<string> = []): Chain {
  if (where === 'parallel' && targetId !== null) return wrapParallel(chain, targetId, block, reserved);
  if (where === 'ground') return insertAfter(chain, targetId, { id: newBlock(chain, 'shunt', '', reserved).id, label: 'To ground', type: 'shunt', chain: [block] });
  return insertAfter(chain, targetId, block);
}
```

Create `src/present/palette.ts`:

```ts
import type { NewBlockKind, Placement } from '../app/chainEdit.ts';
import type { Level } from './level.ts';

export interface PaletteItem { kind: NewBlockKind; label: string }

const BEGINNER: readonly PaletteItem[] = [
  { kind: 'capBank', label: 'Capacitor bank' },
  { kind: 'stack', label: 'Transformer stack' },
  { kind: 'plates', label: 'Electrode plates' },
  { kind: 'wire', label: 'Strap or wire' },
];
const BUILDER: readonly PaletteItem[] = [...BEGINNER, { kind: 'inductor', label: 'Inductance' }, { kind: 'measuredBranch', label: 'Measured part (from a sweep)' }];
const ENGINEER: readonly PaletteItem[] = [
  ...BUILDER,
  { kind: 'R', label: 'Resistor' },
  { kind: 'L', label: 'Inductor (ideal)' },
  { kind: 'C', label: 'Capacitor (ideal)' },
  { kind: 'short', label: 'Short' },
  { kind: 'ideal', label: 'Ideal transformer' },
];

/** The parts each level can add (spec §8.4). */
export const paletteFor = (level: Level): readonly PaletteItem[] => (level === 'beginner' ? BEGINNER : level === 'builder' ? BUILDER : ENGINEER);

/** Where a new part can go; only Engineer can put one in parallel. */
export const placementsFor = (level: Level): readonly Placement[] => (level === 'engineer' ? ['inline', 'ground', 'parallel'] : ['inline', 'ground']);

export const PLACEMENT_LABEL: Readonly<Record<Placement, string>> = { inline: 'In line after it', ground: 'From there to ground', parallel: 'In parallel with it' };
```

Create `src/present/builds.ts`:

```ts
import { tagSummary } from '../app/units.ts';
import type { AppState, TagRef } from '../app/state.ts';
import { sameState } from './circuit.ts';

export interface Build { key: string; label: string; sweepIds: string[]; newest: number | null }

/** The NanoVNA web tool's save stamp in a file name (ms since the epoch), or null: dates are never invented. */
export const stampOf = (name: string): number | null => {
  const m = /nanovna-sweep-(\d{13})/.exec(name);
  return m ? Number(m[1]) : null;
};

const stateless = (t: TagRef): boolean => Object.keys(t.state).length === 0;

/**
 * Tagged sweeps grouped by equal structure and circuit state, in first-seen order (spec §9). A tag that records no circuit
 * state (a measured-only project) groups by its label instead.
 */
export function buildsOf(s: Pick<AppState, 'chain' | 'tagged' | 'sweeps'>): Build[] {
  const groups: TagRef[][] = [];
  for (const t of s.tagged) {
    const g = groups.find(([h]) => h.structure === t.structure && (stateless(h) || stateless(t) ? h.label === t.label && stateless(h) && stateless(t) : sameState(s.chain, h.state, t.state)));
    if (g) g.push(t);
    else groups.push([t]);
  }
  return groups.map((g, i) => {
    const stamps = g.map((t) => stampOf(s.sweeps[t.sweepId]?.name ?? '')).filter((x): x is number => x !== null);
    return {
      key: `b${i}`,
      label: tagSummary(s.chain, g[0].state) || g[0].label,
      sweepIds: g.map((t) => t.sweepId),
      newest: stamps.length ? Math.max(...stamps) : null,
    };
  });
}
```

Append to `src/present/circuit.ts`:

```ts
/** A project has a circuit model when it holds any part besides the cable; a cable-only project is "measured only". */
export const hasModel = (chain: Chain): boolean => allBlocks(chain.blocks).some((b) => b.type !== 'coax' && b.type !== 'shunt' && b.type !== 'parallel');
```

In `src/app/state.ts`:
- merge `type Placement, placeBlock` into the `./chainEdit.ts` import;
- add to `Action`:

```ts
  | { type: 'place'; targetId: string | null; where: Placement; block: Block }
  | { type: 'setVariants'; variants: Variant[] }
  | { type: 'setWindow'; window: Window }
  | { type: 'setName'; name: string }
```

- add above `reducer`:

```ts
/** A cable assumption's physics: fits and the transformer model belong to it, not to its name or position. */
const physics = (v: Variant): string => JSON.stringify([v.cable, v.Lj]);

/** New cable assumptions, carrying each fit and the transformer model to the assumption with the same physics (review focus 5). */
function withVariants(s: AppState, variants: Variant[]): AppState {
  const fits: Record<string, FitValues> = {};
  let tmodel: TModel | null = null;
  for (const v of variants) {
    const old = s.variants.find((o) => physics(o) === physics(v));
    if (old && s.fits[old.name]) fits[v.name] = s.fits[old.name];
    if (old && s.tmodel?.variant === old.name) tmodel = { ...s.tmodel, variant: v.name };
  }
  return { ...s, variants, fits, tmodel, primary: Math.min(s.primary, variants.length - 1) };
}
```

- add the reducer cases:

```ts
    case 'place':
      return { ...s, chain: placeBlock(s.chain, a.targetId, a.where, a.block, reservedIds(s)), selected: a.block.id };
    case 'setVariants':
      return a.variants.length ? withVariants(s, a.variants) : s;
    case 'setWindow':
      return { ...s, window: a.window };
    case 'setName':
      return { ...s, chain: { ...s.chain, name: a.name } };
```

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test 2>&1 | tail -4 && npm run typecheck`
Expected: PASS, and the typecheck is clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/chainEdit.ts src/app/chainEdit.test.ts src/app/state.ts src/app/state.test.ts src/present/palette.ts src/present/builds.ts src/present/builds.test.ts src/present/circuit.ts
git commit -m "feat(present): place parts in line, to ground or in parallel; palette by level; builds; measured-only detection; rig-setting actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Measured-only projects never show a prediction

**UI wiring, not unit-testable:** `hasModel` was TDD'd in Task 1. The gate is the browser check in Step 3.

**Files:**
- Modify: `src/ui/App.tsx`, `src/ui/Workbench.tsx`, `src/ui/NewSweepGuide.tsx`

**Interfaces:**
- Consumes: `hasModel(chain)` (Task 1).
- Produces:
  - App passes `results = []` when `!hasModel(state.chain)`;
  - the Workbench result panel says "This project holds measured sweeps only; there is no circuit model to predict from.";
  - the new-sweep guide's steps 3 and 4 give the measured-only sentence instead of agreement and suggestions.

- [ ] **Step 1: Implement**

`src/ui/App.tsx`:
- import `hasModel` from `../present/circuit.ts`;
- replace the `results` memo with:

```tsx
  const results = useMemo(() => (hasModel(state.chain) ? evaluateVariants(state, grid, caches.current) : []), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);
```

`src/ui/Workbench.tsx`:
- import `hasModel` from `../present/circuit.ts`;
- after the `modelError` line in the result panel, add:

```tsx
          {hasModel(state.chain) ? null : <p>This project holds measured sweeps only; there is no circuit model to predict from.</p>}
```

`src/ui/NewSweepGuide.tsx`:
- import `hasModel` from `../present/circuit.ts`;
- add `const model = hasModel(state.chain);` near the top of the component;
- the agreement memo returns `null` when `!model`;
- the recommend effect returns early (no timer) when `!model`;
- step 3's body and step 4's body, when `!model`, are both:

```tsx
<p>This project holds measured sweeps only, so there is no model to compare with or to suggest changes from.</p>
```

Read `NewSweepGuide.tsx` first and make these four edits in its own idiom. Do not restructure the steps.

- [ ] **Step 2: Run the suite and build**

Run: `npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3`
Expected: PASS, and the build succeeds.

- [ ] **Step 3: Browser gate**

On the dev server (http://localhost:5181/):
1. In the console, rewrite the current IndexedDB record so `project.chain.blocks` is only the coax block, keeping its sweeps and tags. Reload.
2. Builder, "I measured a new sweep":
   - the result panel shows the active sweep's measured verdict plus the measured-only sentence;
   - the target box has the sweep point and no "model predicts" ring;
   - steps 3 and 4 show the measured-only sentence.
3. Engineer: the plots show only the measured trace.
4. "Safe at full power?" and "Try a change first" open without console errors.

Restore with `indexedDB.deleteDatabase('rf-network-modeller')` and reload.

- [ ] **Step 4: Commit**

```bash
git add src/ui/App.tsx src/ui/Workbench.tsx src/ui/NewSweepGuide.tsx
git commit -m "feat(ui): a measured-only project shows its measured verdicts and no prediction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Start a new network

**Files:**
- Create: `src/app/templates.ts`, `src/app/templates.test.ts`, `src/ui/NewNetworkGuide.tsx`, `src/ui/RigSettings.tsx`
- Modify: `src/ui/Home.tsx`, `src/ui/App.tsx`, `src/ui/Workbench.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `placeBlock` (through the `place` action), `paletteFor`, `placementsFor`, `PLACEMENT_LABEL`, `setVariants`, `setWindow`, `setName`, `hasModel`;
  - `loadExample()`, `cdChain()`, `emptyState()`, `newBlock`, `reservedIds`.
- Produces, in `templates.ts`:
  - `type TemplateKind = 'o7' | 'cd' | 'blank'`;
  - `TEMPLATES: readonly { kind: TemplateKind; label: string }[]`;
  - `fromTemplate(kind: TemplateKind, o7?: AppState): AppState`.
- Produces, in `Home.tsx`:
  - `type WorkTask = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork'`;
  - `type Task = 'home' | WorkTask | 'pastBuilds' | 'rigHistory'`.
- Produces: `Workbench` prop `onNewProject: (s: AppState, next: Task) => void`, implemented in App as `newProject`.

- [ ] **Step 1: Write the failing test**

Create `src/app/templates.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { ex } from '../present/builds.test.ts';
import { hasModel } from '../present/circuit.ts';
import { evaluateVariants } from './evaluate.ts';
import { evalGrid } from './grid.ts';
import { fromTemplate } from './templates.ts';

test('O7 as built keeps the circuit, its fits and the part sweep, but no tagged sweeps (spec §8.4)', () => {
  const s = fromTemplate('o7', ex);
  assert.deepEqual(s.chain.blocks, ex.chain.blocks);
  assert.deepEqual(Object.keys(s.sweeps), ['capfree'], 'only the sweep the measured part needs');
  assert.deepEqual(s.tagged, []);
  assert.equal(s.activeSweep, null);
  assert.equal(s.fits, ex.fits);
  assert.equal(s.tmodel, ex.tmodel);
  assert.ok(evaluateVariants(s, evalGrid(s.chain, s.sweeps)).every((r) => r.error === null && r.landing !== null));
});

test('C+D predicts with no sweeps; Blank is the cable alone and measured only', () => {
  const cd = fromTemplate('cd');
  assert.deepEqual(cd.chain, cdChain());
  assert.ok(evaluateVariants(cd, evalGrid(cd.chain, cd.sweeps)).every((r) => r.error === null && r.landing !== null));
  const blank = fromTemplate('blank');
  assert.deepEqual(blank.chain.blocks.map((b) => b.type), ['coax']);
  assert.equal(hasModel(blank.chain), false);
  assert.throws(() => fromTemplate('o7'), /O7 example/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/app/templates.test.ts 2>&1 | grep -E "^# (pass|fail)|Cannot find"`
Expected: FAIL, because `./templates.ts` can't be found.

- [ ] **Step 3: Implement the templates**

Create `src/app/templates.ts`:

```ts
import { allBlocks } from '../chain/state.ts';
import { cdChain } from '../chain/presets.ts';
import { type AppState, emptyState } from './state.ts';

export type TemplateKind = 'o7' | 'cd' | 'blank';

export const TEMPLATES: readonly { kind: TemplateKind; label: string }[] = [
  { kind: 'o7', label: 'O7 as built' },
  { kind: 'cd', label: 'C+D 2:18 two-core' },
  { kind: 'blank', label: 'Blank (cable only)' },
];

/**
 * A new project from a starting point (spec §8.4). O7 keeps the example's circuit, fits, transformer model and the sweep
 * its measured part needs, but none of its tagged sweeps: they belong to the old project.
 */
export function fromTemplate(kind: TemplateKind, o7?: AppState): AppState {
  if (kind === 'cd') return { ...emptyState(), chain: cdChain() };
  if (kind === 'blank') return { ...emptyState(), chain: { name: 'New network', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] } };
  if (!o7) throw new Error('the O7 example is needed for this template');
  const used = new Set(allBlocks(o7.chain.blocks).flatMap((b) => (b.type === 'measuredBranch' ? [b.sweepId] : [])));
  return {
    ...o7,
    chain: { ...o7.chain, name: 'New network from O7' },
    sweeps: Object.fromEntries(Object.entries(o7.sweeps).filter(([id]) => used.has(id))),
    tagged: [],
    activeSweep: null,
    selected: null,
  };
}
```

Run: `node --experimental-strip-types --test src/app/templates.test.ts 2>&1 | grep -E "^# (pass|fail)"`
Expected: PASS (2/2).

- [ ] **Step 4: Implement the UI**

The UI wiring is not unit-testable; the gate is the browser check in Step 6.

`src/ui/Home.tsx`, replacing the file:

```tsx
export type WorkTask = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork';
export type Task = 'home' | WorkTask | 'pastBuilds' | 'rigHistory';

const TILES: readonly { task: Task | null; title: string; text: string }[] = [
  { task: 'newSweep', title: 'I measured a new sweep', text: 'Load it, see how it compares, get the next change to make' },
  { task: 'tryChange', title: 'Try a change first', text: 'Swap a part and see what the VNA would show' },
  { task: 'safePower', title: 'Safe at full power?', text: 'Cap voltage and current, transformer flux' },
  { task: 'newNetwork', title: 'Start a new network', text: 'From a template or a blank board' },
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

Create `src/ui/RigSettings.tsx`:

```tsx
import type { Dispatch } from 'react';
import type { Variant, Window } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

/** Engineer rig settings (spec §8.4): the cable assumptions and what the tuner can match. */
export function RigSettings({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const set = (i: number, v: Variant): void => dispatch({ type: 'setVariants', variants: state.variants.map((x, j) => (j === i ? v : x)) });
  const edit = (v: Variant, patch: { name?: string; length?: number; Lj?: number }): Variant =>
    ({ name: patch.name ?? v.name, cable: { ...v.cable, length: patch.length ?? v.cable.length }, Lj: patch.Lj ?? v.Lj });
  const win = (k: keyof Window, n: number): void => dispatch({ type: 'setWindow', window: { ...state.window, [k]: n } });
  const p = state.variants[state.primary];
  return (
    <>
      <table className="numbers">
        <thead><tr><th>Cable assumption</th><th>Length (m)</th><th>Jumper L (nH)</th><th /></tr></thead>
        <tbody>
          {state.variants.map((v, i) => (
            <tr key={i}>
              <td><input value={v.name} onChange={(e) => set(i, { ...v, name: e.target.value })} aria-label="Cable assumption name" /></td>
              <td><DraftNumberInput min="0" step="any" value={v.cable.length} onCommit={(n) => set(i, edit(v, { length: n }))} aria-label="Cable length (m)" /></td>
              <td><DraftNumberInput step="any" value={Number((v.Lj * 1e9).toPrecision(8))} onCommit={(n) => set(i, edit(v, { Lj: n * 1e-9 }))} aria-label="Jumper inductance (nH)" /></td>
              <td><button disabled={state.variants.length < 2} onClick={() => dispatch({ type: 'setVariants', variants: state.variants.filter((_, j) => j !== i) })} aria-label={`Remove ${v.name}`}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => dispatch({ type: 'setVariants', variants: [...state.variants, { ...edit(p, {}), name: `${p.name} (copy)` }] })}>Add a cable assumption</button>
      <small>Changing a length or jumper inductance clears that assumption's fitted values; renaming keeps them.</small>
      <h4>What the tuner can match</h4>
      {(['rLo', 'rHi', 'xLo', 'xHi'] as const).map((k) => (
        <div className="form-row" key={k}>
          <label>{{ rLo: 'Resistance from (Ω)', rHi: 'Resistance to (Ω)', xLo: 'Reactance from (Ω)', xHi: 'Reactance to (Ω)' }[k]}</label>
          <DraftNumberInput step="any" value={state.window[k]} onCommit={(n) => win(k, n)} />
        </div>
      ))}
    </>
  );
}
```

Create `src/ui/NewNetworkGuide.tsx`:

```tsx
import { type Dispatch, type ReactNode, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import { type NewBlockKind, type Placement, newBlock } from '../app/chainEdit.ts';
import { loadExample } from '../app/example.ts';
import { type Action, type AppState, reservedIds } from '../app/state.ts';
import { TEMPLATES, type TemplateKind, fromTemplate } from '../app/templates.ts';
import { hasModel } from '../present/circuit.ts';
import type { Level } from '../present/level.ts';
import { PLACEMENT_LABEL, paletteFor, placementsFor } from '../present/palette.ts';
import type { Task } from './Home.tsx';
import { RigSettings } from './RigSettings.tsx';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** "Start a new network" (spec §8.4): a starting point, then add, remove and reorder parts; Engineer also sets the rig. */
export function NewNetworkGuide({ state, dispatch, level, onNewProject, verdictLine }: { state: AppState; dispatch: Dispatch<Action>; level: Level; onNewProject: (s: AppState, next: Task) => void; verdictLine: string }) {
  const palette = paletteFor(level);
  const [kind, setKind] = useState<NewBlockKind>(palette[0].kind);
  const [where, setWhere] = useState<Placement>('inline');
  const [sweepId, setSweepId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sel = state.selected ? findBlock(state.chain, state.selected) : undefined;
  const places = placementsFor(level).filter((p) => sel || p !== 'parallel');
  const k = palette.some((p) => p.kind === kind) ? kind : palette[0].kind;
  const w = places.includes(where) ? where : 'inline';
  const sweeps = Object.values(state.sweeps);
  const sw = sweeps.some((x) => x.id === sweepId) ? sweepId : sweeps[0]?.id ?? '';
  const start = async (t: TemplateKind): Promise<void> => {
    try {
      setError(null);
      onNewProject(fromTemplate(t, t === 'o7' ? await loadExample() : undefined), 'newNetwork');
    } catch (e) {
      setError(`Couldn't start from that template: ${message(e)}`);
    }
  };
  const add = (): void => dispatch({ type: 'place', targetId: sel?.id ?? null, where: w, block: newBlock(state.chain, k, k === 'measuredBranch' ? sw : '', reservedIds(state)) });
  const step = (n: number, title: string, body: ReactNode): ReactNode => (
    <section className="step active" key={n}><h4><span className="step-mark">{n}</span>{title}</h4>{body}</section>
  );
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(1, 'Pick a starting point', (
        <>
          <p>This starts a new project. The one open now stays in Past builds.</p>
          <div className="row">{TEMPLATES.map((t) => <button key={t.kind} onClick={() => { void start(t.kind); }}>{t.label}</button>)}</div>
          {error ? <p className="bad">{error}</p> : null}
          <div className="form-row"><label>Project name</label><input value={state.chain.name} onChange={(e) => dispatch({ type: 'setName', name: e.target.value })} /></div>
        </>
      ))}
      {step(2, 'Add, remove and reorder parts', (
        <>
          <p>{sel ? `Selected: ${sel.label}. A new part goes next to it.` : 'Nothing selected: a new part goes at the end. Click a part in the drawing to place it there instead.'}</p>
          <div className="form-row"><label>Part</label><select value={k} onChange={(e) => setKind(e.target.value as NewBlockKind)}>{palette.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}</select></div>
          {k === 'measuredBranch' ? (
            <div className="form-row"><label>Measured with</label>{sweeps.length ? <select value={sw} onChange={(e) => setSweepId(e.target.value)}>{sweeps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <small>Load the part's sweep first (Sweeps).</small>}</div>
          ) : null}
          <div className="form-row"><label>Where</label><select value={w} onChange={(e) => setWhere(e.target.value as Placement)}>{places.map((p) => <option key={p} value={p}>{sel ? PLACEMENT_LABEL[p] : p === 'inline' ? 'At the end' : 'At the end, to ground'}</option>)}</select></div>
          <button disabled={k === 'measuredBranch' && !sw} onClick={add}>Add the part</button>
          {sel ? (
            <div className="row">
              <button onClick={() => dispatch({ type: 'move', id: sel.id, dir: -1 })}>Move earlier</button>
              <button onClick={() => dispatch({ type: 'move', id: sel.id, dir: 1 })}>Move later</button>
              <button onClick={() => dispatch({ type: 'remove', id: sel.id })}>Remove {sel.label}</button>
            </div>
          ) : null}
        </>
      ))}
      {level === 'engineer' ? step(3, 'Rig settings', <RigSettings state={state} dispatch={dispatch} />) : null}
      {step(level === 'engineer' ? 4 : 3, 'What it predicts', <p>{hasModel(state.chain) ? verdictLine : 'Add parts to get a prediction.'}</p>)}
    </section>
  );
}
```

`src/ui/Workbench.tsx`:
- import `type Task, type WorkTask` from `./Home.tsx` (replacing the `Task` import) and `NewNetworkGuide` from `./NewNetworkGuide.tsx`;
- in `WorkbenchProps`, change `task` to `task: WorkTask` and add `onNewProject: (s: AppState, next: Task) => void`;
- destructure `onNewProject`;
- in the aside, after the safe-power line, add:

```tsx
        {task === 'newNetwork' ? <NewNetworkGuide state={state} dispatch={dispatch} level={level} onNewProject={onNewProject} verdictLine={line} /> : null}
```

`src/ui/App.tsx`:
- import `type AppState` together with `emptyState, reducer` from `../app/state.ts`;
- import `type WorkTask` with `Home, type Task` from `./Home.tsx`;
- set `TASK_TITLE` to:

```ts
const TASK_TITLE: Record<Task, string> = { home: '', newSweep: 'I measured a new sweep', tryChange: 'Try a change first', safePower: 'Safe at full power?', newNetwork: 'Start a new network', pastBuilds: 'Look back at past builds', rigHistory: 'Rig history' };
const WORK: readonly Task[] = ['newSweep', 'tryChange', 'safePower', 'newNetwork'];
```

- add after `openExample`:

```tsx
  /** Makes `s` a new current project; the previous one stays in the library. */
  const newProject = (s: AppState, next: Task): void => {
    dispatch({ type: 'load', state: s });
    setProjectId(newId());
    setTask(next);
  };
```

- render the Workbench only for a work task:

```tsx
      {task === 'home' ? <Home onTask={setTask} /> : null}
      {WORK.includes(task) ? (
        <ErrorBoundary onReset={() => { void openExample(); }}>
          <Workbench task={task as WorkTask} onTask={setTask} onNewProject={newProject} state={state} dispatch={dispatch} level={level} grid={grid} results={results} caches={caches.current} theme={theme} />
        </ErrorBoundary>
      ) : null}
```

- [ ] **Step 5: Run the suite and build**

Run: `npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3`
Expected: PASS, and the build succeeds.

- [ ] **Step 6: Browser gate**

Walk "Start a new network" at all three levels:
1. **Blank:** the drawing shows the cable alone; the result shows the measured-only sentence; step 3/4 reads "Add parts to get a prediction."
2. **Beginner:** add a capacitor bank at the end, then a transformer stack, then electrode plates to ground. The flow drawing grows; the palette offers exactly 4 parts and 2 places.
3. **Builder, C+D:** select the series bank, add an inductance in line after it, then move it earlier, then remove it. The circuit returns to C+D. The verdict line updates.
4. **Engineer, O7:**
   - select `Loop inductance` and add a capacitor (ideal) in parallel with it; the schematic shows the parallel pair beside the measured part;
   - rename the first cable assumption: the fitted-values table keeps its column;
   - change its length to 1.3 m: the column is gone;
   - change the tuner window's resistance-to to 18: the target box widens.
5. **Remove the only part in a branch** (the shunt bank in C+D): the empty branch disappears.
6. **Persistence:** reload, and the new project autosaved. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/templates.ts src/app/templates.test.ts src/ui/NewNetworkGuide.tsx src/ui/RigSettings.tsx src/ui/Home.tsx src/ui/App.tsx src/ui/Workbench.tsx
git commit -m "feat(ui): start a new network from O7, C+D or a blank board; add, place, move and remove parts by level; Engineer rig settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Look back at past builds

**Files:**
- Modify: `src/present/builds.ts` (`buildSweep`), `src/present/builds.test.ts`, `src/project/store.ts` (`listProjects`), `src/ui/Home.tsx`, `src/ui/App.tsx`
- Create: `src/ui/PastBuilds.tsx`

**Interfaces:**
- Consumes: `buildsOf`, `stampOf`, `hasModel` (Task 1); `newProject` (Task 3); `fromProjectJson`; `TargetBox`; `PlotPane`; `VARIANT_COLORS`.
- Produces:
  - `buildSweep(s: Pick<AppState, 'sweeps'>, b: Build): Sweep | undefined`: the build's newest stamped sweep, else its last loaded one;
  - `listProjects(): Promise<LibraryEntry[]>`;
  - `PastBuilds({ current: { id: string | null; state: AppState }, level, onOpen: (id) => void })`.

- [ ] **Step 1: Write the failing test**

Append to `src/present/builds.test.ts`, adding `buildSweep` to the `./builds.ts` import:

```ts
test('a build compares by its newest stamped sweep, else its last one', () => {
  const again = { ...ex.sweeps['o7-80-180-loop'], id: 'again', name: 'x_nanovna-sweep-1791933400391.s1p' };
  const twice = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[4], sweepId: 'again', label: 'again' }], sweeps: { ...ex.sweeps, again } };
  const b = buildsOf(twice);
  assert.equal(buildSweep(twice, b[4])?.id, 'again');
  assert.equal(buildSweep(twice, b[0])?.id, 'o7-130-230');
  assert.equal(buildSweep({ sweeps: {} }, b[0]), undefined, 'a build whose sweeps are gone has nothing to compare');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/present/builds.test.ts 2>&1 | grep -E "^# (pass|fail)|does not provide"`
Expected: FAIL, because `buildSweep` is not exported.

- [ ] **Step 3: Implement**

Append to `src/present/builds.ts`, adding `import type { Sweep } from '../io/sweep.ts';`:

```ts
/** The sweep a build is compared by: its newest stamped one, else the last one still loaded. */
export function buildSweep(s: Pick<AppState, 'sweeps'>, b: Build): Sweep | undefined {
  const loaded = b.sweepIds.map((id) => s.sweeps[id]).filter((x): x is Sweep => x !== undefined);
  return loaded.find((x) => b.newest !== null && stampOf(x.name) === b.newest) ?? loaded.at(-1);
}
```

Run: `node --experimental-strip-types --test src/present/builds.test.ts 2>&1 | grep -E "^# (pass|fail)"`
Expected: PASS.

Append to `src/project/store.ts`:

```ts
export const listProjects = (): Promise<LibraryEntry[]> => tx(PROJECTS, 'readonly', (s) => s.getAll() as IDBRequest<LibraryEntry[]>);
```

Create `src/ui/PastBuilds.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Window } from '../chain/types.ts';
import { type Sweep, zFromGamma } from '../io/sweep.ts';
import { measuredLanding } from '../app/evaluate.ts';
import type { AppState, PaneMode } from '../app/state.ts';
import { buildSweep, buildsOf } from '../present/builds.ts';
import { hasModel } from '../present/circuit.ts';
import type { Level } from '../present/level.ts';
import { landingNearF0, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { fromProjectJson } from '../project/file.ts';
import { listProjects } from '../project/store.ts';
import { VARIANT_COLORS } from './EngineerPanel.tsx';
import { PlotPane } from './PlotPane.tsx';
import { TargetBox } from './TargetBox.tsx';

interface Row { id: string | null; name: string; state: AppState | null; error: string | null }
interface Chosen { key: string; label: string; sweep: Sweep; window: Window }

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const dateText = (ms: number | null): string => (ms === null ? 'date unknown' : new Date(ms).toISOString().slice(0, 10));
const zs = (s: Sweep) => s.gamma.map((g) => zFromGamma(g));

/** "Look back at past builds" (spec §8.5): every project's builds, compare up to two, open one. */
export function PastBuilds({ current, level, onOpen }: { current: { id: string | null; state: AppState }; level: Level; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Chosen[]>([]);
  const [mode, setMode] = useState<PaneMode>('smith');
  useEffect(() => {
    let live = true;
    listProjects().then((list) => {
      if (!live) return;
      setRows(list.filter((e) => e.id !== current.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((e): Row => {
        try {
          return { id: e.id, name: e.name, state: fromProjectJson(e.json).state, error: null };
        } catch (err) {
          return { id: e.id, name: e.name, state: null, error: message(err) };
        }
      }));
    }, (e: unknown) => {
      if (live) setError(`Couldn't read the projects saved in this browser: ${message(e)}`);
    });
    return () => {
      live = false;
    };
  }, [current.id]);
  const all: Row[] = [{ id: current.id, name: current.state.chain.name, state: current.state, error: null }, ...(rows ?? [])];
  const toggle = (c: Chosen): void => setPicked((ps) => (ps.some((x) => x.key === c.key) ? ps.filter((x) => x.key !== c.key) : [...ps, c].slice(-2)));
  const lvl = level === 'beginner' ? 'beginner' : level;
  const verdict = (c: Chosen) => verdictOf(landingNearF0(c.sweep.f, zs(c.sweep), c.window), c.window);
  return (
    <main className="past">
      {error ? <p className="bad">{error}</p> : null}
      {rows === null && !error ? <p>Reading the projects saved in this browser…</p> : null}
      <section className="panel">
        <header className="panel-head"><h3>Compare</h3></header>
        {picked.length ? (
          <>
            {picked.map((c, i) => <p key={c.key} className={`verdict-line ${toneOf(verdict(c).state)}`}><b>{'AB'[i]}: {c.label}.</b> {verdictText(verdict(c), lvl)}</p>)}
            {level === 'engineer' ? (
              <PlotPane mode={mode} onMode={setMode} theme={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} aitWindow={picked[0].window} dots={[]}
                traces={picked.map((c, i) => ({ key: c.key, label: `${'AB'[i]}: ${c.label}`, color: VARIANT_COLORS[i], f: c.sweep.f, z: zs(c.sweep), role: 'measured' as const }))} />
            ) : (
              <TargetBox window={picked[0].window} measured={measuredLanding(picked[0].sweep)?.z ?? null} measuredLabel={`A: ${picked[0].label}`} predicted={null}
                ghost={picked[1] ? measuredLanding(picked[1].sweep)?.z ?? null : null} ghostLabel={picked[1] ? `B: ${picked[1].label}` : ''} />
            )}
          </>
        ) : <p>Tick up to two builds below to compare their sweeps.</p>}
      </section>
      {all.map((r) => {
        const builds = r.state ? buildsOf(r.state) : [];
        return (
          <section className="panel" key={r.id ?? 'current'}>
            <header className="panel-head">
              <h3>{r.name}</h3>
              {r.state ? <small>{hasModel(r.state.chain) ? 'modelled' : 'measured only'}</small> : null}
              {r.id === current.id ? <small>open now</small> : r.id ? <button onClick={() => onOpen(r.id as string)}>Open</button> : null}
            </header>
            {r.error ? <p className="bad">Couldn't read this project: {r.error}</p> : null}
            {r.state && !builds.length ? <small>No sweeps yet.</small> : null}
            {builds.map((b) => {
              const sweep = r.state ? buildSweep(r.state, b) : undefined;
              const key = `${r.id ?? 'current'}:${b.key}`;
              return (
                <label className="check-row" key={key}>
                  <input type="checkbox" disabled={!sweep} checked={picked.some((x) => x.key === key)}
                    onChange={() => { if (sweep && r.state) toggle({ key, label: `${r.name}: ${b.label}`, sweep, window: r.state.window }); }} />
                  {dateText(b.newest)} · {b.label} · {b.sweepIds.length} sweep{b.sweepIds.length === 1 ? '' : 's'}
                </label>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}
```

`src/ui/Home.tsx`: change the past-builds tile's `task: null` to `task: 'pastBuilds'`.

`src/ui/App.tsx`:
- import `PastBuilds` from `./PastBuilds.tsx`;
- add after `newProject`:

```tsx
  const openProject = async (id: string): Promise<void> => {
    try {
      const e = await getProject(id);
      if (!e) throw new Error('it is no longer saved in this browser');
      dispatch({ type: 'load', state: fromProjectJson(e.json).state });
      setProjectId(id);
      setTask('home');
    } catch (e) {
      setNotice(`Couldn't open that project: ${message(e)}`);
    }
  };
```

- render, after the Home line:

```tsx
      {task === 'pastBuilds' ? <PastBuilds current={{ id: projectId, state }} level={level} onOpen={(id) => { void openProject(id); }} /> : null}
```

Add to `src/ui/app.css`, next to the `.home` rules:

```css
.past { display: grid; gap: 12px; padding: 12px; max-width: 980px; margin: 0 auto; }
```

- [ ] **Step 4: Run the suite and build**

Run: `npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3`
Expected: PASS, and the build succeeds.

- [ ] **Step 5: Browser gate**

Start from a fresh library (`indexedDB.deleteDatabase('rf-network-modeller')`, reload).
1. Make a second project ("Start a new network", C+D). Open Past builds:
   - the current project is first, marked "open now";
   - the O7 example is below it, with its 5 builds reading "date unknown" (the example files carry no stamp), their parts, and "1 sweep";
   - it is marked "modelled".
2. **Builder:** tick the 130/230 and 80/180 builds. The target box shows A and B with two verdict lines. Ticking a third drops the oldest.
3. **Engineer:** the same two show as two measured traces on the Smith chart.
4. **Open:** open the O7 example. The top bar name changes and Home shows. Reload: the O7 example is still the current project.
5. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/present/builds.ts src/present/builds.test.ts src/project/store.ts src/ui/PastBuilds.tsx src/ui/Home.tsx src/ui/App.tsx src/ui/app.css
git commit -m "feat(ui): look back at past builds: every project's builds with date, parts and sweeps; compare two; open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: History manifest, index, CSV conversion and the import plan (pure)

**Files:**
- Create:
  - `src/history/manifest.ts`, `src/history/manifest.test.ts`;
  - fixtures captured from the real folder (Step 1):
    - `fixtures/history/vna-export-header.csv`;
    - `fixtures/history/vna-export-plain.csv`;
    - `fixtures/history/telemetry.csv`;
    - `fixtures/history/table.csv`.

**Interfaces:**
- Produces, from `src/history/manifest.ts`:

```ts
export type SweepKind = 'network' | 'network+tuner' | 'branch' | 'calibration' | 'short' | 'other';
export type LoadKind = 'cube' | 'electrodes' | 'none' | 'unknown';
export interface Rig { transformer: string; turns: string; cores: string; plates: string }
export interface ManifestSweep { file: string; kind: SweepKind; series_pF: number | null; shunt_pF: number | null; loop: boolean | null; load: LoadKind; condition: string | null; label: string; evidence: string; uncertain: string | null; csvFormat: 'vna-export' | 'telemetry' | 'table' | null }
export interface ManifestSession { id: string; dir: string; date: string | null; title: string; rig: Rig; evidence: string; modelPreset: 'o7' | 'cd' | null; sweeps: ManifestSweep[] }
export interface Manifest { format: 'rfnm-history/1'; source: string; sessions: ManifestSession[] }
export interface IndexSweep extends Omit<ManifestSweep, 'file' | 'csvFormat'> { path: string; sources: string[]; converted: boolean }
export interface Skipped { file: string; reason: string }
export interface IndexSession extends Omit<ManifestSession, 'dir' | 'sweeps'> { sweeps: IndexSweep[]; skipped: Skipped[] }
export interface HistoryIndex { format: 'rfnm-history-index/1'; source: string; sessions: IndexSession[] }
export function validateManifest(x: unknown): Manifest;               // throws Error('manifest: <where>: <problem>')
export function sessionOrder<T extends { id: string; date: string | null }>(s: readonly T[]): T[]; // newest first, undated last
export function csvKind(text: string): 'vna-export' | 'telemetry' | 'table';
export function csvToS1p(text: string, name: string): string;          // S11-only Touchstone 1.x, numbers copied verbatim
export function sameS11(a: Touchstone, b: Touchstone): boolean;
export interface PlannedSession { session: IndexSession; files: { path: string; text: string }[] }
export function planSession(s: ManifestSession, texts: Record<string, string | undefined>): PlannedSession;
export function parseIndex(text: string): HistoryIndex;               // throws Error("the rig history file isn't in the expected format")
```

In `planSession`:
- `texts` is keyed by each sweep's session-relative `file`;
- output `path`s are `<session id>/<file>`, with `.csv` becoming `.s1p`;
- `sources` are source-root-relative (`<dir>/<file>`, or `<file>` when `dir` is `''`).

- [ ] **Step 1: Capture the fixtures from the real folder**

These are real data, not invented (data-contract rule 3). `M` is the read-only source:

```bash
M="/Users/mattmccoy/GaTech Dropbox/Matthew McCoy/mattmccoy-research/research/binderjet/experiments/rf_sintering/MANUAL_MATCHING_NETWORK"
mkdir -p fixtures/history
head -8 "$M/2026-08-25/mounted_300pF_seriesshuntcap_9to1trans_test5_nanovna-sweep-1787696761263.csv" > fixtures/history/vna-export-header.csv
head -4 "$M/2026-08-25/mounted_300pF_seriesshuntcap_9to1trans_test3_nanovna-sweep-1787693115696.csv" > fixtures/history/vna-export-plain.csv
head -2 "$M/2026-10-01_218-2core-mat67_100ser-330sh/10W_sweep_pickoff_probe_20261001_162905_RF_20261001_162905_telemetry.csv" > fixtures/history/telemetry.csv
head -2 "$M/2026-10-10_DESIGN_SPACE/sweep_configs.csv" > fixtures/history/table.csv
wc -l fixtures/history/*
```

Expected:
- `vna-export-header.csv` has 8 lines: 4 `#` lines, the header and 3 rows;
- `vna-export-plain.csv` has 4 lines: the header and 3 rows;
- the other two have 2 lines each.

- [ ] **Step 2: Write the failing tests**

Create `src/history/manifest.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseS1p } from '../io/s1p.ts';
import { ROOT } from '../testutil.ts';
import { type ManifestSession, csvKind, csvToS1p, parseIndex, planSession, sameS11, sessionOrder, validateManifest } from './manifest.ts';

const fx = (n: string): string => readFileSync(new URL(`fixtures/history/${n}`, ROOT), 'utf8');
const sweep = (file: string, over: object = {}) => ({ file, kind: 'network', series_pF: null, shunt_pF: null, loop: null, load: 'unknown', condition: null, label: file, evidence: 'file name', uncertain: null, csvFormat: file.endsWith('.csv') ? 'vna-export' : null, ...over });
const session = (sweeps: object[], over: object = {}): ManifestSession => ({ id: '2026-08-25', dir: '2026-08-25', date: '2026-08-25', title: 't', rig: { transformer: 'unknown', turns: 'unknown', cores: 'unknown', plates: 'unknown' }, evidence: 'file names only', modelPreset: null, sweeps, ...over }) as ManifestSession;
const manifest = (sessions: object[]) => ({ format: 'rfnm-history/1', source: 'MANUAL_MATCHING_NETWORK', sessions });

test('validateManifest accepts a curated session and names the session and file of a bad sweep', () => {
  assert.equal(validateManifest(manifest([session([sweep('a.s1p')])])).sessions.length, 1);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { kind: 'tuned' })])])), /2026-08-25.*a\.s1p.*kind/);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { evidence: '' })])])), /a\.s1p.*evidence/);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { series_pF: '300' })])])), /a\.s1p.*series_pF/);
  assert.throws(() => validateManifest(manifest([session([]), session([])])), /duplicate session id 2026-08-25/);
  assert.throws(() => validateManifest({ format: 'x', sessions: [] }), /format/);
});

test('sessions run newest first, undated last', () => {
  const order = sessionOrder([{ id: 'a', date: '2026-08-25' }, { id: 'root', date: null }, { id: 'b', date: '2026-10-13' }]);
  assert.deepEqual(order.map((s) => s.id), ['b', 'a', 'root']);
});

test('CSV kinds come from the header of captured real files (review focus 4)', () => {
  assert.equal(csvKind(fx('vna-export-header.csv')), 'vna-export');
  assert.equal(csvKind(fx('vna-export-plain.csv')), 'vna-export');
  assert.equal(csvKind(fx('telemetry.csv')), 'telemetry');
  assert.equal(csvKind(fx('table.csv')), 'table');
});

test('a VNA export converts to an S11-only .s1p with its numbers copied verbatim', () => {
  const out = csvToS1p(fx('vna-export-header.csv'), 'x.csv');
  assert.match(out, /^! S11 from x\.csv/);
  assert.match(out, /^# HZ S RI R 50$/m);
  assert.match(out, /^10000000 -0\.35031968 0\.882837888$/m);
  const t = parseS1p(out);
  assert.equal(t.f.length, 3);
  assert.ok(sameS11(t, parseS1p(csvToS1p(fx('vna-export-header.csv'), 'y.csv'))));
  assert.ok(!sameS11(t, parseS1p(csvToS1p(fx('vna-export-plain.csv'), 'z.csv'))));
});

test('the import plan keeps Touchstone files, collapses identical copies, converts new CSV sweeps and skips the rest with reasons', () => {
  const csv = fx('vna-export-header.csv');
  const s1p = csvToS1p(fx('vna-export-plain.csv'), 'p.csv');
  const s = session([
    sweep('a_nanovna-sweep-1787693115696.s1p'),
    sweep('00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p', { label: 'duplicate' }),
    sweep('a_nanovna-sweep-1787693115696.csv'),
    sweep('b_nanovna-sweep-1787696761263.csv'),
    sweep('b-again.txt'),
    sweep('fullcyl_T1', { kind: 'network+tuner' }),
    sweep('power_telemetry.csv', { csvFormat: 'telemetry', kind: 'other' }),
    sweep('gone.s1p'),
  ]);
  const p = planSession(s, {
    'a_nanovna-sweep-1787693115696.s1p': s1p,
    '00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p': s1p,
    'a_nanovna-sweep-1787693115696.csv': fx('vna-export-plain.csv'),
    'b_nanovna-sweep-1787696761263.csv': csv,
    'b-again.txt': csv.replace('# Device: 1.2.44\n', ''),
    fullcyl_T1: csvToS1p(csv, 'c.csv'),
    'power_telemetry.csv': fx('telemetry.csv'),
  });
  assert.deepEqual(p.session.sweeps.map((w) => [w.path, w.converted, w.sources.length]), [
    ['2026-08-25/a_nanovna-sweep-1787693115696.s1p', false, 2],
    ['2026-08-25/fullcyl_T1.s1p', false, 1],
  ]);
  assert.deepEqual(p.session.sweeps[0].sources, ['2026-08-25/a_nanovna-sweep-1787693115696.s1p', '2026-08-25/00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p']);
  assert.deepEqual(p.files.map((f) => f.path), p.session.sweeps.map((w) => w.path));
  assert.deepEqual(p.session.skipped.map((k) => [k.file, k.reason]), [
    ['gone.s1p', 'missing from the source folder'],
    ['a_nanovna-sweep-1787693115696.csv', 'same data as a_nanovna-sweep-1787693115696.s1p'],
    ['b_nanovna-sweep-1787696761263.csv', 'same data as fullcyl_T1'],
    ['b-again.txt', 'same data as fullcyl_T1'],
    ['power_telemetry.csv', 'generator or scope telemetry, not a sweep'],
  ]);
});

test('a CSV sweep with new data is converted; one save stamp shared by different data keeps both (real 08-25 case)', () => {
  const p = planSession(session([
    sweep('mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p'),
    sweep('mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p'),
    sweep('x.txt'),
  ]), {
    'mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p': csvToS1p(fx('vna-export-plain.csv'), 'p.csv'),
    'mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p': csvToS1p(fx('vna-export-header.csv'), 'h.csv'),
    'x.txt': fx('vna-export-plain.csv').replace('-0.381344608', '-0.381'),
  });
  assert.deepEqual(p.session.sweeps.map((w) => [w.path, w.converted]), [
    ['2026-08-25/mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p', false],
    ['2026-08-25/mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p', false],
    ['2026-08-25/x.s1p', true],
  ]);
  assert.deepEqual(p.session.skipped, []);
});

test('the undated root session reads its files from the folder root', () => {
  const p = planSession(session([sweep('IN-BOX_BASELINE_nocap_PLA.s1p', { kind: 'other' })], { id: 'undated-root', dir: '', date: null }), { 'IN-BOX_BASELINE_nocap_PLA.s1p': csvToS1p(fx('vna-export-plain.csv'), 'p.csv') });
  assert.deepEqual(p.session.sweeps[0].sources, ['IN-BOX_BASELINE_nocap_PLA.s1p']);
  assert.equal(p.session.sweeps[0].path, 'undated-root/IN-BOX_BASELINE_nocap_PLA.s1p');
});

test('parseIndex reads the importer output and rejects anything else', () => {
  assert.equal(parseIndex(JSON.stringify({ format: 'rfnm-history-index/1', source: 's', sessions: [] })).sessions.length, 0);
  assert.throws(() => parseIndex('{"format":"rfnm/1"}'), /expected format/);
  assert.throws(() => parseIndex('<html>'), /expected format/);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --experimental-strip-types --test src/history/manifest.test.ts 2>&1 | grep -E "^# (pass|fail)|Cannot find"`
Expected: FAIL, because `./manifest.ts` can't be found.

- [ ] **Step 4: Implement**

Create `src/history/manifest.ts` (the CSV/Touchstone split is by content and duplicates are by data; see the ledger rulings from the curation reports):

```ts
import { type Touchstone, parseS1p } from '../io/s1p.ts';

/* types exactly as in the Interfaces block above */

const KINDS: readonly SweepKind[] = ['network', 'network+tuner', 'branch', 'calibration', 'short', 'other'];
const LOADS: readonly LoadKind[] = ['cube', 'electrodes', 'none', 'unknown'];
const CSV_FORMATS = ['vna-export', 'telemetry', 'table', null];

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): boolean => v === null || str(v);
const numOrNull = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v));

function check(ok: boolean, where: string, problem: string): asserts ok {
  if (!ok) throw new Error(`manifest: ${where}: ${problem}`);
}

/** Validates the curated manifest (spec §10): every field present and of its type, every sweep with evidence. */
export function validateManifest(x: unknown): Manifest {
  check(isObj(x) && x.format === 'rfnm-history/1', 'top level', 'format must be rfnm-history/1');
  check(str(x.source) && Array.isArray(x.sessions), 'top level', 'needs source and sessions');
  const ids = new Set<string>();
  for (const s of x.sessions as unknown[]) {
    check(isObj(s) && str(s.id) && s.id !== '', 'session', 'needs an id');
    const at = `session ${s.id}`;
    check(!ids.has(s.id), at, `duplicate session id ${s.id}`);
    ids.add(s.id);
    check(str(s.dir), at, 'dir must be text');
    check(s.date === null || (str(s.date) && /^\d{4}-\d{2}-\d{2}$/.test(s.date)), at, 'date must be YYYY-MM-DD or null');
    check(str(s.title) && str(s.evidence) && s.evidence !== '', at, 'needs a title and evidence');
    check(isObj(s.rig) && ['transformer', 'turns', 'cores', 'plates'].every((k) => str((s.rig as J)[k])), at, 'rig needs transformer, turns, cores and plates as text');
    check(s.modelPreset === null || s.modelPreset === 'o7' || s.modelPreset === 'cd', at, 'modelPreset must be o7, cd or null');
    check(Array.isArray(s.sweeps), at, 'needs sweeps');
    for (const w of s.sweeps as unknown[]) {
      check(isObj(w) && str(w.file) && w.file !== '', at, 'a sweep needs a file');
      const wa = `${at} sweep ${w.file}`;
      check(KINDS.includes(w.kind as SweepKind), wa, `kind must be one of ${KINDS.join(', ')}`);
      check(numOrNull(w.series_pF), wa, 'series_pF must be a number or null');
      check(numOrNull(w.shunt_pF), wa, 'shunt_pF must be a number or null');
      check(w.loop === null || typeof w.loop === 'boolean', wa, 'loop must be true, false or null');
      check(LOADS.includes(w.load as LoadKind), wa, `load must be one of ${LOADS.join(', ')}`);
      check(strOrNull(w.condition) && strOrNull(w.uncertain), wa, 'condition and uncertain must be text or null');
      check(str(w.label) && w.label !== '', wa, 'needs a label');
      check(str(w.evidence) && w.evidence !== '', wa, 'needs evidence');
      check(CSV_FORMATS.includes(w.csvFormat as string | null), wa, 'csvFormat must be vna-export, telemetry, table or null');
    }
  }
  return x as unknown as Manifest;
}

/** Newest first; undated sessions last (spec §10). */
export const sessionOrder = <T extends { id: string; date: string | null }>(s: readonly T[]): T[] =>
  [...s].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date === null ? 1 : b.date === null ? -1 : b.date.localeCompare(a.date)));

/** The first row that is not blank or a comment ('#' in VNA exports, '!' in Touchstone), split on commas. */
const headerOf = (text: string): string[] => (text.split(/\r?\n/).find((l) => l.trim() !== '' && !/^\s*[#!]/.test(l)) ?? '').split(',').map((c) => c.trim());

/** A CSV's kind from its header row: a NanoVNA web export, generator or scope telemetry, or an analysis table. */
export function csvKind(text: string): 'vna-export' | 'telemetry' | 'table' {
  const h = headerOf(text);
  if (['frequency_hz', 's11_real', 's11_imag'].every((c) => h.includes(c))) return 'vna-export';
  return h[0] === 'host_timestamp_ns' ? 'telemetry' : 'table';
}

/** A VNA export as an S11-only Touchstone 1.x file; the numbers are copied as written, never reformatted. */
export function csvToS1p(text: string, name: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('#'));
  const h = lines[0].split(',').map((c) => c.trim());
  const [fi, ri, ii] = ['frequency_hz', 's11_real', 's11_imag'].map((c) => h.indexOf(c));
  const rows = lines.slice(1).map((l) => {
    const c = l.split(',');
    return `${c[fi].trim()} ${c[ri].trim()} ${c[ii].trim()}`;
  });
  return [`! S11 from ${name}, converted by the rf-network-modeller history importer`, '# HZ S RI R 50', ...rows, ''].join('\n');
}

/** Same frequencies and the same reflection to 1e-6: one sweep saved twice. */
export const sameS11 = (a: Touchstone, b: Touchstone): boolean =>
  a.f.length === b.f.length && a.f.every((f, i) => Math.abs(f - b.f[i]) < 1e-3 && Math.abs(a.gamma[i].re - b.gamma[i].re) < 1e-6 && Math.abs(a.gamma[i].im - b.gamma[i].im) < 1e-6);

const SKIP_CSV: Record<'telemetry' | 'table', string> = { telemetry: 'generator or scope telemetry, not a sweep', table: 'an analysis table, not a sweep' };
const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const asS1p = (f: string): string => `${f.replace(/\.(csv|txt|s1p)$/i, '')}.s1p`;

/**
 * What one session imports (spec §10). A file is a CSV when its header row is comma-separated, whatever its extension
 * (some sweeps are .txt or have none). Touchstone files come first, then VNA-export CSVs whose data no kept file holds:
 * a shared save stamp is not proof of the same sweep (three 08-25 files share one with different data). Identical copies
 * collapse to one sweep listing every source; every skip has its reason.
 */
export function planSession(s: ManifestSession, texts: Record<string, string | undefined>): PlannedSession {
  const src = (file: string): string => (s.dir ? `${s.dir}/${file}` : file);
  const kept: { w: IndexSweep; raw: string; text: string; t: Touchstone; file: string }[] = [];
  const skipped: Skipped[] = [];
  const read = s.sweeps.map((m) => ({ m, raw: texts[m.file] }));
  for (const { m } of read.filter((r) => r.raw === undefined)) skipped.push({ file: m.file, reason: 'missing from the source folder' });
  const present = read.filter((r): r is { m: ManifestSweep; raw: string } => r.raw !== undefined).map((r) => ({ ...r, csv: headerOf(r.raw).length > 1 }));
  for (const { m, raw, csv } of [...present.filter((r) => !r.csv), ...present.filter((r) => r.csv)]) {
    const ck = csv ? csvKind(raw) : 'vna-export';
    if (ck !== 'vna-export') {
      skipped.push({ file: m.file, reason: SKIP_CSV[ck] });
      continue;
    }
    const twin = kept.find((k) => k.raw === raw);
    if (twin) {
      twin.w.sources.push(src(m.file));
      continue;
    }
    const text = csv ? csvToS1p(raw, baseName(m.file)) : raw;
    let t: Touchstone;
    try {
      t = parseS1p(text);
    } catch (e) {
      skipped.push({ file: m.file, reason: `unreadable: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const same = csv ? kept.find((k) => sameS11(k.t, t)) : undefined;
    if (same) {
      skipped.push({ file: m.file, reason: `same data as ${same.file}` });
      continue;
    }
    let path = `${s.id}/${asS1p(m.file)}`;
    for (let n = 2; kept.some((k) => k.w.path === path); n += 1) path = `${s.id}/${asS1p(m.file).replace(/\.s1p$/, `-${n}.s1p`)}`;
    const { file: _f, csvFormat: _c, ...meta } = m;
    kept.push({ w: { ...meta, path, sources: [src(m.file)], converted: csv }, raw, text, t, file: m.file });
  }
  const { dir: _d, sweeps: _s, ...head } = s;
  return { session: { ...head, sweeps: kept.map((k) => k.w), skipped }, files: kept.map((k) => ({ path: k.w.path, text: k.text })) };
}

/** The importer's index, or an error saying it is not one (never an empty history). */
export function parseIndex(text: string): HistoryIndex {
  try {
    const x = JSON.parse(text) as unknown;
    if (isObj(x) && x.format === 'rfnm-history-index/1' && Array.isArray(x.sessions)) return x as unknown as HistoryIndex;
  } catch {
    // fall through to the format error
  }
  throw new Error("the rig history file isn't in the expected format");
}
```

Also export `Touchstone` from `src/io/s1p.ts`; it is already exported.

- [ ] **Step 5: Run the suite and typecheck**

Run: `npm test 2>&1 | tail -4 && npm run typecheck`
Expected: PASS, and the typecheck is clean.

- [ ] **Step 6: Commit**

```bash
git add src/history/manifest.ts src/history/manifest.test.ts fixtures/history
git commit -m "feat(history): manifest validation, newest-first order, VNA-export CSV conversion and the per-session import plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The curated manifest and the importer, run against the real folder

**Files:**
- Create: `history/manifest.json` (assembled from the curation fragments), `tools/history/build.ts`
- Generate: `public/history/index.json`, `public/history/files/**`
- Modify: `package.json` (script `history`)

**Interfaces:**
- Consumes: `validateManifest`, `sessionOrder`, `planSession`, `HistoryIndex` (Task 5).
- Produces: `public/history/index.json` (`rfnm-history-index/1`) and `public/history/files/<session>/<file>.s1p`.

- [ ] **Step 1: Review the fragments and assemble the manifest**

1. **Read each curation fragment** in the session scratchpad `history/` folder. For each session:
   - check that `evidence` cites real notes lines;
   - spot-check three sweeps against their file names;
   - fix wording only:
     - titles, labels and rig text say "tuner", never "AIT";
     - no "variant" and no "landing".
2. **Do not change any value.** A value that looks wrong becomes `null`/`"unknown"` with an `uncertain` reason. Record each such change as a ledger ruling.
3. **Assemble the manifest** with this script:

```bash
python3 - <<'EOF'
import json, glob, os
src = os.environ['FRAG']
sessions = []
for f in sorted(glob.glob(f'{src}/*.json')):
    s = json.load(open(f))
    s['dir'] = '' if s['id'] == 'undated-root' else s['id']
    sessions.append(s)
json.dump({'format': 'rfnm-history/1', 'source': 'experiments/rf_sintering/MANUAL_MATCHING_NETWORK', 'sessions': sessions}, open('history/manifest.json', 'w'), indent=1)
print(len(sessions), 'sessions', sum(len(s['sweeps']) for s in sessions), 'sweeps')
EOF
```

Run it with `FRAG=<scratchpad>/history` after `mkdir -p history`.

Expected: about 21 sessions and about 371 listed files (333 `.s1p` + 38 CSV).

- [ ] **Step 2: Write the importer**

Create `tools/history/build.ts`:

```ts
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type HistoryIndex, planSession, sessionOrder, validateManifest } from '../../src/history/manifest.ts';

/** Builds public/history/ from history/manifest.json and the read-only source folder (spec §10). */
const source = process.argv[2];
if (!source) throw new Error('usage: npm run history -- <path to MANUAL_MATCHING_NETWORK>');
const root = new URL('../../', import.meta.url).pathname;
const manifest = validateManifest(JSON.parse(readFileSync(join(root, 'history/manifest.json'), 'utf8')));
const out = join(root, 'public/history');
rmSync(out, { recursive: true, force: true });

const read = (p: string): string | undefined => {
  try {
    return readFileSync(join(source, p), 'utf8');
  } catch {
    return undefined;
  }
};
const index: HistoryIndex = { format: 'rfnm-history-index/1', source: manifest.source, sessions: [] };
let files = 0;
for (const s of sessionOrder(manifest.sessions)) {
  const p = planSession(s, Object.fromEntries(s.sweeps.map((w) => [w.file, read(s.dir ? `${s.dir}/${w.file}` : w.file)])));
  for (const f of p.files) {
    mkdirSync(dirname(join(out, 'files', f.path)), { recursive: true });
    writeFileSync(join(out, 'files', f.path), f.text);
  }
  files += p.files.length;
  index.sessions.push(p.session);
}
writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

// Coverage: every sweep-like file in the source folder should be listed in the manifest.
const listed = new Set(manifest.sessions.flatMap((s) => s.sweeps.map((w) => (s.dir ? `${s.dir}/${w.file}` : w.file))));
const walk = (d: string): string[] => readdirSync(join(source, d)).flatMap((n) => {
  const rel = d ? `${d}/${n}` : n;
  return statSync(join(source, rel)).isDirectory() ? walk(rel) : [rel];
});
const unlisted = walk('').filter((p) => /\.s1p$/i.test(p) || /sweep.*\.csv$/i.test(p)).filter((p) => !listed.has(p));
const skipped = index.sessions.flatMap((s) => s.skipped);
const reasons = new Map<string, number>();
for (const k of skipped) reasons.set(k.reason.replace(/ as .*| \(.*/, ''), (reasons.get(k.reason.replace(/ as .*| \(.*/, '')) ?? 0) + 1);
const sweeps = index.sessions.flatMap((s) => s.sweeps);
console.log(`${index.sessions.length} sessions; ${files} sweep files written (${sweeps.filter((w) => w.converted).length} converted from CSV; ${sweeps.reduce((n, w) => n + w.sources.length - 1, 0)} identical copies collapsed)`);
console.log(`skipped ${skipped.length}:`, Object.fromEntries(reasons));
console.log(`files in the source folder not in the manifest: ${unlisted.length}`, unlisted.slice(0, 10));
```

Add to `package.json` scripts: `"history": "node --experimental-strip-types tools/history/build.ts"`.

- [ ] **Step 3: Run it against the real folder**

```bash
npm run history -- "/Users/mattmccoy/GaTech Dropbox/Matthew McCoy/mattmccoy-research/research/binderjet/experiments/rf_sintering/MANUAL_MATCHING_NETWORK"
du -sh public/history && git status --short public/history | wc -l
```

Expected:
- about 21 sessions;
- sweep files written = 333 `.s1p` minus collapsed copies, plus the converted CSVs;
- the skipped list has about 18 telemetry/table CSVs plus the CSV duplicates;
- **0** files not in the manifest. If any are unlisted, record them as a ledger ruling and do not invent their metadata;
- about 20 MB in `public/history`.

Then read `public/history/index.json` for two sessions and confirm:
- an Aug-26 session lists the `00_ORIGINAL_EXPORTS` copies as extra `sources`;
- a telemetry CSV is in `skipped` with its reason.

Run `git diff --stat -- "$M"` as a sanity check: there is no repo there, so instead confirm that `find "$M" -newer history/manifest.json -type f | wc -l` is 0, which means nothing in the source folder was written.

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | tail -4`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add history/manifest.json tools/history/build.ts package.json public/history
git commit -m "feat(history): curated rig-history manifest and importer; bundle every past sweep (read-only copy of MANUAL_MATCHING_NETWORK)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Rig history view (Engineer only) and "Open a copy"

**Files:**
- Create: `src/history/copy.ts`, `src/history/copy.test.ts`, `src/ui/RigHistory.tsx`
- Modify: `src/ui/Home.tsx`, `src/ui/App.tsx`

**Interfaces:**
- Consumes: `IndexSession`, `parseIndex` (Task 5); `public/history/` (Task 6); `newProject` (Task 3); `hasModel`, `buildsOf` (Task 1).
- Produces:
  - `historyUrl(path: string): string`;
  - `historyCopy(s: IndexSession, texts: Record<string, string>): AppState`. The copy is a measured-only project. Every sweep is loaded. Only `network` sweeps are tagged: a sweep has a verdict only when no tuner is in the path. The active sweep is the last tagged one.
  - `Home({ onTask, level })`, which shows the Rig history tile at Engineer only.

- [ ] **Step 1: Write the failing test**

Create `src/history/copy.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROOT } from '../testutil.ts';
import { buildsOf } from '../present/builds.ts';
import { activeIsMeasured, hasModel } from '../present/circuit.ts';
import { historyCopy, historyUrl } from './copy.ts';
import { parseIndex } from './manifest.ts';

const index = parseIndex(readFileSync(new URL('public/history/index.json', ROOT), 'utf8'));
const texts = (paths: string[]) => Object.fromEntries(paths.map((p) => [p, readFileSync(new URL(`public/history/files/${p}`, ROOT), 'utf8')]));

test('a copy of a real session is measured only, tags its network sweeps, and shows the last one (review focus 1)', () => {
  const s = index.sessions.find((x) => x.sweeps.filter((w) => w.kind === 'network').length >= 2);
  assert.ok(s, 'the bundled history has a session with network sweeps');
  const st = historyCopy(s, texts(s.sweeps.map((w) => w.path)));
  const network = s.sweeps.filter((w) => w.kind === 'network');
  assert.equal(hasModel(st.chain), false);
  assert.equal(Object.keys(st.sweeps).length, s.sweeps.length, 'every sweep is loaded, also the ones that are not tagged');
  assert.deepEqual(st.tagged.map((t) => t.label), network.map((w) => w.label));
  assert.equal(st.activeSweep, st.tagged.at(-1)?.sweepId);
  assert.ok(activeIsMeasured(st.chain, st.tagged, st.activeSweep), 'the measured verdict applies to the copy as opened');
  assert.ok(buildsOf(st).length >= 1);
});

test('a session with no network sweeps opens with nothing tagged and no active sweep', () => {
  const s = index.sessions.find((x) => x.sweeps.length > 0 && x.sweeps.every((w) => w.kind !== 'network'));
  assert.ok(s, 'the bundled history has such a session');
  const st = historyCopy(s, texts(s.sweeps.map((w) => w.path)));
  assert.deepEqual(st.tagged, []);
  assert.equal(st.activeSweep, null);
});

test('history file paths are URL-encoded segment by segment', () => {
  assert.equal(historyUrl('2026-08-26/00_ORIGINAL_EXPORTS/300 300#1.s1p'), 'history/files/2026-08-26/00_ORIGINAL_EXPORTS/300%20300%231.s1p');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --experimental-strip-types --test src/history/copy.test.ts 2>&1 | grep -E "^# (pass|fail)|Cannot find"`
Expected: FAIL, because `./copy.ts` can't be found.

- [ ] **Step 3: Implement the copy**

Create `src/history/copy.ts`:

```ts
import type { Sweep } from '../io/sweep.ts';
import { type AppState, emptyState } from '../app/state.ts';
import { sweepFromFile } from '../app/sweepFile.ts';
import { structureKey } from '../present/circuit.ts';
import type { IndexSession } from './manifest.ts';

/** A bundled history file's URL, relative to the site root. */
export const historyUrl = (path: string): string => `history/files/${path.split('/').map(encodeURIComponent).join('/')}`;

/**
 * A session as a measured-only project (spec §8.6): the cable alone, every sweep loaded, and only the network sweeps tagged,
 * because only a sweep with no tuner in the path has a verdict at the tuner.
 */
export function historyCopy(s: IndexSession, texts: Record<string, string>): AppState {
  const chain = { name: `${s.title} (rig history copy)`, blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] };
  const sweeps: Record<string, Sweep> = {};
  const tagged: AppState['tagged'] = [];
  for (const w of s.sweeps) {
    const text = texts[w.path];
    if (text === undefined) throw new Error(`${w.path} was not fetched`);
    const sweep = sweepFromFile(w.path.slice(w.path.lastIndexOf('/') + 1), text, sweeps);
    sweeps[sweep.id] = sweep;
    if (w.kind === 'network') tagged.push({ sweepId: sweep.id, label: w.label, state: {}, include: true, structure: structureKey(chain) });
  }
  return { ...emptyState(), chain, sweeps, tagged, activeSweep: tagged.at(-1)?.sweepId ?? null };
}
```

Run: `node --experimental-strip-types --test src/history/copy.test.ts 2>&1 | grep -E "^# (pass|fail)"`
Expected: PASS (3/3).

- [ ] **Step 4: Implement the view**

The UI wiring is not unit-testable; the gate is the browser check in Step 6.

Create `src/ui/RigHistory.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { AppState } from '../app/state.ts';
import { historyCopy, historyUrl } from '../history/copy.ts';
import { type HistoryIndex, type IndexSession, type SweepKind, parseIndex } from '../history/manifest.ts';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const KIND: Record<SweepKind, string> = {
  network: 'network, no tuner in the path',
  'network+tuner': 'tuner in the path: not comparable to predictions',
  branch: 'measured part, no matching capacitors',
  calibration: 'calibration standard',
  short: 'shorted cable',
  other: 'other',
};
const PRESET: Record<'o7' | 'cd', string> = { o7: 'O7 as built', cd: 'C+D 2:18 two-core' };
const pf = (v: number | null): string => (v === null ? 'unknown' : `${v} pF`);

/** Rig history (spec §8.6, §10): every configuration ever swept, read-only, newest first; a session opens as a copy. */
export function RigHistory({ onCopy }: { onCopy: (s: AppState) => void }) {
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    fetch('history/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => { if (live) setIndex(parseIndex(t)); }, (e: unknown) => { if (live) setError(`Couldn't load the rig history: ${message(e)}`); });
    return () => {
      live = false;
    };
  }, []);
  const copy = async (s: IndexSession): Promise<void> => {
    setStatus((m) => ({ ...m, [s.id]: `Fetching ${s.sweeps.length} sweeps…` }));
    try {
      const texts = Object.fromEntries(await Promise.all(s.sweeps.map(async (w) => {
        const r = await fetch(historyUrl(w.path));
        if (!r.ok) throw new Error(`${w.path}: HTTP ${r.status}`);
        return [w.path, await r.text()] as const;
      })));
      onCopy(historyCopy(s, texts));
    } catch (e) {
      setStatus((m) => ({ ...m, [s.id]: `Couldn't open a copy: ${message(e)}` }));
    }
  };
  if (error) return <main className="past"><p className="bad">{error}</p></main>;
  if (!index) return <main className="past"><p>Loading the rig history…</p></main>;
  return (
    <main className="past">
      <p>{index.sessions.length} sessions, {index.sessions.reduce((n, s) => n + s.sweeps.length, 0)} sweeps, newest first; undated files last. Read-only copies of {index.source}.</p>
      {index.sessions.map((s) => (
        <section className="panel" key={s.id}>
          <header className="panel-head">
            <h3>{s.date ?? 'date unknown'}: {s.title}</h3>
            <button disabled={!s.sweeps.length} onClick={() => { void copy(s); }}>Open a copy</button>
          </header>
          {status[s.id] ? <small>{status[s.id]}</small> : null}
          <small>Transformer: {s.rig.transformer} · turns: {s.rig.turns} · cores: {s.rig.cores} · plates: {s.rig.plates}</small>
          {s.modelPreset ? <small>Modelled by the "{PRESET[s.modelPreset]}" starting point in Start a new network.</small> : null}
          <details>
            <summary>{s.sweeps.length} sweeps{s.skipped.length ? `, ${s.skipped.length} files not imported` : ''}</summary>
            {s.sweeps.map((w) => (
              <p key={w.path}>
                <b>{w.label}</b> · {KIND[w.kind]} · series {pf(w.series_pF)}, shunt {pf(w.shunt_pF)} · loop {w.loop === null ? 'unknown' : w.loop ? 'on' : 'off'} · load {w.load}{w.condition ? ` · ${w.condition}` : ''}
                {w.uncertain ? <small className="warn-text"> Uncertain: {w.uncertain}</small> : null}
                <small> Evidence: {w.evidence}{w.sources.length > 1 ? `; identical copies: ${w.sources.slice(1).join(', ')}` : ''}{w.converted ? '; converted from a VNA export CSV' : ''}</small>
              </p>
            ))}
            {s.skipped.map((k) => <p key={k.file}><small>Not imported: {k.file}: {k.reason}</small></p>)}
            <small>Session evidence: {s.evidence}</small>
          </details>
        </section>
      ))}
    </main>
  );
}
```

`src/ui/Home.tsx`:
- import `type Level` from `../present/level.ts`;
- add `engineerOnly?: boolean` to the tile type;
- append the tile `{ task: 'rigHistory', title: 'Rig history', text: 'Every configuration ever swept, read-only', engineerOnly: true }`;
- change the signature to `Home({ onTask, level }: { onTask: (t: Task) => void; level: Level })`;
- filter with `TILES.filter((t) => !t.engineerOnly || level === 'engineer')`;
- update the doc comment: Rig history shows at Engineer only ("hidden, not private").

`src/ui/App.tsx`:
- import `RigHistory` from `./RigHistory.tsx`;
- render `<Home onTask={setTask} level={level} />`;
- add after the past-builds line:

```tsx
      {task === 'rigHistory' && level === 'engineer' ? <RigHistory onCopy={(s) => newProject(s, 'pastBuilds')} /> : null}
```

- in the level effect, add `setTask((t) => (t === 'rigHistory' && level !== 'engineer' ? 'home' : t));`.

- [ ] **Step 5: Run the suite and build**

Run: `npm test 2>&1 | tail -4 && npm run build 2>&1 | tail -3 && ls dist/history/files | head -3`
Expected: PASS; the build succeeds; `dist/history/files` holds the session folders.

- [ ] **Step 6: Browser gate**

1. **Builder:** Home has 5 tiles and no Rig history.
2. **Engineer:** Home has 6 tiles. Rig history lists the sessions newest first and the undated root files last. Expand a session that has `network+tuner` sweeps: they read "tuner in the path: not comparable to predictions." Unknown fields read "unknown".
3. **Open a copy** of a session with network sweeps. Past builds opens with the copy first, "measured only", and its builds labelled from the manifest.
4. **Home → "I measured a new sweep":**
   - the result panel shows the measured verdict and the measured-only sentence;
   - there is no predicted ring;
   - the Engineer plots show only the measured trace.
5. **Switch to Builder while on Rig history:** Home returns.
6. **Jargon scan:** run `document.body.innerText` over the Rig history page, excluding `Evidence:` and `Not imported:` lines. It has no "AIT", "variant" or "landing".
7. No console errors. Then repeat steps 2–3 on the built site (`npm run preview`).

- [ ] **Step 7: Commit**

```bash
git add src/history/copy.ts src/history/copy.test.ts src/ui/RigHistory.tsx src/ui/Home.tsx src/ui/App.tsx
git commit -m "feat(ui): Engineer-only rig history, read-only, newest first; open a session as a measured-only copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

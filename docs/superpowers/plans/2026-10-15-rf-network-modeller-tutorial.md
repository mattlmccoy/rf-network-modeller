# RF Network Modeller Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Built-in, hands-on tours, one per Home task. They follow the user's level and run on a practice copy of the O7 example, so nothing is saved.

**Architecture:**
- Tour content is data in `src/tour/tours.ts`; pure resolution and completion logic is in `src/tour/run.ts`. Both are TDD'd.
- Existing components gain `data-tour` anchors only. A test guards that every tour target exists.
- `TourOverlay` draws the spotlight and card.
- App owns practice mode: it saves and remembers the open project, opens the O7 example with `projectId` null (so autosave writes nothing), and restores the project on exit.

**Tech Stack:** TypeScript 5.9.3 under Node `--experimental-strip-types`, React 19.2.6, Vite 8.0.13, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-15-rf-network-modeller-tutorial-design.md`

## Global Constraints

- Repo `~/code/put_github_repos_here/rf-network-modeller`, branch `feat/tutorial` off main `4f88c87`. No push from a task.
- `.ts`/`.tsx` import extensions; `import type` for types; no enums or parameter properties.
- No new dependencies. No superfluous code. `src/ui/nanovna.css` is never edited.
- **Step text:**
  - never contains "AIT", "variant" or "landing";
  - never states a model number;
  - Engineer may say "cable assumption".
- **Practice mode never writes to the library.**
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Exit or finish restores the project that was open before the tour,** including when the tour created new projects (a new-network template, a rig-history copy). Pinned by: Task 3 browser gate (library unchanged).
2. **A level change mid-tour** re-resolves the steps without crashing; the index is clamped. Pinned by: Task 1 `stepsFor` + Task 3 gate.
3. **A target missing at the current layout** (phone, other task): the card centres and keeps the instruction. Pinned by: Task 3 gate at 375 px.
4. **A state step must not complete before the user acts.** Its predicate compares against `atStep`. Pinned by: Task 1 predicate tests (not done at `atStep`, done after the action).
5. **Opening a file or library project mid-tour** ends practice, and that project saves normally. Pinned by: Task 3 gate.

---

### Task 1: Tour content and run logic

**Files:**
- Create: `src/tour/tours.ts`, `src/tour/run.ts`, `src/tour/tours.test.ts`

**Interfaces:**
- Produces, in `tours.ts`:
  - `type TourId = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork' | 'pastBuilds' | 'rigHistory'`;
  - `interface StepCtx { state: AppState; atStep: AppState; task: Task; level: Level }`;
  - `type Advance = { kind: 'next' } | { kind: 'click' } | { kind: 'state'; done: (c: StepCtx) => boolean }`;
  - `type PerLevel<T> = T | { beginner?: T; builder?: T; engineer?: T }`;
  - `interface Step { id: string; title: string; text: PerLevel<string>; target: PerLevel<string | null>; advance: Advance; levels?: readonly Level[] }`;
  - `interface Tour { id: TourId; task: Task; title: string; minutes: number; blurb: string; levels: readonly Level[]; steps: readonly Step[] }`;
  - `TOURS: readonly Tour[]`.
- Produces, in `run.ts`:
  - `interface ResolvedStep { id: string; title: string; text: string; target: string | null; advance: Advance }`;
  - `toursFor(level): readonly Tour[]`;
  - `tourById(id): Tour`;
  - `stepsFor(tour, level): ResolvedStep[]`;
  - `stepDone(step, ctx): boolean`.

- [ ] **Step 1: Write the failing tests**

Create `src/tour/tours.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { newBlock } from '../app/chainEdit.ts';
import { type AppState, reducer } from '../app/state.ts';
import { LEVELS, type Level } from '../present/level.ts';
import { loadExampleState } from '../testutil.ts';
import { stepDone, stepsFor, tourById, toursFor } from './run.ts';
import { TOURS, type StepCtx, type TourId } from './tours.ts';

const ex = loadExampleState();
const ctx = (state: AppState, atStep: AppState, task: StepCtx['task'] = 'home', level: Level = 'builder'): StepCtx => ({ state, atStep, task, level });
const step = (tour: TourId, id: string, level: Level = 'builder') => {
  const s = stepsFor(tourById(tour), level).find((x) => x.id === id);
  assert.ok(s, `${tour}/${id} at ${level}`);
  return s;
};

test('every tour has steps at each level it is offered at; every step has plain text', () => {
  for (const t of TOURS) {
    for (const level of t.levels) {
      const steps = stepsFor(t, level);
      assert.ok(steps.length >= 3, `${t.id} at ${level}`);
      for (const s of steps) {
        assert.ok(s.text.length > 20, `${t.id}/${s.id} at ${level} has text`);
        assert.doesNotMatch(s.text, /\bAIT\b|variant|landing/, `${t.id}/${s.id} wording`);
        assert.doesNotMatch(s.text, /\d+(\.\d+)?\s?(Ω|kHz|nH)/, `${t.id}/${s.id} states no model result (impedance, drift room, inductance)`);
      }
    }
  }
});

test('the tour menu follows the level: rig history only at Engineer', () => {
  assert.deepEqual(toursFor('beginner').map((t) => t.id), ['newSweep', 'tryChange', 'safePower', 'newNetwork', 'pastBuilds']);
  assert.deepEqual(toursFor('builder').map((t) => t.id), ['newSweep', 'tryChange', 'safePower', 'newNetwork', 'pastBuilds']);
  assert.equal(toursFor('engineer').at(-1)?.id, 'rigHistory');
  for (const level of LEVELS) for (const t of toursFor(level)) assert.equal(stepsFor(t, level)[0].target, `tile-${t.task}`, 'each tour opens its task from Home');
});

test('steps resolve per level: the result is read where that level shows it; Builder-only steps drop at Beginner', () => {
  assert.equal(step('newSweep', 'verdict', 'beginner').target, 'verdict-card');
  assert.equal(step('newSweep', 'verdict', 'builder').target, 'target-box');
  assert.equal(step('newSweep', 'verdict', 'engineer').target, 'plots');
  const beginnerSafe = stepsFor(tourById('safePower'), 'beginner').map((s) => s.id);
  assert.ok(!beginnerSafe.includes('table') && !beginnerSafe.includes('flux'));
  assert.ok(stepsFor(tourById('safePower'), 'builder').some((s) => s.id === 'flux'));
});

test('state steps complete only after the user acts, never at the state they started from (review focus 4)', () => {
  const open = step('newSweep', 'open');
  assert.equal(stepDone(open, ctx(ex, ex, 'home')), false);
  assert.equal(stepDone(open, ctx(ex, ex, 'newSweep')), true);

  const pick = step('tryChange', 'pick');
  assert.equal(stepDone(pick, ctx(ex, ex, 'tryChange')), false);
  assert.equal(stepDone(pick, ctx(reducer(ex, { type: 'select', id: 'sh' }), ex, 'tryChange')), true);

  const change = step('tryChange', 'change');
  const picked = reducer(ex, { type: 'select', id: 'sh' });
  assert.equal(stepDone(change, ctx(picked, picked, 'tryChange')), false);
  assert.equal(stepDone(change, ctx(reducer(picked, { type: 'patchBlock', id: 'sh', patch: { customPf: 10 } }), picked, 'tryChange')), true);

  const power = step('safePower', 'power');
  assert.equal(stepDone(power, ctx(ex, ex, 'safePower')), false);
  assert.equal(stepDone(power, ctx(reducer(ex, { type: 'setPower', watts: 300 }), ex, 'safePower')), true);

  const sel = reducer(ex, { type: 'select', id: 'Ls' });
  const added = reducer(sel, { type: 'place', targetId: 'Ls', where: 'inline', block: newBlock(sel.chain, 'inductor') });
  assert.equal(stepDone(step('newNetwork', 'add'), ctx(sel, sel, 'newNetwork')), false);
  assert.equal(stepDone(step('newNetwork', 'add'), ctx(added, sel, 'newNetwork')), true);
  const moved = reducer(added, { type: 'move', id: added.selected as string, dir: -1 });
  assert.equal(stepDone(step('newNetwork', 'move'), ctx(added, added, 'newNetwork')), false);
  assert.equal(stepDone(step('newNetwork', 'move'), ctx(moved, added, 'newNetwork')), true);
  const removed = reducer(moved, { type: 'remove', id: moved.selected as string });
  assert.equal(stepDone(step('newNetwork', 'remove'), ctx(removed, moved, 'newNetwork')), true);

  assert.equal(stepDone(step('rigHistory', 'copy', 'engineer'), ctx(ex, ex, 'rigHistory', 'engineer')), false);
  assert.equal(stepDone(step('rigHistory', 'copy', 'engineer'), ctx(ex, ex, 'pastBuilds', 'engineer')), true);
  assert.equal(stepDone(step('newSweep', 'power'), ctx(ex, ex, 'newSweep')), false, 'look steps never complete on their own');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types --test src/tour/tours.test.ts 2>&1 | grep -E "^ℹ (pass|fail)|Cannot find"`
Expected: FAIL, because `./run.ts` can't be found.

- [ ] **Step 3: Implement**

Create `src/tour/tours.ts`:

```ts
import { allBlocks } from '../chain/state.ts';
import type { AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import type { Task } from '../ui/Home.tsx';

export type TourId = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork' | 'pastBuilds' | 'rigHistory';
/** What a step's completion is judged on: the app now, the app when the step began, the open task and the level. */
export interface StepCtx { state: AppState; atStep: AppState; task: Task; level: Level }
export type Advance = { kind: 'next' } | { kind: 'click' } | { kind: 'state'; done: (c: StepCtx) => boolean };
export type PerLevel<T> = T | { beginner?: T; builder?: T; engineer?: T };
export interface Step { id: string; title: string; text: PerLevel<string>; target: PerLevel<string | null>; advance: Advance; levels?: readonly Level[] }
export interface Tour { id: TourId; task: Task; title: string; minutes: number; blurb: string; levels: readonly Level[]; steps: readonly Step[] }

const ALL: readonly Level[] = ['beginner', 'builder', 'engineer'];
const ABOVE: readonly Level[] = ['builder', 'engineer'];
const ids = (s: AppState): string[] => allBlocks(s.chain.blocks).map((b) => b.id);
const next: Advance = { kind: 'next' };
const click: Advance = { kind: 'click' };
const when = (done: (c: StepCtx) => boolean): Advance => ({ kind: 'state', done });
const open = (task: Task, title: string, text: string): Step => ({ id: 'open', title, text, target: `tile-${task}`, advance: when((c) => c.task === task) });
const DRAWING = { beginner: 'power-flow drawing', builder: 'hardware drawing', engineer: 'schematic' } as const;

/** The tours, one per Home task (spec §5). Text says where to look, never a number. */
export const TOURS: readonly Tour[] = [
  {
    id: 'newSweep', task: 'newSweep', title: 'I measured a new sweep', minutes: 3, levels: ALL,
    blurb: 'Load a sweep, read what it says, and find the next change to make.',
    steps: [
      open('newSweep', 'Open the task', 'Click “I measured a new sweep”. This is the task to use after every VNA sweep.'),
      { id: 'confirm', title: 'Say what is installed', target: 'confirm', advance: click,
        text: 'Step 1 lists the capacitors and the sense loop the app thinks are on the board. If that matches the bench, click “That’s what’s installed”. If not, “Change” lets you fix it first.' },
      { id: 'load', title: 'Load the sweep', target: 'use-sweep', advance: click,
        text: 'Normally you choose the .s1p file the VNA saved. This practice project already has one loaded, so click “Use … (already loaded)”.' },
      { id: 'verdict', title: 'Read the result', advance: next,
        target: { beginner: 'verdict-card', builder: 'target-box', engineer: 'plots' },
        text: {
          beginner: 'The card says in plain words whether the build sits in the tuner’s good range and how much room it has as the part warms. The small line on top says whether that comes from your sweep or from the model.',
          builder: 'The box is the tuner’s good range. Your sweep is the filled dot and the model is the ring. The line under it says whether it lands in range and how much room is left to drift.',
          engineer: 'The plots show the measured trace (dashed) and the model for each cable assumption. Dots mark 13.56 MHz and the shaded patch is the tuner’s good range. The table under them gives the impedance and the room for each.',
        } },
      { id: 'power', title: 'Check the power line', target: 'power-line', advance: next,
        text: 'The line under the verdict checks every capacitor at the planned power. If one would go over its rating, it names the part and the power that keeps it safe.' },
      { id: 'agree', title: 'Does the model agree?', target: 'agree', advance: next,
        text: {
          beginner: 'Step 3 says whether the model matches your sweep. If it does not, refit before trusting the suggestions.',
          builder: 'Step 3 compares the model with your sweep. If it is off, “Refit” fits the model to your sweeps; a warning appears when the sweeps cannot pin the values down, and you can put the old fit back.',
        } },
      { id: 'changes', title: 'What to change', target: 'changes', advance: next,
        text: 'Step 4 lists capacitor changes you can make from your parts on hand, ranked by the model. “Show on drawing” previews one; “Use this” sets the circuit to it so you can build it and sweep again. When nothing in stock helps, it says what limits you.' },
      { id: 'safe', title: 'Safe at full power?', target: 'to-safe', advance: click,
        text: 'Last, “Check it at full power” opens the power check for this build. It has its own tour. Click it to finish this one.' },
    ],
  },
  {
    id: 'tryChange', task: 'tryChange', title: 'Try a change first', minutes: 2, levels: ALL,
    blurb: 'Change a part and see what the VNA would show, before touching the board.',
    steps: [
      open('tryChange', 'Open the task', 'Click “Try a change first”. Use it to check a change before you build it.'),
      { id: 'pick', title: 'Pick a part', target: 'part-sh', advance: when((c) => c.state.selected === 'sh' && c.atStep.selected !== 'sh'),
        text: {
          beginner: 'In the power-flow drawing the matching box is open. Click the “Shunt bank” chip.',
          builder: `Click the shunt bank in the ${DRAWING.builder}.`,
          engineer: `Click the shunt bank in the ${DRAWING.engineer}.`,
        } },
      { id: 'change', title: 'Change it', target: 'part-editor', advance: when((c) => c.state.chain !== c.atStep.chain),
        text: 'The part editor opens beside the drawing (below it on a phone). Change one of the part counts, for example add a 100 pF part.' },
      { id: 'compare', title: 'Before and now', target: 'what-it-does', advance: next,
        text: {
          beginner: 'The guide shows what the model said before the change and what it says now.',
          builder: 'The guide shows the model before the change and now. In the target box the dashed ring marks where it was before.',
          engineer: 'The guide shows before and now, and the plots and table update for the new circuit.',
        } },
      { id: 'keep', title: 'Keep or undo', target: 'keep', advance: next,
        text: '“Keep this change” keeps it; “Undo” puts it back. Leaving this task without Keep also puts the circuit back, so nothing changes by accident.' },
    ],
  },
  {
    id: 'safePower', task: 'safePower', title: 'Safe at full power?', minutes: 2, levels: ALL,
    blurb: 'Check the capacitors, and the transformer, at the power you plan to run.',
    steps: [
      open('safePower', 'Open the task', 'Click “Safe at full power?”.'),
      { id: 'power', title: 'Planned power', target: 'power-input', advance: when((c) => c.state.powerW !== c.atStep.powerW),
        text: 'Type the power you plan to run, for example 300, and press Enter.' },
      { id: 'caps', title: 'The capacitors', target: 'cap-line', advance: next,
        text: 'This line checks every capacitor against its voltage and current rating at that power, and gives the power that keeps them all within rating. Grey means it cannot tell, or that the numbers are only an estimate.' },
      { id: 'table', title: 'Each part', target: 'cap-table', advance: next, levels: ABOVE,
        text: 'The table gives each capacitor’s share of its rating. The bar turns red at 100 %.' },
      { id: 'flux', title: 'The transformer', target: 'transformer', advance: next, levels: ABOVE,
        text: 'Transformer flux is a range, because one sweep cannot tell how the leakage splits between the windings. If it asks for a transformer model, the button fits one from the measured part’s sweep in a few seconds.' },
    ],
  },
  {
    id: 'newNetwork', task: 'newNetwork', title: 'Start a new network', minutes: 3, levels: ALL,
    blurb: 'Start the next build from a template, then add, move and remove parts.',
    steps: [
      open('newNetwork', 'Open the task', 'Click “Start a new network”.'),
      { id: 'template', title: 'Pick a starting point', target: 'tpl-copy', advance: click,
        text: 'Click “A copy of this project’s circuit”. It keeps the fitted values but none of the sweeps. Templates start a new project; here in practice nothing is saved.' },
      { id: 'select', title: 'Select a part', target: 'drawing', advance: when((c) => c.state.selected !== null && c.state.selected !== c.atStep.selected),
        text: {
          beginner: 'Click a part in the power-flow drawing, for example a chip in the matching box.',
          builder: `Click a part in the ${DRAWING.builder}, for example the wiring inductance.`,
          engineer: `Click a part in the ${DRAWING.engineer}, for example the wiring inductance.`,
        } },
      { id: 'add', title: 'Add a part', target: 'add-part', advance: when((c) => ids(c.state).length > ids(c.atStep).length),
        text: 'Choose a part and where it goes, then click “Add the part”. It goes next to the part you selected.' },
      { id: 'move', title: 'Move it', target: 'move', advance: when((c) => ids(c.state).length === ids(c.atStep).length && ids(c.state).join() !== ids(c.atStep).join()),
        text: 'The new part is selected. “Move earlier” or “Move later” changes its place in the circuit; try one.' },
      { id: 'remove', title: 'Remove it', target: 'remove', advance: when((c) => ids(c.state).length < ids(c.atStep).length),
        text: '“Remove” takes the selected part out again. Click it.' },
      { id: 'predict', title: 'What it predicts', target: 'predict', advance: next,
        text: 'The last step shows the model’s verdict for the circuit as it is now, and updates as you edit.' },
    ],
  },
  {
    id: 'pastBuilds', task: 'pastBuilds', title: 'Look back at past builds', minutes: 1, levels: ALL,
    blurb: 'Find an old build and compare two of them.',
    steps: [
      open('pastBuilds', 'Open the task', 'Click “Look back at past builds”.'),
      { id: 'tick1', title: 'Pick a build', target: 'build-check', advance: click,
        text: 'Each line is one build: its circuit, its date and its sweeps. Tick one.' },
      { id: 'compare', title: 'Compare two', target: 'compare', advance: next,
        text: 'Tick a second build and both appear here, each with its verdict, so you can see which was better.' },
      { id: 'open-project', title: 'Open a project', target: 'open-project', advance: next,
        text: '“Open” makes that project the current one. You do not need it now: this is practice.' },
    ],
  },
  {
    id: 'rigHistory', task: 'rigHistory', title: 'Rig history', minutes: 2, levels: ['engineer'],
    blurb: 'Every configuration ever swept on the rig, read-only.',
    steps: [
      open('rigHistory', 'Open the task', 'Click “Rig history”.'),
      { id: 'session', title: 'One rig session', target: 'session', advance: next,
        text: 'Each card is one day on the rig: what was built, the rig, and its sweeps. Open its sweeps to read each one with its evidence and anything that is uncertain.' },
      { id: 'copy', title: 'Open a copy', target: 'open-copy', advance: when((c) => c.task === 'pastBuilds'),
        text: '“Open a copy” loads that day’s sweeps as a project. Click it.' },
      { id: 'measured', title: 'Measured only', target: 'project-head', advance: next,
        text: 'The copy appears in Past builds marked “measured only”: it shows what the sweeps measured, with no model predictions.' },
    ],
  },
];
```

Create `src/tour/run.ts`:

```ts
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
```

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npm run typecheck`
Expected: PASS, and the typecheck is clean.

- [ ] **Step 5: Commit**

```bash
git add src/tour
git commit -m "feat(tour): tour content and run logic (one tour per task, per-level steps, state checks against the step's start)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Anchors in the existing components, with a guard

**Files:**
- Create: `src/tour/anchors.test.ts`
- Modify: these files gain `data-tour` attributes only:
  - `src/ui/Home.tsx`;
  - `src/ui/Workbench.tsx`;
  - `src/ui/NewSweepGuide.tsx`;
  - `src/ui/TryChangeGuide.tsx`;
  - `src/ui/PartEditor.tsx`;
  - `src/ui/SafePowerGuide.tsx`;
  - `src/ui/NewNetworkGuide.tsx`;
  - `src/ui/PastBuilds.tsx`;
  - `src/ui/RigHistory.tsx`;
  - `src/ui/drawing/FlowView.tsx`, `HardwareView.tsx`, `SchematicView.tsx`;
  - `src/ui/VerdictCard.tsx`;
  - `src/ui/TargetBox.tsx`;
  - `src/ui/EngineerPanel.tsx`.

**Interfaces:**
- Consumes: `TOURS`, `stepsFor` (Task 1).
- Produces these anchors:

  | Element | Anchor |
  |---|---|
  | Home tiles | `tile-<task>` |
  | Learn tile | `learn` |
  | First-visit banner | `tour-banner` |
  | Drawing panel | `drawing` |
  | Verdict card | `verdict-card` |
  | Target box | `target-box` |
  | Engineer plots | `plots` |
  | Capacitor line under the verdict | `power-line` |
  | "That's what's installed" | `confirm` |
  | "Use … (already loaded)" | `use-sweep` |
  | Step 3 section | `agree` |
  | Step 4 section | `changes` |
  | "Check it at full power" | `to-safe` |
  | A part in each drawing | `part-<id>` |
  | Part editor | `part-editor` |
  | Try-change step 3 | `what-it-does` |
  | Keep button | `keep` |
  | Power input row | `power-input` |
  | Capacitor line on the power page | `cap-line` |
  | Capacitor table | `cap-table` |
  | Transformer section | `transformer` |
  | Copy template button | `tpl-copy` |
  | Add button | `add-part` |
  | Move buttons row | `move` |
  | Remove button | `remove` |
  | New-network step "What it predicts" | `predict` |
  | First build checkbox row | `build-check` |
  | Compare panel | `compare` |
  | First Open button | `open-project` |
  | First project header | `project-head` |
  | First rig session card | `session` |
  | Its "Open a copy" button | `open-copy` |
  | Top-bar Exit tutorial | `exit-tour` (Task 3) |

  Where an anchor is "first" in a list, only index 0 gets it.

- [ ] **Step 1: Write the failing guard test**

Create `src/tour/anchors.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { allBlocks } from '../chain/state.ts';
import { LEVELS } from '../present/level.ts';
import { loadExampleState, ROOT } from '../testutil.ts';
import { stepsFor } from './run.ts';
import { TOURS } from './tours.ts';

const walk = (dir: URL): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : e.name.endsWith('.tsx') ? [readFileSync(new URL(e.name, dir), 'utf8')] : []));
const ui = walk(new URL('src/ui/', ROOT)).join('\n');

test('every tour target is an anchor in the UI, so tours cannot drift away from the screens (spec §7)', () => {
  const targets = new Set(TOURS.flatMap((t) => LEVELS.filter((l) => t.levels.includes(l)).flatMap((l) => stepsFor(t, l).map((s) => s.target))).filter((x): x is string => x !== null));
  const blockIds = new Set(allBlocks(loadExampleState().chain.blocks).map((b) => b.id));
  for (const id of targets) {
    if (id.startsWith('part-')) {
      assert.ok(blockIds.has(id.slice(5)), `${id} names a part of the practice project`);
      assert.ok(ui.includes('data-tour={`part-${'), 'drawings carry part anchors');
    } else if (id.startsWith('tile-')) {
      assert.ok(ui.includes('data-tour={`tile-${'), 'Home tiles carry tile anchors');
    } else {
      assert.ok(ui.includes(`data-tour="${id}"`) || ui.includes(`'${id}'`), `anchor ${id} exists in src/ui`);
    }
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --experimental-strip-types --test src/tour/anchors.test.ts 2>&1 | grep -E "^ℹ (pass|fail)|anchor"`
Expected: FAIL, naming the first missing anchor.

- [ ] **Step 3: Add the anchors**

Add each `data-tour` from the Interfaces table to the named element. Rules:
- The element must exist at every level the step is shown at.
- Conditional anchors use `data-tour={i === 0 ? 'build-check' : undefined}` style. This needs the `'${id}'` form, which the guard also accepts.
- In the three drawing views, the part element gets ``data-tour={`part-${p.id}`}`` (Hardware, Schematic) or ``data-tour={`part-${id}`}`` (Flow chips).
- Home tiles get ``data-tour={`tile-${t.task}`}``.

- [ ] **Step 4: Run the suite and typecheck**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tour/anchors.test.ts src/ui
git commit -m "feat(tour): data-tour anchors on the controls the tours point at, guarded by a test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Overlay, menu, banner and practice mode

The overlay is UI wiring and not unit-testable. The logic it uses was TDD'd in Task 1. The gate is the browser walk in Step 3.

**Files:**
- Create: `src/ui/TourOverlay.tsx`, `src/ui/LearnMenu.tsx`
- Modify: `src/ui/Home.tsx` (Learn tile, menu, banner), `src/ui/App.tsx` (tour + practice state), `src/ui/TopBar.tsx` (practice badge + Exit), `src/ui/app.css`

**Interfaces:**
- `TourOverlay({ steps, index, ctx, onNext, onBack, onExit })`:
  - `steps: ResolvedStep[]`, `index: number`, `ctx: StepCtx`;
  - completes `state` steps via `stepDone`, and `click` steps when a click lands inside the target;
  - Escape calls `onExit`.
- `LearnMenu({ level, onStart: (id: TourId) => void })`.
- App:
  - `startTour(id)`: saves the current project now, remembers its id, loads the O7 example with `projectId` null, task `home`, tour index 0;
  - `endTour(finished)`: reopens the remembered project (or the example if none) and shows "Tutorial finished: your project is back." on finish;
  - `newProject` and `openExample` keep `projectId` null while practising;
  - `openFile` and `openProject` end practice.
- TopBar: `practice: boolean`, `onExitTour: () => void`. While practising it shows "Practice: nothing here is saved" in place of the save status, plus an "Exit tutorial" button (`data-tour="exit-tour"`).

- [ ] **Step 1: Implement**

Create `src/ui/TourOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { type ResolvedStep, stepDone } from '../tour/run.ts';
import type { StepCtx } from '../tour/tours.ts';

interface Rect { top: number; left: number; width: number; height: number }
const find = (id: string | null): HTMLElement | null => (id ? document.querySelector<HTMLElement>(`[data-tour="${id}"]`) : null);
const measure = (el: HTMLElement | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
};

/** One tutorial step: a spotlight on the real control and a card that says what to do (spec §4). Never blocks the app. */
export function TourOverlay({ steps, index, ctx, onNext, onBack, onExit }: { steps: ResolvedStep[]; index: number; ctx: StepCtx; onNext: () => void; onBack: () => void; onExit: () => void }) {
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  // follow the target while the step is shown (scrolling, layout shifts, a panel opening)
  useEffect(() => {
    find(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setInterval(() => setRect(measure(find(step.target))), 200);
    setRect(measure(find(step.target)));
    return () => clearInterval(t);
  }, [step.id, step.target]);
  useEffect(() => {
    if (stepDone(step, ctx)) onNext();
  }, [ctx, step.id]);
  useEffect(() => {
    if (step.advance.kind !== 'click') return undefined;
    const onClick = (e: MouseEvent): void => {
      const el = find(step.target);
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(onNext, 0);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step.id, step.target]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
  const pad = 6;
  const narrow = window.innerWidth < 768;
  const below = rect ? rect.top + rect.height + 12 : 0;
  const cardStyle = !rect || narrow ? undefined : below + 220 < window.innerHeight ? { top: below, left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) } : { top: Math.max(12, rect.top - 232), left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) };
  return (
    <div className="tour" role="dialog" aria-label={`Tutorial: ${step.title}`}>
      {rect ? <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} /> : <div className="tour-dim" />}
      <div className={`tour-card${!rect ? ' centred' : ''}${narrow ? ' bottom' : ''}`} style={cardStyle}>
        <small>Step {index + 1} of {steps.length}</small>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="row">
          <button disabled={index === 0} onClick={onBack}>Back</button>
          {step.advance.kind === 'next' ? <button onClick={onNext}>{index === steps.length - 1 ? 'Finish' : 'Next'}</button> : <button onClick={onNext}>Skip step</button>}
          <button onClick={onExit}>Exit</button>
        </div>
      </div>
    </div>
  );
}
```

Create `src/ui/LearnMenu.tsx`:

```tsx
import type { Level } from '../present/level.ts';
import { toursFor } from '../tour/run.ts';
import type { TourId } from '../tour/tours.ts';

/** The tour list: one hands-on tour per task, on a practice copy of the O7 example (spec §2). */
export function LearnMenu({ level, onStart }: { level: Level; onStart: (id: TourId) => void }) {
  return (
    <section className="panel learn">
      <p>Each tour runs on a practice copy of the O7 example: nothing you do is saved, and your project comes back when it ends.</p>
      {toursFor(level).map((t) => (
        <div className="learn-row" key={t.id}>
          <div><b>{t.title}</b> <small>about {t.minutes} min</small><br /><small>{t.blurb}</small></div>
          <button onClick={() => onStart(t.id)}>Start</button>
        </div>
      ))}
    </section>
  );
}
```

`src/ui/Home.tsx`:
- add the props `onTour: (id: TourId) => void`, `offerTour: boolean` and `onDismissOffer: () => void`;
- hold local state `const [learn, setLearn] = useState(false)`;
- render the banner when `offerTour`:

```tsx
<div className="tour-banner" data-tour="tour-banner"><span>New here? Take the 2-minute tour of the main task.</span><button onClick={() => { onDismissOffer(); onTour('newSweep'); }}>Take the tour</button><button onClick={onDismissOffer}>No thanks</button></div>
```

- add, after the task tiles, a Learn tile that toggles the menu:

```tsx
<button className="tile" data-tour="learn" onClick={() => setLearn((x) => !x)}><b>Learn the tool</b><span>Short hands-on tours, one per task</span></button>
```

- then render `{learn ? <LearnMenu level={level} onStart={onTour} /> : null}`.

`src/ui/App.tsx`:
- **State:**
  - `const [tour, setTour] = useState<{ id: TourId; i: number; atStep: AppState } | null>(null)`;
  - `const [practice, setPractice] = useState<{ returnTo: string | null } | null>(null)`;
  - `offerTour`: initialised from localStorage key `rfnm-tour-offered`, in try/catch;
  - `dismissOffer`: sets that key, in try/catch, and hides the banner.
- **startTour:** async. If `projectId`, await `putProject` with the current state, then `setCurrentId`. Load the example. Set practice `{ returnTo: projectId }`, dispatch `load`, `setProjectId(null)`, `setTask('home')`, `setTour({ id, i: 0, atStep: ex })`. On error, set a notice.
- **endTour(finished):** async. Read `returnTo`, clear the tour and practice, then `openProject(returnTo)` or `openExample()`. If finished, set the notice "Tutorial finished: your project is back."
- **Moving between steps:** `setTour(t => ({ ...t, i: t.i + 1, atStep: state }))`. When `i` passes the last step, call `endTour(true)`. Back works the same way, with the index lowered and clamped.
- **Steps on screen:** `const steps = tour ? stepsFor(tourById(tour.id), level) : []`, with the index clamped to `steps.length - 1` (review focus 2).
- **Rendering:** `{tour && steps.length ? <TourOverlay steps={steps} index={Math.min(tour.i, steps.length - 1)} ctx={{ state, atStep: tour.atStep, task, level }} onNext={…} onBack={…} onExit={() => { void endTour(false); }} /> : null}`.
- **Pass to TopBar:** `practice={practice !== null}` and `onExitTour`.
- **Pass to Home:** `onTour={(id) => { void startTour(id); }}`, `offerTour` and `onDismissOffer`.
- **newProject and openExample:** `setProjectId(practice ? null : newId())`.
- **openFile and openProject:** clear tour and practice before loading (review focus 5).

`src/ui/TopBar.tsx`: add the props `practice` and `onExitTour`. When `practice`, render `<span className="save-status practice">Practice: nothing here is saved</span><button data-tour="exit-tour" onClick={p.onExitTour}>Exit tutorial</button>` in place of the save status.

`src/ui/app.css`, appended:

```css
.tour { position: fixed; inset: 0; pointer-events: none; z-index: 50; }
.tour-spot { position: fixed; border-radius: 8px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .45); outline: 2px solid #f2c94c; transition: all .15s ease; }
.tour-dim { position: fixed; inset: 0; background: rgba(0, 0, 0, .3); }
.tour-card { position: fixed; width: 360px; max-width: calc(100vw - 24px); pointer-events: auto; display: grid; gap: 6px; padding: 12px; border-radius: 10px; background: var(--panel, #f4f4f2); color: inherit; box-shadow: 0 6px 24px rgba(0, 0, 0, .3); }
.tour-card.centred { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.tour-card.bottom { top: auto; left: 12px; right: 12px; bottom: 12px; width: auto; transform: none; }
.tour-card p { margin: 0; }
html[data-theme='dark'] .tour-card { background: #2a2b2e; }
.tour-banner { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; padding: 10px 12px; border: 2px solid #f2c94c; border-radius: 8px; }
.learn { display: grid; gap: 8px; margin-top: 12px; }
.learn-row { display: flex; gap: 12px; justify-content: space-between; align-items: center; }
.save-status.practice { color: #b8860b; font-weight: 600; }
```

- [ ] **Step 2: Run the suite and build**

Run: `npm test 2>&1 | grep -E "^ℹ (pass|fail)" && npm run build 2>&1 | tail -1`
Expected: PASS, and the build succeeds.

- [ ] **Step 3: Browser gate**

1. **First visit** (fresh library): the banner shows. "No thanks" hides it, and it stays hidden after a reload.
2. **Start a tour with a project open** (rename the example to "MY PROJECT" first, so it is recognisable):
   - the top bar reads "Practice: nothing here is saved";
   - the library is unchanged during the tour;
   - Exit reopens "MY PROJECT" (review focus 1).
3. **Walk every tour at Beginner, Builder and Engineer.** Each step's spotlight sits on the named control, the card is readable, click and state steps advance on the action, and Finish restores "MY PROJECT".
4. **New network and rig history in practice:** the library holds no new project afterwards.
5. **Level change mid-tour:** switch the level during a tour; no crash, and the steps follow the new level.
6. **Phone width (375 px):** the card sits at the bottom, and a missing target centres the card.
7. **Open a project file mid-tour:** practice ends and that project autosaves (review focus 5).
8. **Console:** no errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui
git commit -m "feat(ui): hands-on tutorial: Learn the tool menu, first-visit banner, spotlight tours on a practice copy (nothing saved)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

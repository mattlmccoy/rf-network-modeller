# RF Network Modeller: Task-Led Interface (Plan 3) Design

**Date:** 2026-10-15
**Status:** design approved section by section with Matt on 2026-10-14. Matt then delegated the rest overnight ("you have authority to keep working on everything til you're done ... not writing any superfluous code"). In place of his review, a fresh reviewer on the most capable model checked this spec against the code and the mockups. Its findings are folded in. Decisions made under the delegation, including deviations from the mockups, are listed in §15.

**Supersedes:** from `2026-10-14-rf-network-modeller-design.md`:
- §11 (trust cues), §12 (interface) and §13 (persistence);
- the user-interface clauses of §5 (port reference-plane choice: always the tuner side), §8 (per-assumption display, now by level, §5) and §9 (the top-12 table and Apply, now guide step 4, §8.1).

That spec's engine behaviour (§4–§10) and its data contract (§15) still govern. Its clamping flag (§4) and ill-determined flag (§7) are kept: see §7.4.

## 1. Why

After using the Plan 2a app, Matt said it was "not very intuitive." He named three problems:
- The circuit drawing "isn't connected in any meaningful way and it's not physically intuitive"; it has to work for mechanical engineers.
- He couldn't tell what he was seeing.
- He didn't know what to do.

The goal is unchanged: Matt runs the "VNA sweep → next build" loop himself instead of sending sweeps to Claude.

**Success:** open the site cold, load a new `.s1p`, and know within a minute what to change, without asking Claude.

## 2. Decisions Matt made (2026-10-14)

| Topic | Decision |
|---|---|
| Circuit drawing | All three styles, chosen by user level: power-flow (Beginner), hardware side view (Builder), wired schematic (Engineer) |
| Level | One setting (Beginner / Builder / Engineer) sets the drawing, wording, plots and how many numbers show. Changeable any time; the drawing and result view can still be switched by hand |
| Screen flow | A home screen of tasks; each task opens a workbench (drawing + result + a guide written for that task) |
| Home tasks | I measured a new sweep · Try a change first · Safe at full power? · Start a new network · Look back at past builds |
| Storage | Autosave in the browser plus Save / Open project file |
| Rig history | Bundle every configuration ever swept. **Hidden, not private:** shown only behind an Engineer-level "Rig history" entry; the files ship publicly with the site |
| Build approach | New interface on the existing engine, in three phases (A, B, C) |
| Section 1 | Home + "new sweep" workbench at three levels, as mocked up (`.superpowers/brainstorm/94257-1792026035/content/section1-workbench-v2.html`) |

## 3. Scope and phases

- **Phase A (Plan 3A):** level system, three drawings, the workbench, "I measured a new sweep" end to end, Parts on hand and Sweeps sheets, autosave, project files. Replaces the Plan 2a screen.
- **Phase B (Plan 3B):** "Try a change first" and "Safe at full power?".
- **Phase C (Plan 3C):** "Start a new network" (adds and removes parts), "Look back at past builds", Rig history.

**Shipping:**
- Each phase merges to `main` and deploys to GitHub Pages after its tests pass, a browser walkthrough at all three levels has been checked, and the whole-branch review's fixes are in.
- Home shows tasks that aren't built yet as disabled tiles marked "coming next." Links to them, such as step 5 before Phase B, are disabled the same way.

**Accepted temporary loss:** between the Phase A and Phase C deploys, parts can be edited but not added, removed or reordered (2a could). Phase C restores this with a better placement flow.

**Cut as superfluous** (listed so Matt can ask for them back):
- resizable panes and drag reordering;
- fit-bound editing in the UI (refits use the stored bounds; the Engineer mockup's "Edit bounds" button is dropped);
- extra plot modes beyond the four Engineer panes;
- a live link from `nanovna-web` (it only downloads `.s1p`; §14);
- `.s2p` import (the history holds none; §10);
- the 38-version design ledger (designs never built have no sweeps).

## 4. Architecture

**Kept unchanged:** `src/engine`, `src/io`, `src/blocks`, `src/fit`, `src/stress`, `src/recommend` (Plan 1, 151 tests). `src/chain` is also kept, apart from one optional field in Phase B (§8.3).

**Kept and extended:** the tested Plan 2a logic in `src/app`:
- `state.ts`, `evaluate.ts`;
- `grid.ts`, `plotmath.ts`, `units.ts`;
- `chainEdit.ts`, `example.ts`.

Extensions are only those listed under "State changes" below.

**New pure modules** (each TDD'd, no DOM):

| Module | Responsibility |
|---|---|
| `src/present/level.ts` | `Level` and its profile (§5) |
| `src/present/words.ts` | One glossary of plain names used by every view (§11) |
| `src/present/layout.ts` | `layoutChain(chain) → Layout`: ladder geometry shared by the hardware and schematic drawings (§6.1) |
| `src/present/stages.ts` | `stagesOf(chain) → Stage[]`: the power-flow grouping (§6.2) |
| `src/present/verdict.ts` | Safe landing (`landingNearF0`), per-assumption verdict, combined verdict, `windowDistance` (§7.1) |
| `src/present/agreement.ts` | Measured vs predicted in the sweep's own state (§7.2) |
| `src/present/circuit.ts` | `structureKey`, `sameState`, `trust` (§7.3) |
| `src/present/builds.ts` | Builds = tagged sweeps grouped by `sameState` and structure (§9) |
| `src/present/recs.ts` | Shapes recommender output for step 4: current-build row, "nothing beats it", empty fallback with the closest candidates (§8.1) |
| `src/present/power.ts` | Safe power for the capacitors (Phase B, §8.3) |
| `src/project/file.ts` | Project ⇄ `rfnm/1` JSON, with ±Infinity encoding and validation (§9) |
| `src/project/store.ts` | IndexedDB library and autosave (thin; verified in the browser) |
| `src/history/manifest.ts` | Rig-history manifest schema and validator (Phase C, §10) |

**Interface (`src/ui`)**, rewritten around these modules:
- shell: top bar, home, workbench frame;
- the three drawings, the part editor, the result views;
- one guide component per task.

The Parts on hand and Sweeps sheets reuse the logic of 2a's `StockPanel.tsx` and `SweepsPanel.tsx`, re-housed as sheets opened from the top bar.

**Kept from 2a:** `PlotPane.tsx` (gains auto-ranged |S11|), `DraftNumberInput.tsx`, `ParamField.tsx`, `nanovna.css` tokens, and the light/dark toggle.

**Deleted:** `App.tsx`'s three-column layout, `CircuitStrip.tsx`, `BlockArt.tsx`, `LandingStrip.tsx`, `Inspector.tsx` (its field logic moves into the part editor), and the reducer's `view` field and `setView` action.

**State changes (`src/app/state.ts`):**
- `powerW: number`: planned power, default 500 W. Phase A uses it for step-4 stress flags.
- `FitValues` gains three fields:
  - `converged: boolean | null`: `null` for imported Python fits, which carry no flag;
  - `rms: number | null`;
  - `illDetermined: [string, string][]`.
- `TagRef.structure: string`: the `structureKey` of the chain when the sweep was tagged (§7.3). `example.ts` fills it from the example chain.
- A `retagSweep` action: re-tag a sweep with the current circuit state and structure, for a sweep tagged wrong.

UI-only state (level, current task, guide progress, preview, selection) lives in React state.

## 5. Levels

| | Beginner | Builder | Engineer |
|---|---|---|---|
| Drawing | Power-flow | Hardware side view | Wired schematic |
| Result view | Verdict card | Target box + verdict line | Four plot panes + numbers |
| Numbers | Part values only (pF, turns); no ohms | R and X at 13.56 MHz (3 significant figures, plain names), room to drift up in % | Complex Z per cable assumption; fitted parameters with badges, `converged`, RMS, ill-determined pairs |
| Cable assumptions | Never named; verdicts use the majority (§7.1) | Never named; verdicts use the majority | Named and selectable (`primary`); every assumption shown |
| Part editor | Cap banks as stock picks; sense loop on/off | + inductances and lengths, with fit/est/typed badges | + every parameter, free/fixed toggles |
| Sheets | Parts on hand | Parts on hand, Sweeps | Parts on hand, Sweeps, Rig settings (Phase C), Rig history (Phase C) |

- The level persists per viewer in `localStorage`, wrapped in try/catch. The default is Builder.
- The workbench has two small overrides, **Drawing** and **Result**. They reset when the level changes.

## 6. Drawings

### 6.1 Ladder layout (hardware and schematic)

`layoutChain(chain)` returns part boxes, wire segments, junction dots and ground points in grid units:
- **Series blocks** (coax, cap bank, inductor, wire, primitive, stack, ideal, measured branch, plates in series) take a slot along the current line.
- **A shunt block** puts a junction on the current line. Its sub-chain runs perpendicular to the line and ends at a ground point. Off a horizontal line, perpendicular is down; off a vertical line, it is right.
- **A parallel block** stacks its arms perpendicular to the line, between two junctions.
- **A shunt that is the last block of the main chain** is drawn as the end load: its sub-chain continues the main line, then returns to ground. This matches the approved mockups.
- **Transformer-like series blocks** (stack, ideal) get a ground return on each winding in the schematic.
- **Recursion handles nesting.** Tests check three properties on the O7 and C+D presets and on a nested synthetic chain: every leaf block appears exactly once, no two boxes overlap, and every wire ends on a box terminal, a junction or a ground point.

The two renderers draw the same layout:
- **Schematic:** standard symbols.
  - Each inductance is a coil symbol labelled with its plain name (§11).
  - A measured branch is a dashed box labelled with its block label and "measured."
- **Hardware:**
  - inductor and wire blocks are copper straps, with the inductance written on the strap;
  - cap banks are rows of pucks, one per part;
  - stacks are ferrite blocks; plates have the bed and part between them;
  - coax is grey cable, and the generator sits outside a dashed cage;
  - every ground point drops to one cage-floor line;
  - a measured branch is a ferrite-and-plates icon inside a dashed outline, labelled with its block label and "measured together."

**No invented hardware facts.** Turn counts, stack counts, plate size and gap appear only when a block field holds them. The mockups' "2 stacks, 3 : 15" and "110 mm gap" are not shown for the O7 measured branch (§15).

### 6.2 Power-flow stages (Beginner)

`stagesOf(chain)` puts every leaf block in exactly one stage:
1. **Generator** and **Auto-tuner:** fixed endpoints with no blocks. The tuner is not modelled; the model predicts what the tuner sees.
2. **Cable:** coax blocks.
3. **Matching box:** everything before the first transformer-like block (stack, ideal, measured branch).
4. **Transformer:**
   - the first transformer-like block, its enclosing shunt arm, and every later non-plates block;
   - when the transformer is a measured branch, the stage reads "Transformer + plates (measured together)" and Plates is omitted.
5. **Plates + part:** plates blocks.

Empty stages other than Generator, Auto-tuner and Cable are omitted. Clicking a stage lists its parts, and clicking a part opens the part editor.

### 6.3 Interaction

- Clicking a part (or a part in a stage list) opens the **part editor** beside the drawing, with fields by level.
- Cap banks are edited as counts of each HT50 value, showing on-hand, in-circuit and left, with overdrawn stock flagged.
- Edits apply through the existing reducer actions.

## 7. What the screen says

### 7.1 Tuner verdict

**Safe landing.** `landingNearF0(f, z, window)` returns `null` unless the point nearest 13.56 MHz lies in 12.5–14.6 MHz and within one grid step of 13.56 MHz. That is the rule `measuredLanding` uses; `evaluate.ts` is refactored so both share it. Otherwise it returns `landing(f, z, window)`.

**Per-assumption verdict** from a landing:

| State | Rule | Beginner wording |
|---|---|---|
| unknown | landing is `null`, or the model errored | "Can't tell yet" (grey) |
| outside | `!inWindow` | "The tuner can't match this," plus which way it is off |
| little room | inside, room up < 1 % | "Matches, but with little room: warming up may push it out" |
| some room | 1 % ≤ room up < 2.5 % | "Matches, with some room" |
| plenty of room | room up ≥ 2.5 % | "Matches, with plenty of room" |

- **Room up** is what matters: heating raises the plate C and moves features down (old spec §9). The ranking uses the same quantity.
- **2.5 %** is the ranking's own cap on useful room (`rank.ts:4`, `ROOM_CAP`). **1 %** is a ruling (§15).
- **"Which way it's off"** comes from the side of the window that is crossed. `windowDistance(z, w)` is the Euclidean distance in ohms from z to the window rectangle (0 inside).

**Combined verdict** across cable assumptions:
- It is the state held by a majority of assumptions, matching the recommender's majority filter.
- With no majority, it is the worst state.
- When the assumptions disagree, Builder adds "depends on the cable assumption," and Engineer lists each one.
- An assumption that errored counts as unknown.

**O7 example, as it will display.** The measured 80/180 + loop sweep has room up 0.82 %, so it shows **"little room"**. The model has 1.35 % (1.245 m) and 1.2825 m inside, and 1.5094 m outside, so the majority verdict is **"some room"**. The mockups' "comfortably" and "Nothing needs changing" do not appear (§15).

### 7.2 Does the model agree?

**Compared:** the active sweep against the model **evaluated in that sweep's own tagged state** (`applyState(variantChain(s, i), tag.state)` through `evaluateVariants` on that state), per assumption, at 13.56 MHz.

**Grading,** using d = max(|ΔR|, |ΔX|):
- **agrees** when d ≤ 3 Ω;
- **rough** when d ≤ 12 Ω: "close enough to rank changes, not exact; near the edge of the tuner's range it can be wrong about matching";
- **off** when d > 12 Ω: "refit before trusting suggestions";
- **unknown** when either side is missing.

**Combining:** the majority grade across assumptions, worst on no majority.

**Evidence:** the 10-13 validation step-2 X errors are 9.9, 11.0 and 16.4 Ω, grading as rough, rough and off, so the majority is rough. An error of that size moved 80/200 from predicted-inside (6.4–6.6 + j12.6) to measured-outside (5.03 + j4.30). That is why "rough" carries the near-edge warning.

**After a refit:** the pre-refit grade is kept and shown as the **blind check** ("before refit: rough, reactance 10 Ω off"). The post-refit grade is labelled **"fit to this sweep,"** because the sweep is now in the fit. A fit with `converged === false` caps the grade at rough and says "the last refit didn't settle."

### 7.3 Is this circuit what you measured?

- **`structureKey(chain)`** is a canonical string of the chain with the state fields removed (cap-bank counts, nSeries, customPf; measured-branch loop). Each parameter is reduced to its value; badge, free and bounds are dropped.
- **`sameState(chain, a, b)`** compares `snapshotState(applyState(chain, a))` with the same for `b`. This normalises the `o7State` and `snapshotState` shapes.
- **`trust(state)`** is evaluated in this order:
  1. **beyond:** `structureKey(s.chain)` matches no included tag's `structure`, so a part was added, removed or retyped since those sweeps. Also beyond: a bank total is outside the min–max of included tags with that structure, or the loop flag matches none of them.
  2. **measured:** a tag with the same structure has `sameState` with the current circuit.
  3. **within:** otherwise.
- Refits change only `fits`, never `s.chain`, so they don't change the trust state.
- **Wording:**
  - Beginner adds "(prediction: not measured yet)" whenever trust isn't measured.
  - Builder and Engineer show "within what you've measured" or "beyond anything you've measured: the model is extrapolating."

### 7.4 Result views

**Which result is shown.** The measured verdict appears only when the circuit is **measured** (§7.3) for the active sweep's state. Otherwise the view shows the model verdict, labelled "predicted." After step 4's "Use this," the card therefore switches to "predicted" for the planned build.

- **Verdict card (Beginner):** the verdict plus one next-step sentence.
- **Target box (Builder):**
  - R from 0–25 Ω and X from 0–60 Ω, with the tuner window shaded;
  - the measured point as a filled dot, and the predicted point for the `primary` assumption as a ring;
  - a dashed ghost ring while a change is previewed;
  - points beyond the axes are pinned to the edge with an arrow.
  - Plus the verdict line and "room to drift up: x %."
- **Plots + numbers (Engineer):**
  - the four 2a panes (Smith, |S11| auto-ranged to the data, R/X, VSWR);
  - Z at 13.56 MHz, measured and per assumption;
  - fitted parameters with badges, `converged`, RMS and ill-determined pairs ("can't be told apart with these sweeps").
- **Clamping flag (old §4):**
  - When `outOfRange` is true at 13.56 MHz, Builder and Engineer say "the model reads the measured part outside its sweep here; treat it as rough."
  - The Engineer plots draw clamped spans dashed, as 2a does.

## 8. Task guides

Each guide is a column of steps. A step's status (done / current / waiting / blocked) is a pure function of `AppState` plus UI state, and is tested.

### 8.1 I measured a new sweep (Phase A)

1. **What's installed right now?**
   - Shows each cap bank's parts and the loop flag. It reads "Same as your last build" when `sameState` holds with the newest tag.
   - Confirm marks it done; Change opens the part editor for the banks.
2. **Load the sweep.**
   - `.s1p` file input, then `uniqueSweepId`, then `addSweep`, which tags the sweep with the current state and structure.
   - A parse error names the file and the parser's reason.
   - A mis-tagged sweep is fixed in the Sweeps sheet: include/exclude, remove, re-tag with the current circuit, or set the circuit to its tag.
3. **Does the model agree?**
   - Shows the §7.2 grade and the target-box comparison.
   - **Refit with this sweep:**
     - runs `fitNetwork` for each assumption in turn, about 1.5 s each on O7, with a "Refitting 1 of 3" message rendered before each run;
     - refits the current fits' parameters (or `freeRefs` when there are none) against all included tags;
     - replaces `fits` with `converged`, `rms` and `illDetermined`, with the source "in-app refit (N sweeps)".
   - If any assumption's fit throws (`FitError`, `ChainError`), every previous fit is kept and the reason is shown.
4. **What to change.**
   - Runs `recommend()` (0.7 s on O7) with `stressWatts = powerW`. `recs.ts` shapes the result:
     - **Rows:** the top ranked rows, up to 5 (O7 gives 4). Each row has the plain moves text, the combined verdict, and an amber or red stress flag at ≥ 80 % or ≥ 100 % of rating at the planned power.
     - **The current build's own row** reads "Keep what you have."
     - **If the current build ranks first,** the header says "Nothing in your stock beats what you have."
     - **If the ranked list is empty,** the header says "None of your stock combinations lets the tuner match for most cable assumptions." The three closest candidates by median `windowDistance` follow.
     - **If every row is red** at the planned power, the header says so and points to "Safe at full power?".
   - **"No change needed"** appears only when the combined verdict is plenty of room **and** the current build's stress is under 100 % at `powerW`.
   - **Show on drawing** previews a row: a ghost in the result and highlighted parts in the drawing. **Use this** applies its picks, and the build becomes "planned (not yet measured)."
5. **Safe at full power?** Opens that task (disabled until Phase B).

### 8.2 Try a change first (Phase B)

- Entering the task snapshots the state as the baseline.
- Steps:
  1. Pick a part on the drawing.
  2. Change it in the part editor.
  3. See the combined verdict and §7.3 trust, with before (ghost) and after drawn together.
- **Keep** leaves the change in place. **Undo** restores the baseline.

### 8.3 Safe at full power? (Phase B)

1. **Planned power** (`powerW`, editable).
2. **Capacitors against their ratings.**
   - Uses `reports(chain, drive(...))` per assumption, taking the worst. Bars show % of rating: amber ≥ 80, red ≥ 100.
   - **Safe power for the capacitors (the only rated parts)** = P × (100 / worst %)², because V and I scale with √P. The limiting cap is named.
   - When no rated part carries current (worst % is `null`) or `drive` throws `DriveError`, it shows "can't tell," never a number.
3. **Transformer** (Builder and Engineer): flux and loop-voltage ranges.
   - T-model mode uses `fluxRangeStacks`.
   - Measured-branch mode uses `fluxRangeBranch` with a stage-1 T-model of the cap-free sweep:
     - That fit takes about 4–5 s per assumption on O7 (reviewer probe), so it runs for the `primary` assumption only, behind a "Fit transformer model (≈5 s)" button whose message renders first.
     - The result is stored in the project as `AppState.tmodel: { variant, unit, load, rmsRel } | null`.
     - The O7 example ships the Python fixture's T-model for 1.245 m (`fixtures/python/tmodel_short.json`).
   - Flux needs turns and cores: `MeasuredBranchBlock` gains an optional `transformer: { nP, nS, nC }`. The O7 preset and example set 3, 15, 4. Without it the panel says "enter turns and cores to see flux."
   - Engineer adds the f_pri range, loop voltage, "enter a measured loop voltage" (`solveFPri`), and the power split (T-model only; measured-branch mode states it can't be identified, as in old §10).

**Beginner wording example:** "At 500 W the 30 pF series cap would carry 112 % of its rated current. The capacitors are safe up to about 400 W."

The home tile reads "Cap voltage and current, transformer flux." Core heating is not modelled.

### 8.4 Start a new network (Phase C)

1. **Starting point:** O7 as built, C+D 2:18 two-core (`cdChain`), or Blank (cable only).
2. **Add, remove and reorder parts.**
   - Select a part, then choose where the new part goes: **in line after it** or **from here to ground**. Engineer also gets **in parallel with it**.
   - **Palette by level:**
     - Beginner: capacitor bank, transformer stack, electrode plates, strap/wire.
     - Builder adds: inductance, measured part (from a sweep).
     - Engineer adds: R, L, C, short, ideal transformer.
   - These use the existing `newBlock` / `insertAfter` / `insertInto` / `removeBlock` / `moveBlock`.
3. **Rig settings (Engineer):** cable assumptions (name, length, jumper L) and the tuner window.
4. **Prediction:** the combined verdict and result view.

### 8.5 Look back at past builds (Phase C)

- Lists the projects in the library. Each project's builds (§9) show:
  - the date, from the newest sweep's `nanovna-sweep-<ms>` stamp, else "date unknown";
  - the parts, and the sweep count;
  - "modelled" or "measured only."
- Pick up to two builds to compare: both sweeps on the target box (Builder) or Smith chart (Engineer), with their verdicts.
- **Open** makes a project current.

### 8.6 Rig history (Engineer, Phase C)

The same list view, read from `public/history/index.json`, read-only. "Open a copy" imports a session into the library, fetching its sweeps.

## 9. Projects, builds and storage

**Project:** the persisted fields are:
- `name`, `savedAt`;
- `chain`, `variants`, `primary`, `fits`;
- `sweeps`, `tagged`, `activeSweep`;
- `stock`, `window`, `powerW`;
- `tmodel` (Phase B).

Not persisted: selection and plot pane choices.

**Build:** a project's tagged sweeps grouped by equal `structure` and `sameState` (`builds.ts`). The build is labelled from its parts, e.g. "series 80 pF (50 + 30) · shunt 180 pF (100 + 50 + 30) · loop on."

**Library and autosave:**
- IndexedDB holds one record per project, plus the id of the current one.
- The current project autosaves one second after the last change.
- The top bar says "Saved ✓" only after a confirmed write. On failure it says "Not saved: use Save project."
- IndexedDB is used because the O7 project alone is about 1.4 MB of sweep data.

**Project file:** `*.rfnm.json`, `{ "format": "rfnm/1", "savedAt", "project": { … } }`.
- Sweeps are stored as `{ name, f: number[], gamma: [re, im][] }`.
- **Parameter bounds** `lo`/`hi` of ±Infinity are written as `null` and read back as −Infinity (`lo`) or +Infinity (`hi`). JSON cannot hold Infinity.
- **Open** validates the format string, required fields, and numeric arrays of equal length. A failure reads "this file isn't a modeller project: <what's wrong>"; it never crashes.
- **Round-trip test:** for the O7 example and for a `cdChain` project, save then open gives a deep-equal project.

On first visit the library holds the O7 example.

## 10. Rig history (Phase C)

**Source (probed 2026-10-15):** `experiments/rf_sintering/MANUAL_MATCHING_NETWORK/`, about 20 MB:
- **333 `.s1p`** files (no `.s2p`) in about 20 dated session folders, 2026-08-25 to 10-13, plus 6 at the folder root with no session date;
- **38 `*sweep*.csv`**:
  - **20 are VNA exports**, with columns `frequency_hz,s11_real,s11_imag,…,s21_*`; 14 of them start with four `#` header lines;
  - **18 are generator/scope telemetry** (`host_timestamp_ns,forward_w,…`) or analysis tables, and are not sweeps.

**Manifest:** `history/manifest.json`, curated, schema `rfnm-history/1`.

Each session has:
- `id`, `date` (or `null` for the root files), `title`;
- `rig`: transformer, turns, cores, plates, each as text or `"unknown"`;
- `evidence`: the file and line it came from;
- `modelPreset`: `"o7"`, `"cd"` or `null`.

Each sweep has:
- `file`;
- `kind`:
  - `network`: no tuner in the path, so comparable to predictions;
  - `network+tuner`;
  - `branch` (cap-free);
  - `calibration`;
  - `short`;
  - `other`;
- `series_pF` and `shunt_pF` when known, `loop`;
- `load`: cube / electrodes / none / unknown;
- `condition`, e.g. cold / post-power;
- `label`;
- `evidence`: the file name or a notes line;
- `uncertain`: a reason, when something could not be pinned down.

**Curation rule:** every field comes from the file name or a cited notes line. Anything else is `"unknown"` with a reason, never a guess (data-contract rule).

**Importer** (`tools/history/build.ts`):
- validates the manifest (`src/history/manifest.ts`);
- copies each `.s1p` to `public/history/files/<session>/`;
- converts a VNA-export CSV to an S11-only `.s1p` unless an `.s1p` with the same `nanovna-sweep-<ms>` stamp exists, or its S11 data match an existing file; it skips the duplicate and records why;
- skips non-sweep CSVs by header;
- collapses byte-identical `.s1p` files (such as `2026-08-26/00_ORIGINAL_EXPORTS/`) to one, listing both paths;
- writes `public/history/index.json`.

It runs against the real folder before Phase C ships.

**Display:** Engineer only, read-only, newest first; undated files last. `network+tuner` sweeps are labelled "tuner in the path: not comparable to predictions."

## 11. Wording

`words.ts` maps internal names to plain ones:

| Internal | Plain |
|---|---|
| AIT window | what the tuner can match |
| landing | where the tuner lands |
| AIT-out plane | at the tuner |
| variant | cable assumption (Engineer only) |
| measured branch | measured part |
| series path L / branch L | wiring inductance / loop inductance |
| drift room up | room to drift |

Acronyms (VNA, HT50, S11, VSWR) are spelled out in tooltips.

## 12. Errors and honesty

- **Model errors** (`ChainError`, `DriveError`, a missing sweep) show "the model can't evaluate this circuit: <reason>"; the verdict is unknown.
- **Unknown never renders as healthy:**
  - missing data is grey "Can't tell yet";
  - "can't tell" replaces a safe-power number;
  - unconverged fits, ill-determined pairs, clamped reads, autosave failure and extrapolation are all shown;
  - "No change needed" also requires the stress check (§8.1).
- **Bad files** are named, with the reason.

## 13. Testing and verification

- **Red-green TDD** for every pure module in §4, the new reducer actions, and the importer's conversion and dedupe functions.
- **Real-data runs:**
  - the O7 example through refit, recommend and the §7.1 verdicts (the displayed states must match §7.1);
  - the history importer against the real Dropbox folder.
- **Browser gate per phase:** walk each delivered task at all three levels in the dev server and the built site. I read every screenshot myself. Check for no console errors, and that autosave survives a reload.
- **Whole-branch review per phase** by a fresh reviewer on the most capable model, then one TDD fix pass. The plans land the pure modules before the UI.

## 14. Data contract (inputs and their evidence)

| Input | Evidence |
|---|---|
| Tuner window 5–17 Ω, 6–48 Ω | `src/chain/presets.ts:8` (`AIT_WINDOW`) |
| Drift room and the 12.5–14.6 MHz segment | `src/recommend/landing.ts` (`landing`, `ROOM_SEG`); old spec §9 (room up matters) |
| Ranking room cap 2.5 % | `src/recommend/rank.ts:4` (`ROOM_CAP = 2.5`) |
| Refit and recommend timings | Probe 2026-10-15 on `public/examples/o7`: recommend 697 ms (209 candidates); fitNetwork 1519 ms, converged, 13 iterations. Reviewer reproduced recommend at 666 ms |
| fitTModel timing | Reviewer probe: 5.2 / 3.7 / 3.6 s for the three assumptions on the O7 cap-free sweep |
| Current-build stress at 500 W | Probe: the top-ranked row (current build) maxStressPct 111 % |
| O7 verdict inputs | Reviewer probe: measured 80/180 + loop room up 0.82 %, down 1.04 %; model 1.245 m room up 1.35 %; 1.5094 m prediction 4.98 + j11.52 (outside) |
| Validation errors behind the "rough" band | `docs/validation/2026-10-14-validation.md` (step-2 X errors 9.9 / 11.0 / 16.4 Ω; 80/200 predicted 6.4–6.6 + j12.6 vs measured 5.03 + j4.30) |
| O7 transformer for flux: n = 5, N_p = 3, N_c = 4 | `fixtures/python/tmodel_short.json` (`tmodel`) |
| nanovna-web stores no sweeps | `nanovna-web/src/App.tsx:804-823`; sweeps leave as `.s1p` downloads (`App.tsx:1203`) |
| History volume and formats | `find` over `MANUAL_MATCHING_NETWORK` (333 `.s1p`, 0 `.s2p`, 38 CSV of which 20 VNA exports); reviewer header inspection |

## 15. Decisions made under Matt's delegation (2026-10-15)

Each is a ruling with its cost if wrong. Each lives in one module and is cheap to change.

1. **Verdict "little room" below 1 % room up; "plenty" at 2.5 % (`ROOM_CAP`).** *If wrong:* the O7 sweep's "little room" (0.82 %) is too cautious or too lax; change one constant.
2. **Agreement bands 3 Ω and 12 Ω, majority across assumptions,** with the near-edge warning on rough. *If wrong:* step 3 over- or under-states trust.
3. **Refits run all included tags jointly.** This is not the Python's staged recipe; probe values differ slightly (wiring L 593 vs 587 nH). *If wrong:* values drift from the Python fits; the "in-app refit" source keeps them distinguishable.
4. **Planned power defaults to 500 W,** the design target in the rig records. *If wrong:* step-4 stress flags are calibrated to the wrong power; it's editable.
5. **No Web Worker.** Refits run one assumption at a time with progress. The transformer fit runs for `primary` only, behind a button, with the result stored. *If wrong:* a brief stall during refits.
6. **`MeasuredBranchBlock.transformer` is optional and only flux uses it.** *If wrong:* one more field in the chain types.
7. **Deviations from the approved mockups:**
   - **(a)** the measured branch is drawn honestly as "measured together" (no "2 stacks, 3 : 15", no "110 mm gap", no separate Plates stage), because no block holds those facts;
   - **(b)** Beginner shows no ohms (the mockup's tuner tag did);
   - **(c)** "Edit bounds" is cut;
   - **(d)** the O7 example reads "little room" / "some room," not "comfortably" / "Nothing needs changing," because the real numbers say so.

   *If wrong:* Matt asks for the mockup wording back, and the turns/stack text once a block field holds it.
8. **History CSVs are converted only when no `.s1p` holds the same sweep.** *If wrong:* duplicates are skipped, with reasons recorded.
9. **Phases deploy one at a time,** accepting that add/remove-part is missing between A and C. *If wrong:* a few hours without add/remove on the live site overnight.

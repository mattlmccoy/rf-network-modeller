# RF Network Modeller: Built-in Tutorial Design

Date: 2026-10-15. Status: approved by Matt in chat ("yes, write the spec, then build when done").

## 1. What Matt asked for

A walkthrough tutorial, built into the app, that teaches how to use the tool. He chose:

- **Hands-on practice.** Each step points at the real control, says what to do, and moves on when you do it. Skip and Exit are always available.
- **One short tour per task.** Each Home task gets its own 1–3 minute tour.
- **Tours follow your level.** Each tour runs at whatever level you are on, and its wording and targets match what that level shows.

Assumptions accepted with the design:

- Tours run on a **practice copy of the O7 example**, and nothing touches your projects.
- No new dependencies.

**Success:** a newcomer can finish the "I measured a new sweep" tour at any level without help. After a tour, the project that was open before is back, unchanged.

## 2. Where it lives

- **Home tile "Learn the tool".** It opens a short menu with one line per tour (title, about how many minutes, what it covers). The Rig history tour is listed only at Engineer, as its task is.
- **First-visit banner on Home: "New here? Take the 2-minute tour"**, with buttons "Take the tour" (starts the new-sweep tour) and "No thanks".
  - Either choice hides the banner for good. That is a per-viewer convenience stored in `localStorage`.
  - All storage access is wrapped in try/catch. If storage is unavailable, the banner simply shows again.

## 3. Practice mode

- **Starting a tour:**
  - If a project is open, it is saved immediately, not after the 1 s autosave delay, and its id is remembered.
  - The O7 example then opens fresh.
- **While practising:**
  - `projectId` is null, so autosave writes nothing. Any project the tour creates is also unsaved: new-network templates and rig-history copies keep `projectId` null.
  - The top bar shows **"Practice: nothing here is saved"** and an **"Exit tutorial"** button.
- **Ending a tour:** finishing, Exit, or Escape reopens the remembered project from the library. If there was none, it reopens the O7 example.
- **Leaving practice another way:** opening a project file or opening a library project ends practice; that project becomes current as usual.
- **The level is never changed by a tour.**

## 4. A step

- **On screen:**
  - A dimmed screen with a cut-out around the target control.
  - A card next to it holding: the step title, one or two plain sentences, "Step 3 of 8", and the buttons **Back**, **Skip step**, **Exit**. A **Next** button appears on "look" steps.
  - The overlay never blocks the app, so clicks reach the real controls.
- **How a step completes.** Each step has one of three advance rules:
  - `click`: the user clicks inside the target;
  - `state`: a predicate over the app state becomes true (for example, a part is selected, a bank changed, or the planned power changed). Predicates are pure functions of `{ state, atStep, task, level }`, where `atStep` is the state when the step began;
  - `next`: a look-only step; the user presses Next.
- **Targets.** A target is a `data-tour="…"` anchor on an existing element. A step may give a different target and text per level: for example Beginner → the verdict card, Builder → the target box, Engineer → the plots. A step can be limited to some levels (for example, the per-part stress table is Builder+).
- **Finding the target:**
  - when a step starts, the target is scrolled into view;
  - its position is re-measured while the step is shown, so scrolling and layout shifts are followed;
  - if the target is not on screen (another task, phone layout, collapsed section), the card centres and the text still says what to do.
  - On phone widths (< 768 px), the card sits at the bottom of the screen.
- **No fixed numbers in step text.** Steps say where to look ("the line under the verdict says whether a capacitor goes over its rating at the planned power"), so the tour stays true when the model changes.
- **Wording rules (spec §11):** no "AIT", "variant" or "landing". Engineer may say "cable assumption".

## 5. Tours

Every tour starts on Home. Its first step clicks the task's tile. Beginner names the drawing "power-flow drawing", Builder "hardware drawing", Engineer "schematic".

| Tour | Steps |
|---|---|
| **I measured a new sweep** (~8) | 1. Open the task. 2. Confirm what's installed ("That's what's installed"). 3. Use the already-loaded sweep. 4. Read the verdict and where it comes from (your sweep / model). Target: Beginner verdict card, Builder target box, Engineer plots. 5. Read the capacitor line at the planned power. 6. Read "Does the model agree?". 7. Read "What to change" and the guidance when stock can't fix it. 8. Jump to "Check it at full power". |
| **Try a change first** (~6) | 1. Open the task. 2. Select the shunt bank. Beginner: open the matching box, then pick the shunt bank chip. 3. Change a part count in the part editor (state: the circuit changed). 4. Read before/now. Builder: the dashed ring in the target box. 5. Undo or Keep, and note that leaving without Keep puts it back. |
| **Safe at full power?** (~5) | 1. Open the task. 2. Change the planned power (state: power changed). 3. Read the capacitor line. 4. Per-part table (Builder+). 5. Transformer flux range (Builder+). |
| **Start a new network** (~7) | 1. Open the task. 2. "A copy of this project's circuit". 3. Select a part. 4. Add a part (state: one more part). 5. Move it (state: order changed). 6. Remove it (state: one fewer part). 7. Read the prediction. |
| **Look back at past builds** (~4) | 1. Open the task. 2. Tick one build. 3. Tick a second and read the comparison. 4. "Open" makes a project current (look only, so the tour does not load a real library project). |
| **Rig history** (Engineer, ~4) | 1. Open the task. 2. Expand a session's sweeps and read the uncertainty notes. 3. Open a copy (state: the task is now Past builds). 4. Read "measured only". |

## 6. Code layout

| File | Responsibility |
|---|---|
| `src/tour/tours.ts` | Types and tour content (data): `TourId`, `Tour`, `Step`, `Advance`. |
| `src/tour/run.ts` | Pure logic: `toursFor(level)`, `stepsFor(tour, level)` (resolves per-level target and text, drops steps not shown at that level), `stepDone(step, ctx)`. |
| `src/ui/TourOverlay.tsx` | Spotlight, card, target measuring, click detection, keyboard (Escape exits). |
| `src/ui/LearnMenu.tsx` | The tour list. |
| `src/ui/Home.tsx` | Learn tile and first-visit banner. |
| `src/ui/App.tsx` | Practice mode: start/end, unsaved while practising, return to the remembered project. |
| Existing components | Gain `data-tour` anchors only; no behaviour change. |

## 7. Testing

Red-green TDD for the pure parts:
- every tour has at least one step at each level it is offered at, and every resolved step has text;
- `toursFor('builder')` has no Rig history tour, while Engineer's does;
- each `state` predicate fires on the matching reducer action from the O7 example and not before. Examples: the planned power changed, a part added, moved or removed, the shunt bank changed;
- **anchor guard:** every `data-tour` target named in the tours appears in `src/ui` source. Dynamic part targets (`part-<id>`) are checked against the anchor template and the O7 block ids.

Browser gate:
- walk every tour at all three levels;
- check phone width;
- check that Exit and finishing restore the previous project;
- check that nothing is saved during practice (the library is unchanged);
- check that there are no console errors;
- read the screenshots.

## 8. Out of scope

- Videos or animations.
- A tour for the Parts on hand and Sweeps sheets.
- Remembering progress through a tour after a reload. A reload ends practice, and the remembered project reopens on the next start because it was saved when the tour began.

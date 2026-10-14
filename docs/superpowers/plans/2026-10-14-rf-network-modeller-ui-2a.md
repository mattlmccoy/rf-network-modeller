# RF Network Modeller: Plan 2a (Interactive Viewer and Circuit Editor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the validated core in Matt's browser. It opens on the O7 example with live predicted Smith, |S11|, R/X and VSWR panes plus the 13.56 MHz landing for every variant. He can edit the circuit (add, remove, reorder and edit blocks, physical or symbol view), load his own `.s1p` sweeps as overlays, and keep track of HT50 stock.

**Architecture:**
- Vite + React front end in the NanoVNA web tool's design language; the stylesheet is copied verbatim.
- All non-visual logic lives in `src/app/` as pure, `node --test`-tested modules: state reducer, chain editing, grid, plot math, units, example loader and evaluation.
- React components in `src/ui/` only render state and dispatch actions; they are verified in the built-in browser.
- **Plan 2b** follows: the Fit, Recommend and Stress panels, the trust indicator, project files, and the full spec §14 walkthrough. It is written after Matt has used 2a.

**Tech Stack:**
- React 19.2.6, Vite 8.0.13, @vitejs/plugin-react 6.0.2, TypeScript 5.9.3 (the versions `nanovna-web` pins);
- `node --test` for pure modules;
- the built-in browser pane for UI checks.

**Spec:**
- `docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md` (§4 grid, §5 blocks, §12 interface, §13 persistence).
- Plan 1 (the merged core): `docs/superpowers/plans/2026-10-14-rf-network-modeller-core.md`, with its ledger beside it.

All commands run from the repo root: `cd ~/code/put_github_repos_here/rf-network-modeller`.

## Global Constraints

- Keep every Plan 1 constraint: Node >= 22.13; `.ts` import extensions; `import type` for types; SI units internally; files at or under ~400 lines; fixtures only from `tools/capture_fixtures.py`.
- **Runtime dependencies:** exactly `react` 19.2.6 and `react-dom` 19.2.6. **Dev dependencies:** add `@types/react` 19.2.14, `@types/react-dom` 19.2.3, `@vitejs/plugin-react` 6.0.2 and `vite` 8.0.13.
- **Design language:** `src/ui/nanovna.css` is a verbatim copy of `nanovna-web/src/styles.css`, never edited. New classes go in `src/ui/app.css`.
  - Trace colours come from nanovna-web's `TRACE`: `#a9008b` magenta, `#173de3` blue, `#20aa35` green, `#009d9a` cyan, `#d7191c` red.
  - The accent is `#f1d51c`.
- **No React in `src/app/`.** Every function there has `node --test` tests written first. Components in `src/ui/` are checked with `npm run typecheck`, `npm run build` and a browser walkthrough; say so in each UI task rather than skipping verification.
- **Never `array.map(gammaFromZ)` or `array.map(zFromGamma)`.** `map` passes the index as their optional `z0`. Always write `(g) => zFromGamma(g)` (Plan 1 ledger, deferred minor 13).
- **Errors are shown, never swallowed:** a compile error, failed load or bad file appears as a message in the panel it concerns. An unknown value never renders as a healthy one: an open circuit reads "open" and an invalid one "invalid", never 0.
- **Theme:** stored in `localStorage` key `rfnm-theme`. Every storage read or write is wrapped in try/catch, and the app works without storage.
- **Dev server:** `npm run dev` serves `http://localhost:5181` (strict port). For UI checks, start it with Bash in the background and open the URL in the built-in browser pane (`preview_start` with `url`). Stop it when the task's check is done.
- **Commits:** Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on a feature branch; never push. There is still no remote.

## Review Focus

1. **Removing a block that empties its shunt or parallel arm** must prune the empty container, never leave a chain that throws on every keystroke. Any remaining compile error shows in the landing strip while the rest of the app keeps working. *(Task 5 prune tests; Task 3 evaluate error test.)*
2. **Editing a fitted parameter** applies the typed value to every variant and drops that parameter from every variant's fit. Otherwise the inspector shows one number while the plots use another. *(Task 3 reducer test.)*
3. **Loading a malformed, Touchstone 2.0 or non-50 Ω `.s1p`** shows that file's error and adds nothing. *(Task 8: the parser already throws; the UI test is the browser check with a bad file.)*
4. **An empty or invalid number input** reverts to the last value and never puts NaN into the chain (the `DraftNumberInput` copied from nanovna-web). Bank counts are clamped to whole numbers ≥ 0. *(Task 7 browser check.)*
5. **Removing a sweep that a measured branch still uses** keeps the sweep data (only its tag goes). Otherwise the prediction would break with "not loaded". *(Task 3 reducer test.)*

## File Structure

```
index.html  vite.config.ts                     Vite entry and config                        (Task 1)
package.json  tsconfig.json                    deps and scripts; include vite.config.ts      (Task 1)
src/main.tsx                                   React root                                   (Task 1)
src/ui/nanovna.css                             verbatim copy of nanovna-web styles.css      (Task 1)
src/ui/app.css                                 modeller classes (light + dark)              (Task 1)
src/ui/App.tsx                                 shell, layout, evaluation wiring              (Tasks 1, 4, 6, 7, 8)
src/app/grid.ts  src/app/plotmath.ts           evaluation grid; Smith / dB / VSWR / axes     (Task 2)
src/app/units.ts                               display units, Z text, block and tag text     (Task 2)
src/app/state.ts                               AppState, actions, reducer, variant chains    (Task 3)
src/app/example.ts  src/app/evaluate.ts        O7 example loader; per-variant evaluation     (Task 3)
tools/make_example.ts  public/examples/o7/*    example manifest + sweeps from the fixtures   (Task 3)
src/ui/PlotPane.tsx  src/ui/LandingStrip.tsx   canvas panes; landing table                   (Task 4)
src/app/chainEdit.ts                           palette, new blocks, insert/remove/move       (Task 5)
src/chain/types.ts                             StackBlock gains optional `design`            (Task 5)
src/ui/BlockArt.tsx  src/ui/CircuitStrip.tsx   block drawings; circuit strip + toolbar       (Task 6)
src/ui/DraftNumberInput.tsx                    verbatim copy from nanovna-web                (Task 7)
src/ui/ParamField.tsx  src/ui/Inspector.tsx    parameter row; block inspector                (Task 7)
src/ui/SweepsPanel.tsx  src/ui/StockPanel.tsx  sweep loading and tagging; HT50 stock         (Task 8)
README.md                                      how to run the app                            (Task 9)
```

Pure modules have their tests beside them (`x.test.ts`).

---

### Task 1: Web scaffold in the NanoVNA design language

**Files:**
- Modify: `package.json` (dependencies, scripts), `tsconfig.json` (include `vite.config.ts`)
- Create: `index.html`, `vite.config.ts`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/app.css`
- Copy: `src/ui/nanovna.css` ← `~/code/put_github_repos_here/nanovna-web/src/styles.css`

**Interfaces:**
- Produces: `npm run dev` (port 5181), `npm run build` (`tsc --noEmit && vite build`), `npm run preview`, and a default-exported `App` component.

This task is not unit-testable (build config and an empty shell). Verification is the build plus a browser screenshot.

- [ ] **Step 1: Create a feature branch and install the web dependencies**

```bash
git checkout -b feat/ui-2a
npm install --save-exact react@19.2.6 react-dom@19.2.6
npm install --save-exact -D @types/react@19.2.14 @types/react-dom@19.2.3 @vitejs/plugin-react@6.0.2 vite@8.0.13
```

Expected: `package.json` lists `react` and `react-dom` under `dependencies` and the four new dev dependencies; no install errors.

- [ ] **Step 2: Add the scripts and include the Vite config in the type check**

In `package.json`, set `"scripts"` to:

```json
{
  "dev": "vite --port 5181 --strictPort",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview --port 5182 --strictPort",
  "test": "node --experimental-strip-types --test 'src/**/*.test.ts' 'tools/**/*.test.ts'",
  "typecheck": "tsc --noEmit",
  "validate": "node --experimental-strip-types tools/validate.ts",
  "example": "node --experimental-strip-types tools/make_example.ts"
}
```

In `tsconfig.json`, change `"include"` to `["src/**/*.ts", "src/**/*.tsx", "tools/**/*.ts", "vite.config.ts"]`.

- [ ] **Step 3: Write the entry files**

`vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({ base: './', plugins: [react()] });
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#cfcfcd" />
    <title>RF Network Modeller</title>
    <script>try{document.documentElement.dataset.theme=localStorage.getItem('rfnm-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.tsx';
import './ui/nanovna.css';
import './ui/app.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/ui/App.tsx` (the shell; Task 4 replaces it):

```tsx
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rfnm-theme', theme);
    } catch {
      // storage unavailable: the theme still applies for this session
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1e20' : '#cfcfcd');
  }, [theme]);
  return (
    <div className="application">
      <div className="window-title">
        <span>RF NETWORK MODELLER</span>
        <div className="window-actions">
          <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        </div>
      </div>
      <main className="main-grid">
        <aside className="controls-column"><fieldset><legend>Project</legend><small>Loading…</small></fieldset></aside>
        <section className="readouts-column"><fieldset><legend>Block</legend><small>Select a block.</small></fieldset></section>
        <section className="charts-grid"><div className="circuit full-row"><small>Circuit</small></div></section>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Copy the NanoVNA stylesheet verbatim and add the modeller classes**

```bash
cp ~/code/put_github_repos_here/nanovna-web/src/styles.css src/ui/nanovna.css
```

`src/ui/app.css`:

```css
/* RF Network Modeller additions on top of the NanoVNA Web stylesheet (nanovna.css is a verbatim copy; never edit it). */
.charts-grid > .full-row { grid-column: 1 / -1; }
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
.circuit { padding: 8px; border: 1px solid var(--edge); border-radius: 6px; background: linear-gradient(145deg, var(--surface-high), #dfdfdc); box-shadow: inset 0 1px rgba(255,255,255,.95), 0 4px 8px rgba(0,0,0,.12); }
.circuit-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 8px; }
.toolbar-spacer { flex: 1; }
.circuit-row { display: flex; align-items: flex-start; overflow-x: auto; padding: 4px 2px 6px; }
.port-tag { align-self: center; padding: 3px 6px; border: 1px solid #a9a9a6; border-radius: 3px; background: #d7d7d4; font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
.wire-seg { align-self: center; flex: 0 0 12px; height: 2px; background: #777773; }
.block-card { display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 2px; min-width: 96px; max-width: 132px; min-height: 0; padding: 5px 6px; font-weight: 400; color: inherit; }
.block-card b { font-size: 10px; }
.block-card span { max-width: 120px; overflow: hidden; color: #555; font-family: 'SFMono-Regular', Consolas, monospace; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.block-card.selected, .block-group.selected { border-color: #aa9710; box-shadow: 0 0 0 2px rgba(241,213,28,.65); }
.block-art { color: #3b3b38; }
.block-group { flex: 0 0 auto; padding: 4px 6px 6px; border: 1px dashed #8d8d88; border-radius: 4px; background: rgba(255,255,255,.35); }
.block-group > header { margin-bottom: 4px; cursor: pointer; color: #4c4c48; font-size: 9px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; }
.group-arms { display: flex; gap: 8px; }
.group-col { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ground { color: #555; font-size: 14px; line-height: 1; }
.landing { display: grid; grid-template-columns: minmax(150px, auto) 1fr auto auto; gap: 3px 12px; align-items: baseline; padding: 7px 10px; border: 1px solid var(--edge); border-top: 3px solid var(--yellow); border-radius: 3px; background: var(--surface); font-family: 'SFMono-Regular', Consolas, monospace; font-size: 10px; }
.landing b { font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
.landing .swatch { display: inline-block; width: 12px; height: 3px; margin-right: 5px; vertical-align: middle; }
.landing .error { grid-column: 2 / -1; color: #a11414; }
.landing-total { grid-column: 1 / -1; color: #4c4c48; }
.sweep-list { display: grid; gap: 4px; margin: 6px 0; }
.sweep-row { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto 27px; gap: 4px; align-items: center; padding: 3px; border-radius: 3px; }
.sweep-row.active { background: rgba(241,213,28,.17); }
.sweep-row input { min-height: 0; margin: 0; }
.sweep-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sweep-tag { grid-column: 2 / -1; margin-top: 0; }
.stock-grid { display: grid; grid-template-columns: auto 1fr auto auto; gap: 4px 8px; align-items: center; }
.stock-grid input { width: 100%; text-align: right; }
html[data-theme='dark'] .circuit { border-color: #111214; background: linear-gradient(145deg, #36373a, #292a2d); }
html[data-theme='dark'] .block-art, html[data-theme='dark'] .block-card span, html[data-theme='dark'] .ground { color: #c9c9c4; }
html[data-theme='dark'] .block-group { border-color: #6c6d70; background: rgba(0,0,0,.18); }
html[data-theme='dark'] .block-group > header, html[data-theme='dark'] .landing-total { color: #c7c7c2; }
html[data-theme='dark'] .port-tag { border-color: #111214; background: #3b3c3f; }
html[data-theme='dark'] .landing { border-color: #111214; border-top-color: var(--yellow); background: #2c2d30; }
html[data-theme='dark'] .badge.typed { background: #45464a; color: #d0d0cb; }
html[data-theme='dark'] .badge.fit { background: #1f4a28; color: #a9e7b4; }
html[data-theme='dark'] .badge.est { background: #4d3a12; color: #f3cf86; }
html[data-theme='dark'] .bad { color: #ff8a80; }
html[data-theme='dark'] .ok { color: #8be39b; }
```

- [ ] **Step 5: Verify the build and the existing suite**

Run: `npm run build && npm test`
Expected:
- `tsc` is silent and `vite build` writes `dist/` with `index.html` and an `assets/` folder;
- the existing 151 tests still pass.

Add `dist/` to `.gitignore` if it is not already there.

- [ ] **Step 6: Browser check (not unit-testable)**

Start `npm run dev` in the background (Bash, `run_in_background`), then open `http://localhost:5181` in the built-in browser pane.

Expected screenshot:
- the grey NanoVNA instrument panel;
- title bar "RF NETWORK MODELLER" with a Dark/Light button;
- three columns: "PROJECT", "BLOCK", and the circuit area.

Click Dark: the panel turns dark. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore index.html vite.config.ts src/main.tsx src/ui/App.tsx src/ui/nanovna.css src/ui/app.css
git commit -m "feat(ui): scaffold the web app in the NanoVNA design language" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Evaluation grid, plot math and display units

**Files:**
- Create: `src/app/grid.ts`, `src/app/plotmath.ts`, `src/app/units.ts`
- Test: `src/app/grid.test.ts`, `src/app/plotmath.test.ts`, `src/app/units.test.ts`

**Interfaces:**
- Consumes: `Complex`, `cx`, `abs`, `OPEN` (engine); `gammaFromZ` (io/sweep); `allBlocks`, `findBlock`, `StateOverrides` (chain/state); `Window`, `Block`, `Chain` (chain/types); `ParamKey` (fit/params); `CAP_VALUES`, `countsPf`, `Counts` (blocks/ht50); presets for tests.
- Produces:
  - `grid.ts`: `F0`, `defaultGrid(): number[]` (1–30 MHz × 2,000 plus exactly 13.56 MHz), `evalGrid(chain, sweeps): number[]`
  - `plotmath.ts`: `interface XY`, `smithXY(g, cx, cy, r)`, `windowOutline(w, perEdge = 48): Complex[]`, `s11dB(z)`, `vswr(z)`, `rxExtent(values)`, `spanIndices(f, lo, hi)`
  - `units.ts`: `interface DisplayUnit { scale; unit }`, `displayUnit(block, key)`, `toDisplay(si, u)`, `fmtZ(z)`, `partsText(counts)`, `blockSummary(block)`, `tagSummary(chain, state)`

- [ ] **Step 1: Write the failing tests**

`src/app/grid.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { O7_FILES, o7Chain } from '../chain/presets.ts';
import { F0, defaultGrid, evalGrid } from './grid.ts';
import { loadFixtureSweep } from '../testutil.ts';

test('default grid: 1–30 MHz, 2,000 points plus exactly 13.56 MHz, strictly increasing (spec §4)', () => {
  const g = defaultGrid();
  assert.equal(g.length, 2001);
  assert.equal(g[0], 1e6);
  assert.equal(g[g.length - 1], 30e6);
  assert.ok(g.includes(F0));
  assert.ok(g.every((f, i) => i === 0 || f > g[i - 1]));
});

test("the grid is the measured branch's own sweep grid when that sweep is loaded", () => {
  const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
  assert.equal(evalGrid(o7Chain('capfree'), { capfree }), capfree.f);
  assert.equal(evalGrid(o7Chain('capfree'), {}).length, 2001);
});
```

`src/app/plotmath.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN, cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { gammaFromZ } from '../io/sweep.ts';
import { rxExtent, s11dB, smithXY, spanIndices, vswr, windowOutline } from './plotmath.ts';
import { assertClose, assertNear } from '../testutil.ts';

test('the AIT window outline is a closed loop inside the unit circle starting at 5 + j6', () => {
  const g = windowOutline(AIT_WINDOW, 4);
  assert.equal(g.length, 17);
  assertClose(g[0], gammaFromZ(cx(5, 6)), 1e-12);
  assertClose(g[16], g[0], 1e-12);
  assert.ok(g.every((x) => Math.hypot(x.re, x.im) < 1));
});

test('S11 in dB and VSWR', () => {
  assertNear(s11dB(cx(150)), 20 * Math.log10(0.5), 1e-12);
  assertNear(s11dB(cx(50)), -240, 1e-9);
  assertNear(vswr(cx(150)), 3, 1e-12);
  assert.equal(vswr(OPEN), Number.POSITIVE_INFINITY);
});

test('smithXY: Γ = 0 at the centre, Γ = +j at the top', () => {
  assert.deepEqual(smithXY(cx(0), 100, 80, 50), { x: 100, y: 80 });
  assert.deepEqual(smithXY(cx(0, 1), 100, 80, 50), { x: 100, y: 30 });
});

test('R/X extent stays between 50 and 500 Ω and ignores non-finite values', () => {
  assert.equal(rxExtent([1, -2, Number.NaN]), 50);
  assertNear(rxExtent([100, -300]), 315, 1e-12);
  assert.equal(rxExtent([716, 3e4, Number.POSITIVE_INFINITY]), 500);
});

test('spanIndices keeps the points inside [lo, hi]', () => assert.deepEqual(spanIndices([9e6, 10e6, 13e6, 17e6, 18e6], 10e6, 17e6), [1, 2, 3]));
```

`src/app/units.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN, cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { o7Chain, o7State } from '../chain/presets.ts';
import type { Block } from '../chain/types.ts';
import { blockSummary, displayUnit, fmtZ, partsText, tagSummary, toDisplay } from './units.ts';

const chain = o7Chain('capfree');
const get = (id: string): Block => findBlock(chain, id) as Block;

test('display units by parameter, with primitives by kind', () => {
  assert.deepEqual(displayUnit(get('Ls'), 'L'), { scale: 1e-9, unit: 'nH' });
  assert.deepEqual(displayUnit(get('branch'), 'd'), { scale: 0.01, unit: '%' });
  assert.deepEqual(displayUnit({ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: { value: 1e-10, badge: 'typed', free: false, lo: 0, hi: 1 } }, 'value'), { scale: 1e-12, unit: 'pF' });
  assert.equal(toDisplay(300e-9, { scale: 1e-9, unit: 'nH' }), 300);
});

test('impedance text distinguishes open and invalid from numbers', () => {
  assert.equal(fmtZ(cx(7.244, -18.004)), '7.24 − j18.00 Ω');
  assert.equal(fmtZ(OPEN), 'open');
  assert.equal(fmtZ(cx(Number.NaN, Number.NaN)), 'invalid');
});

test('block and part summaries', () => {
  assert.equal(partsText(counts(1, 1, 1)), '1×100 + 1×50 + 1×30');
  assert.equal(partsText(counts()), 'empty');
  assert.equal(blockSummary(get('ser')), '1×50 + 1×30 = 80 pF');
  assert.equal(blockSummary(get('Ls')), '300 nH');
  assert.equal(blockSummary(get('branch')), 'measured, loop on');
});

test('a sweep tag reads as bank values and the loop state', () => {
  assert.equal(tagSummary(chain, o7State(counts(1, 0, 1), counts(2, 0, 1), false)), 'Series bank 130 pF · Shunt bank 230 pF · loop off');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/app/grid.test.ts src/app/plotmath.test.ts src/app/units.test.ts`
Expected: FAIL with `Cannot find module` for `grid.ts`, `plotmath.ts` and `units.ts`.

- [ ] **Step 3: Write the implementations**

`src/app/grid.ts`:

```ts
import { allBlocks } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import type { Sweep } from '../io/sweep.ts';

export const F0 = 13.56e6;

/** 1–30 MHz, 2,000 points linear, plus exactly 13.56 MHz (spec §4). */
export function defaultGrid(): number[] {
  const n = 2000;
  const g = Array.from({ length: n }, (_, i) => 1e6 + ((30e6 - 1e6) * i) / (n - 1));
  if (!g.includes(F0)) {
    g.push(F0);
    g.sort((a, b) => a - b);
  }
  return g;
}

/** The evaluation grid: the measured branch's own sweep grid when that sweep is loaded, else the default (spec §4). */
export function evalGrid(chain: Chain, sweeps: Record<string, Sweep>): number[] {
  for (const b of allBlocks(chain.blocks)) {
    if (b.type === 'measuredBranch' && sweeps[b.sweepId]) return sweeps[b.sweepId].f;
  }
  return defaultGrid();
}
```

`src/app/plotmath.ts`:

```ts
import { type Complex, abs, cx } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { gammaFromZ } from '../io/sweep.ts';

export interface XY {
  x: number;
  y: number;
}

/** Canvas position of a reflection coefficient on a Smith chart of the given centre and radius. */
export const smithXY = (g: Complex, cx0: number, cy0: number, radius: number): XY => ({ x: cx0 + g.re * radius, y: cy0 - g.im * radius });

/** Γ along the AIT window's boundary (R = rLo, X = xHi, R = rHi, X = xLo) as a closed loop, for shading on the Smith chart. */
export function windowOutline(w: Window, perEdge = 48): Complex[] {
  const lin = (a: number, b: number, i: number): number => a + ((b - a) * i) / perEdge;
  const z: Complex[] = [];
  for (let i = 0; i <= perEdge; i += 1) z.push(cx(w.rLo, lin(w.xLo, w.xHi, i)));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(lin(w.rLo, w.rHi, i), w.xHi));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(w.rHi, lin(w.xHi, w.xLo, i)));
  for (let i = 1; i <= perEdge; i += 1) z.push(cx(lin(w.rHi, w.rLo, i), w.xLo));
  return z.map((zz) => gammaFromZ(zz));
}

export const s11dB = (z: Complex): number => 20 * Math.log10(Math.max(abs(gammaFromZ(z)), 1e-12));

export function vswr(z: Complex): number {
  const m = abs(gammaFromZ(z));
  return m >= 1 ? Number.POSITIVE_INFINITY : (1 + m) / (1 - m);
}

/** Symmetric R/X axis extent: the largest finite |value| + 5 %, kept within 50–500 Ω so resonances do not flatten the plot. */
export function rxExtent(values: number[]): number {
  const m = values.reduce((acc, v) => (Number.isFinite(v) ? Math.max(acc, Math.abs(v)) : acc), 0);
  return Math.min(500, Math.max(50, m * 1.05));
}

/** Indices of f inside [lo, hi]. */
export const spanIndices = (f: number[], lo: number, hi: number): number[] => f.map((_, i) => i).filter((i) => f[i] >= lo && f[i] <= hi);
```

`src/app/units.ts`:

```ts
import type { Complex } from '../engine/complex.ts';
import { CAP_VALUES, type Counts, countsPf } from '../blocks/ht50.ts';
import { type StateOverrides, findBlock } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';

export interface DisplayUnit {
  scale: number;
  unit: string;
}

const NH: DisplayUnit = { scale: 1e-9, unit: 'nH' };
const PF: DisplayUnit = { scale: 1e-12, unit: 'pF' };

/** Display unit for a parameter; a primitive's value takes its kind's unit. */
export function displayUnit(block: Block, key: ParamKey): DisplayUnit {
  switch (key) {
    case 'L':
    case 'dLb':
      return NH;
    case 'C':
      return PF;
    case 'G_cube':
    case 'G_fix':
      return { scale: 1e-6, unit: 'µS' };
    case 'd':
      return { scale: 0.01, unit: '%' };
    case 'k':
    case 'kr':
      return { scale: 1, unit: '×' };
    case 'value':
      if (block.type === 'primitive' && block.kind === 'C') return PF;
      if (block.type === 'primitive' && block.kind === 'L') return NH;
      return { scale: 1, unit: 'Ω' };
  }
}

/** SI value in display units, rounded to 8 significant figures (300e-9 shows as 300 nH). */
export const toDisplay = (si: number, u: DisplayUnit): number => Number((si / u.scale).toPrecision(8));

/** Impedance text; open and invalid never print as numbers. */
export function fmtZ(z: Complex): string {
  if (Number.isNaN(z.re) || Number.isNaN(z.im)) return 'invalid';
  if (!Number.isFinite(z.re) || !Number.isFinite(z.im)) return 'open';
  return `${z.re.toFixed(2)} ${z.im < 0 ? '−' : '+'} j${Math.abs(z.im).toFixed(2)} Ω`;
}

export const partsText = (c: Counts): string => CAP_VALUES.filter((v) => c[v] > 0).map((v) => `${c[v]}×${v}`).join(' + ') || 'empty';

/** One-line description of a block for its card. */
export function blockSummary(b: Block): string {
  switch (b.type) {
    case 'capBank': {
      const pf = (countsPf(b.counts) + b.customPf) / b.nSeries;
      const custom = b.customPf ? ` + ${b.customPf} pF` : '';
      return `${partsText(b.counts)}${custom} = ${Number(pf.toPrecision(6))} pF${b.nSeries === 2 ? ' (2 in series)' : ''}`;
    }
    case 'inductor':
      return `${toDisplay(b.L.value, NH)} nH`;
    case 'wire':
      return `${b.lengthMm} mm, ${b.awg} AWG ×${b.strands}`;
    case 'measuredBranch':
      return `measured, loop ${b.loop ? 'on' : 'off'}`;
    case 'stack':
      return `${b.unit.N_p}:${Math.round(b.unit.n * b.unit.N_p)}, ${b.unit.N_c} cores`;
    case 'plates':
      return `${toDisplay(b.C.value, PF)} pF`;
    case 'primitive': {
      if (b.kind === 'short') return 'short';
      const u = displayUnit(b, 'value');
      return `${toDisplay(b.value.value, u)} ${u.unit}`;
    }
    case 'ideal':
      return `1:${b.n}`;
    case 'coax':
      return 'variant cable';
    case 'shunt':
      return 'to ground';
    case 'parallel':
      return `${b.chains.length} arms`;
  }
}

/** A sweep's tagged state as text, e.g. "Series bank 130 pF · Shunt bank 230 pF · loop off". */
export function tagSummary(chain: Chain, state: StateOverrides): string {
  const parts: string[] = [];
  for (const [id, patch] of Object.entries(state)) {
    const b = findBlock(chain, id);
    if (b?.type === 'capBank' && patch.counts) {
      const c = patch.counts as Counts;
      const custom = typeof patch.customPf === 'number' ? patch.customPf : b.customPf;
      const ns = patch.nSeries === 2 ? 2 : patch.nSeries === 1 ? 1 : b.nSeries;
      parts.push(`${b.label} ${Number(((countsPf(c) + custom) / ns).toPrecision(6))} pF`);
    }
    if (b?.type === 'measuredBranch' && typeof patch.loop === 'boolean') parts.push(`loop ${patch.loop ? 'on' : 'off'}`);
  }
  return parts.join(' · ');
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/app/grid.test.ts src/app/plotmath.test.ts src/app/units.test.ts && npm run typecheck`
Expected: 11 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/grid.ts src/app/grid.test.ts src/app/plotmath.ts src/app/plotmath.test.ts src/app/units.ts src/app/units.test.ts
git commit -m "feat(app): add the evaluation grid, plot math and display units" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: App state, the O7 example and per-variant evaluation

**Files:**
- Create: `src/app/chainEdit.ts` (edit operations; Task 5 adds block factories), `src/app/state.ts`, `src/app/example.ts`, `src/app/evaluate.ts`, `tools/make_example.ts`
- Generate: `public/examples/o7/` (6 sweeps + `o7.json`), via `npm run example`
- Test: `src/app/chainEdit.test.ts`, `src/app/state.test.ts`, `src/app/example.test.ts`

**Interfaces:**
- Consumes:
  - core: `fromFitVars`, `getParam`, `ParamRef`; `allBlocks`, `applyState`, `findBlock`, `updateBlock`, `StateOverrides`; `compile`, `outOfRangeAt`; `inputImpedance`; `landing`, `ROOM_SEG`, `F0`, `Landing`; presets; `parseS1p`; `DEFAULT_STOCK`, `counts`;
- Produces:
  - `chainEdit.ts`: `insertAfter(chain, targetId | null, block)`, `insertInto(chain, containerId, arm, block)`, `removeBlock(chain, id)` (prunes emptied shunts, arms and parallels), `moveBlock(chain, id, -1 | 1)`
  - `state.ts`: `type PaneMode = 'smith' | 's11db' | 'rx' | 'vswr'`, `interface FitValues { refs; x; source }`, `interface TagRef { sweepId; label; state; include }`, `interface AppState { chain; variants; primary; fits; sweeps; tagged; activeSweep; stock; window; selected; view; panes }`, `type Action` (the union below), `emptyState()`, `variantChain(state, index)`, `snapshotState(chain)`, `uniqueSweepId(sweeps, filename)`, `reducer(state, action)`
  - `example.ts`: `interface ExampleSweep`, `interface ExampleFit`, `interface ExampleManifest`, `exampleState(manifest, texts)`, `loadExample(base?)`
  - `evaluate.ts`: `interface VariantResult { z; error; outOfRange; landing }`, `evaluateVariants(state, grid, caches?)`

**Rulings encoded here (from the spec, recorded so Plan 2b inherits them):**
- **One structure, per-variant values.** The chain holds structure and typed values, shared by all variants. Each variant's fitted values live in `fits[variant.name]` and are applied by `variantChain`.
- **Typing a value applies it to every variant.** It sets the badge to `typed` and removes that parameter from every variant's fit (Review Focus 2).
- **Chain edits (`chainEdit.ts`) are pure functions of the chain;** removing a block prunes any shunt, arm or parallel it leaves empty (Review Focus 1).
- **The example opens as built on 2026-10-14:** series 50 + 30, shunt 100 + 50 + 30, loop on. It uses the Python 3-sweep fit plus loop shift (`fit3.x`, `loop.q` from `fixtures/python/o7_fit.json`) as each variant's fitted values, so the first screen matches the recorded predictions exactly.

- [ ] **Step 1: Write the failing tests**

`src/app/chainEdit.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { compile } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, o7Chain } from '../chain/presets.ts';
import { allBlocks, duplicateIds, findBlock } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';
import { insertAfter, insertInto, moveBlock, removeBlock } from './chainEdit.ts';
import { loadFixtureSweep } from '../testutil.ts';

const base = o7Chain('capfree');
const ids = (c: Chain): string[] => allBlocks(c.blocks).map((b) => b.id);
const bank = (id: string): Block => ({ id, label: id, type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true });
const ctx = { variant: DEFAULT_VARIANTS[0], sweeps: { capfree: loadFixtureSweep('capfree', O7_FILES.capFree) } };

test('insertAfter places a block after its target, also inside nested lists; null appends to the main chain', () => {
  const arm = findBlock(insertAfter(base, 'sh', bank('x')), 'shuntArm');
  assert.deepEqual(arm?.type === 'shunt' ? arm.chain.map((b) => b.id) : [], ['sh', 'x']);
  assert.equal(insertAfter(base, null, bank('y')).blocks.at(-1)?.id, 'y');
});

test("removing a shunt's last block removes the shunt; removing an arm's only block removes the arm (review focus 1)", () => {
  assert.equal(findBlock(removeBlock(base, 'sh'), 'shuntArm'), undefined);
  const par: Chain = { name: 'p', blocks: [{ id: 'p', label: 'p', type: 'parallel', chains: [[bank('a')], [bank('b')]] }] };
  const r2 = removeBlock(par, 'a');
  const p2 = findBlock(r2, 'p');
  assert.equal(p2?.type === 'parallel' ? p2.chains.length : -1, 1);
  assert.equal(removeBlock(r2, 'b').blocks.length, 0);
});

test('moveBlock swaps within its own list and stops at the ends', () => {
  assert.deepEqual(moveBlock(base, 'Ls', -1).blocks.map((b) => b.id).slice(0, 3), ['coax', 'Ls', 'ser']);
  assert.deepEqual(moveBlock(base, 'coax', -1).blocks.map((b) => b.id), base.blocks.map((b) => b.id));
});

test('insertInto appends inside a shunt, into a parallel arm, or as a new arm', () => {
  const s = ids(insertInto(base, 'shuntArm', 0, bank('x')));
  assert.deepEqual(s.slice(s.indexOf('sh'), s.indexOf('sh') + 2), ['sh', 'x']);
  const par: Chain = { name: 'p', blocks: [{ id: 'p', label: 'p', type: 'parallel', chains: [[bank('a')]] }] };
  const p = findBlock(insertInto(par, 'p', 1, bank('b')), 'p');
  assert.equal(p?.type === 'parallel' ? p.chains.length : -1, 2);
});

test('edited chains keep unique ids and still compile', () => {
  for (const c of [insertAfter(base, 'Ls', bank('x')), removeBlock(base, 'sh'), moveBlock(base, 'Ls', -1), insertInto(base, 'branchArm', 0, bank('z'))]) {
    assert.deepEqual(duplicateIds(c), []);
    compile(c, ctx);
  }
});
```

`src/app/state.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { findBlock } from '../chain/state.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain } from '../chain/presets.ts';
import type { Sweep } from '../io/sweep.ts';
import { getParam } from '../fit/params.ts';
import { type AppState, emptyState, reducer, snapshotState, uniqueSweepId, variantChain } from './state.ts';
import { loadFixtureSweep } from '../testutil.ts';

const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
const base: AppState = {
  ...emptyState(),
  chain: o7Chain('capfree'),
  variants: DEFAULT_VARIANTS,
  sweeps: { capfree },
  fits: {
    [DEFAULT_VARIANTS[0].name]: { refs: O7_REFS, x: [330, 92, 1.07, 1.2, 0.49], source: 'test' },
    [DEFAULT_VARIANTS[1].name]: { refs: O7_REFS, x: [250, 108, 1.1, 1.17, 0.49], source: 'test' },
  },
};
const ls = { blockId: 'Ls', key: 'L' as const };

test("variantChain applies each variant's fitted values; a variant without a fit uses the typed chain", () => {
  assert.equal(getParam(variantChain(base, 0), ls).value, 330e-9);
  assert.equal(getParam(variantChain(base, 1), ls).value, 250e-9);
  assert.equal(getParam(variantChain(base, 2), ls).value, 300e-9);
});

test('typing a value applies it to every variant and drops it from every fit (review focus 2)', () => {
  const s = reducer(base, { type: 'setParam', ref: ls, value: 410e-9 });
  for (const i of [0, 1, 2]) assert.equal(getParam(variantChain(s, i), ls).value, 410e-9);
  assert.equal(getParam(s.chain, ls).badge, 'typed');
  assert.ok(Object.values(s.fits).every((f) => !f.refs.some((r) => r.blockId === 'Ls' && r.key === 'L')));
  assert.equal(getParam(variantChain(s, 0), { blockId: 'Lb', key: 'L' }).value, 92e-9);
});

test('removing a block drops its fitted values and clears the selection', () => {
  const s = reducer({ ...base, selected: 'Ls' }, { type: 'remove', id: 'Ls' });
  assert.equal(findBlock(s.chain, 'Ls'), undefined);
  assert.equal(s.selected, null);
  assert.ok(Object.values(s.fits).every((f) => f.refs.every((r) => r.blockId !== 'Ls') && f.x.length === f.refs.length));
  variantChain(s, 0);
});

test('a loaded sweep is tagged with the circuit as it is; applySweepState restores that circuit', () => {
  const sweep: Sweep = { id: 'x', name: 'x.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  const s1 = reducer(base, { type: 'addSweep', sweep, label: 'x' });
  assert.deepEqual(s1.tagged.at(-1)?.state, snapshotState(base.chain));
  assert.equal(s1.activeSweep, 'x');
  const s2 = reducer(s1, { type: 'patchBlock', id: 'sh', patch: { counts: counts(2, 0, 0) } });
  const s3 = reducer(s2, { type: 'applySweepState', sweepId: 'x' });
  assert.deepEqual((findBlock(s3.chain, 'sh') as { counts: unknown }).counts, counts(1, 1, 1));
});

test('include, active and remove; a sweep a measured branch uses keeps its data (review focus 5)', () => {
  const sweep: Sweep = { id: 'x', name: 'x.s1p', f: [13.56e6], gamma: [{ re: 0, im: 0 }] };
  let s = reducer(base, { type: 'addSweep', sweep, label: 'x' });
  s = reducer(s, { type: 'toggleInclude', sweepId: 'x' });
  assert.equal(s.tagged.at(-1)?.include, false);
  s = reducer(s, { type: 'removeSweep', sweepId: 'x' });
  assert.equal(s.sweeps.x, undefined);
  assert.equal(s.activeSweep, null);
  const t = reducer({ ...base, tagged: [{ sweepId: 'capfree', label: 'cap-free', state: {}, include: false }] }, { type: 'removeSweep', sweepId: 'capfree' });
  assert.ok(t.sweeps.capfree);
  assert.equal(t.tagged.length, 0);
});

test('uniqueSweepId sanitizes file names and avoids collisions', () => {
  assert.equal(uniqueSweepId({}, 'noAIT 80/200.s1p'), 'noAIT-80-200');
  assert.equal(uniqueSweepId({ 'a-b': capfree }, 'a b.s1p'), 'a-b-2');
});
```

`src/app/example.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_VARIANTS, O7_FILES } from '../chain/presets.ts';
import { evaluateVariants } from './evaluate.ts';
import { type ExampleManifest, exampleState } from './example.ts';
import { evalGrid } from './grid.ts';
import { reducer } from './state.ts';
import { ROOT, assertClose, pair, readFixtureJson } from '../testutil.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const texts = Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)]));
const fx = readFixtureJson<{ variants: { fit3: { x: number[] }; loop: { q: number; pred_80_180_loop: number[] } }[] }>('o7_fit.json');

test('the example manifest carries the captured Python fits', () => {
  assert.equal(m.fits.length, DEFAULT_VARIANTS.length);
  m.fits.forEach((f, i) => {
    assert.equal(f.variant, DEFAULT_VARIANTS[i].name);
    assert.deepEqual(f.x, fx.variants[i].fit3.x);
    assert.equal(f.q, fx.variants[i].loop.q);
  });
});

test('the example sweeps are byte-identical to the fixtures', () => {
  assert.equal(read(`public/examples/o7/${m.capFree}`), read(`fixtures/sweeps/${O7_FILES.capFree}`));
  assert.equal(read('public/examples/o7/80-180-loop.s1p'), read(`fixtures/sweeps/${O7_FILES.s80_180_loop}`));
});

test('the example opens at 80/180 + loop and lands where the Python predicted', () => {
  const s = exampleState(m, texts);
  const r = evaluateVariants(s, evalGrid(s.chain, s.sweeps));
  r.forEach((v, i) => {
    assert.equal(v.error, null);
    assertClose(v.landing?.z ?? { re: Number.NaN, im: 0 }, pair(fx.variants[i].loop.pred_80_180_loop), 1e-9, `variant ${i}`);
  });
  assert.deepEqual(r.map((v) => v.landing?.inWindow), [true, true, false]);
});

test('an invalid circuit becomes a message for every variant, not a crash (review focus 1)', () => {
  const s = exampleState(m, texts);
  const broken = reducer(s, { type: 'patchBlock', id: 'shuntArm', patch: { chain: [] } });
  const r = evaluateVariants(broken, evalGrid(broken.chain, broken.sweeps));
  assert.ok(r.every((v) => v.error !== null && /empty/.test(v.error) && v.landing === null));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/app/chainEdit.test.ts src/app/state.test.ts src/app/example.test.ts`
Expected: FAIL with `Cannot find module` for `chainEdit.ts` and `state.ts`, and for `example.test.ts` an `ENOENT` on `public/examples/o7/o7.json`.

- [ ] **Step 3: Write the implementations**

`src/app/chainEdit.ts` (edit operations; Task 5 adds the block factories):

```ts
import { mapBlocks } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';

function editList(blocks: Block[], id: string, fn: (list: Block[], i: number) => Block[]): Block[] | null {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) return fn(blocks, i);
  for (let k = 0; k < blocks.length; k += 1) {
    const b = blocks[k];
    if (b.type === 'shunt') {
      const inner = editList(b.chain, id, fn);
      if (inner) return blocks.map((x, j) => (j === k ? { ...b, chain: inner } : x));
    }
    if (b.type === 'parallel') {
      for (let a = 0; a < b.chains.length; a += 1) {
        const inner = editList(b.chains[a], id, fn);
        if (inner) return blocks.map((x, j) => (j === k ? { ...b, chains: b.chains.map((c, ai) => (ai === a ? inner : c)) } : x));
      }
    }
  }
  return null;
}

export function insertAfter(chain: Chain, targetId: string | null, block: Block): Chain {
  if (targetId === null) return { ...chain, blocks: [...chain.blocks, block] };
  const next = editList(chain.blocks, targetId, (list, i) => [...list.slice(0, i + 1), block, ...list.slice(i + 1)]);
  return next ? { ...chain, blocks: next } : { ...chain, blocks: [...chain.blocks, block] };
}

export function insertInto(chain: Chain, containerId: string, arm: number, block: Block): Chain {
  return {
    ...chain,
    blocks: mapBlocks(chain.blocks, (b) => {
      if (b.id !== containerId) return b;
      if (b.type === 'shunt') return { ...b, chain: [...b.chain, block] };
      if (b.type === 'parallel') return { ...b, chains: arm >= b.chains.length ? [...b.chains, [block]] : b.chains.map((c, i) => (i === arm ? [...c, block] : c)) };
      return b;
    }),
  };
}

function prune(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === 'shunt') {
      const c = prune(b.chain);
      return c.length ? [{ ...b, chain: c }] : [];
    }
    if (b.type === 'parallel') {
      const arms = b.chains.map(prune).filter((c) => c.length);
      return arms.length ? [{ ...b, chains: arms }] : [];
    }
    return [b];
  });
}

export function removeBlock(chain: Chain, id: string): Chain {
  const next = editList(chain.blocks, id, (list, i) => [...list.slice(0, i), ...list.slice(i + 1)]);
  return next ? { ...chain, blocks: prune(next) } : chain;
}

export function moveBlock(chain: Chain, id: string, dir: -1 | 1): Chain {
  const next = editList(chain.blocks, id, (list, i) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const out = list.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });
  return next ? { ...chain, blocks: next } : chain;
}
```

`src/app/state.ts`:

```ts
import { type Counts, DEFAULT_STOCK } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS } from '../chain/presets.ts';
import { type StateOverrides, allBlocks, applyState, findBlock, updateBlock } from '../chain/state.ts';
import type { Block, Chain, Param, Variant, Window } from '../chain/types.ts';
import { type ParamRef, fromFitVars, getParam, withParamValue } from '../fit/params.ts';
import type { Sweep } from '../io/sweep.ts';
import { insertAfter, insertInto, moveBlock, removeBlock } from './chainEdit.ts';

export type PaneMode = 'smith' | 's11db' | 'rx' | 'vswr';

/** One variant's fitted parameter values (fit variables in FIT_UNIT / unitOf units, as fromFitVars expects). */
export interface FitValues {
  refs: ParamRef[];
  x: number[];
  source: string;
}

/** A loaded caps-in sweep, the circuit state it was taken in, and whether fits use it. */
export interface TagRef {
  sweepId: string;
  label: string;
  state: StateOverrides;
  include: boolean;
}

export interface AppState {
  chain: Chain;
  variants: Variant[];
  primary: number;
  fits: Record<string, FitValues>;
  sweeps: Record<string, Sweep>;
  tagged: TagRef[];
  activeSweep: string | null;
  stock: Counts;
  window: Window;
  selected: string | null;
  view: 'physical' | 'symbol';
  panes: PaneMode[];
}

export type Action =
  | { type: 'load'; state: AppState }
  | { type: 'select'; id: string | null }
  | { type: 'setView'; view: 'physical' | 'symbol' }
  | { type: 'setPrimary'; index: number }
  | { type: 'setPane'; index: number; mode: PaneMode }
  | { type: 'patchBlock'; id: string; patch: Record<string, unknown> }
  | { type: 'setParam'; ref: ParamRef; value: number }
  | { type: 'setFree'; ref: ParamRef; free: boolean }
  | { type: 'insertAfter'; targetId: string | null; block: Block }
  | { type: 'insertInto'; containerId: string; arm: number; block: Block }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; dir: -1 | 1 }
  | { type: 'addSweep'; sweep: Sweep; label: string }
  | { type: 'toggleInclude'; sweepId: string }
  | { type: 'removeSweep'; sweepId: string }
  | { type: 'setActiveSweep'; sweepId: string | null }
  | { type: 'applySweepState'; sweepId: string }
  | { type: 'setStock'; stock: Counts };

export function emptyState(): AppState {
  return {
    chain: { name: 'Untitled network', blocks: [] },
    variants: DEFAULT_VARIANTS,
    primary: 0,
    fits: {},
    sweeps: {},
    tagged: [],
    activeSweep: null,
    stock: DEFAULT_STOCK,
    window: AIT_WINDOW,
    selected: null,
    view: 'physical',
    panes: ['smith', 's11db', 'rx', 'vswr'],
  };
}

/** The chain with a variant's fitted values applied. */
export function variantChain(s: AppState, index: number): Chain {
  const v = s.variants[index];
  const f = v ? s.fits[v.name] : undefined;
  return f && f.refs.length ? fromFitVars(s.chain, f.refs, f.x, 'fit') : s.chain;
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

/** A sweep id from a file name: letters, digits, '-' and '_' only, made unique against the loaded sweeps. */
export function uniqueSweepId(sweeps: Record<string, Sweep>, filename: string): string {
  const base = filename.replace(/\.s1p$/i, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'sweep';
  if (!sweeps[base]) return base;
  let k = 2;
  while (sweeps[`${base}-${k}`]) k += 1;
  return `${base}-${k}`;
}

const sameRef = (a: ParamRef, b: ParamRef): boolean => a.blockId === b.blockId && a.key === b.key;

function filterFits(fits: Record<string, FitValues>, keep: (r: ParamRef) => boolean): Record<string, FitValues> {
  return Object.fromEntries(Object.entries(fits).map(([name, f]) => {
    const idx = f.refs.map((_, i) => i).filter((i) => keep(f.refs[i]));
    return [name, { ...f, refs: idx.map((i) => f.refs[i]), x: idx.map((i) => f.x[i]) }];
  }));
}

/** Drops fitted values whose block no longer exists in the chain. */
const pruneFits = (fits: Record<string, FitValues>, chain: Chain): Record<string, FitValues> => filterFits(fits, (r) => findBlock(chain, r.blockId) !== undefined);

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'load':
      return a.state;
    case 'select':
      return { ...s, selected: a.id };
    case 'setView':
      return { ...s, view: a.view };
    case 'setPrimary':
      return a.index >= 0 && a.index < s.variants.length ? { ...s, primary: a.index } : s;
    case 'setPane':
      return { ...s, panes: s.panes.map((p, i) => (i === a.index ? a.mode : p)) };
    case 'patchBlock':
      return { ...s, chain: updateBlock(s.chain, a.id, a.patch) };
    case 'setParam':
      return { ...s, chain: withParamValue(s.chain, a.ref, a.value, 'typed'), fits: filterFits(s.fits, (r) => !sameRef(r, a.ref)) };
    case 'setFree': {
      const p: Param = getParam(s.chain, a.ref);
      return { ...s, chain: updateBlock(s.chain, a.ref.blockId, { [a.ref.key]: { ...p, free: a.free } }) };
    }
    case 'insertAfter':
      return { ...s, chain: insertAfter(s.chain, a.targetId, a.block), selected: a.block.id };
    case 'insertInto':
      return { ...s, chain: insertInto(s.chain, a.containerId, a.arm, a.block), selected: a.block.id };
    case 'remove': {
      const chain = removeBlock(s.chain, a.id);
      return { ...s, chain, fits: pruneFits(s.fits, chain), selected: s.selected && findBlock(chain, s.selected) ? s.selected : null };
    }
    case 'move':
      return { ...s, chain: moveBlock(s.chain, a.id, a.dir) };
    case 'addSweep':
      return {
        ...s,
        sweeps: { ...s.sweeps, [a.sweep.id]: a.sweep },
        tagged: [...s.tagged, { sweepId: a.sweep.id, label: a.label, state: snapshotState(s.chain), include: true }],
        activeSweep: a.sweep.id,
      };
    case 'toggleInclude':
      return { ...s, tagged: s.tagged.map((t) => (t.sweepId === a.sweepId ? { ...t, include: !t.include } : t)) };
    case 'removeSweep': {
      const usedByBranch = allBlocks(s.chain.blocks).some((b) => b.type === 'measuredBranch' && b.sweepId === a.sweepId);
      const sweeps = { ...s.sweeps };
      if (!usedByBranch) delete sweeps[a.sweepId];
      return { ...s, sweeps, tagged: s.tagged.filter((t) => t.sweepId !== a.sweepId), activeSweep: s.activeSweep === a.sweepId ? null : s.activeSweep };
    }
    case 'setActiveSweep':
      return { ...s, activeSweep: a.sweepId };
    case 'applySweepState': {
      const tag = s.tagged.find((t) => t.sweepId === a.sweepId);
      if (!tag) return s;
      const known = Object.fromEntries(Object.entries(tag.state).filter(([id]) => findBlock(s.chain, id)));
      return { ...s, chain: applyState(s.chain, known) };
    }
    case 'setStock':
      return { ...s, stock: a.stock };
  }
}
```

`src/app/evaluate.ts`:

```ts
import type { Complex } from '../engine/complex.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile, outOfRangeAt } from '../chain/compile.ts';
import type { BranchCache } from '../chain/types.ts';
import { nearestIndex } from '../io/sweep.ts';
import { F0, type Landing, ROOM_SEG, landing } from '../recommend/landing.ts';
import { type AppState, variantChain } from './state.ts';

export interface VariantResult {
  z: Complex[];
  error: string | null;
  outOfRange: boolean;
  landing: Landing | null;
}

/** Predicted Z over the grid for every variant, with its 13.56 MHz landing and drift room. Errors become messages. */
export function evaluateVariants(s: AppState, grid: number[], caches: BranchCache[] = []): VariantResult[] {
  const seg = grid.map((_, i) => i).filter((i) => grid[i] > ROOM_SEG[0] && grid[i] < ROOM_SEG[1]);
  const k0 = nearestIndex(grid, F0);
  return s.variants.map((variant, i) => {
    try {
      caches[i] ??= new Map();
      const c = compile(variantChain(s, i), { variant, sweeps: s.sweeps, cache: caches[i] });
      const z = grid.map((f) => inputImpedance(c.net, f));
      const l = seg.length ? landing(seg.map((k) => grid[k]), seg.map((k) => z[k]), s.window) : null;
      return { z, error: null, outOfRange: outOfRangeAt(c, grid[k0]), landing: l };
    } catch (e) {
      return { z: [], error: e instanceof Error ? e.message : String(e), outOfRange: false, landing: null };
    }
  });
}
```

`src/app/example.ts`:

```ts
import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
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
  return {
    chain: { ...o7Chain('capfree'), name: m.name },
    variants: DEFAULT_VARIANTS,
    primary: 0,
    fits: Object.fromEntries(m.fits.map((f) => [f.variant, { refs: [...O7_REFS, O7_LOOP_REF], x: [...f.x, f.q], source: f.source }])),
    sweeps,
    tagged: m.sweeps.map((s) => ({ sweepId: s.id, label: s.label, state: o7State(c3(s.series), c3(s.shunt), s.loop), include: true })),
    activeSweep: m.sweeps.at(-1)?.id ?? null,
    stock: DEFAULT_STOCK,
    window: AIT_WINDOW,
    selected: null,
    view: 'physical',
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
```

`tools/make_example.ts`:

```ts
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ExampleManifest } from '../src/app/example.ts';
import { DEFAULT_VARIANTS, O7_FILES } from '../src/chain/presets.ts';

/** Builds public/examples/o7/ from the fixtures: six sweeps (copied byte for byte) and the Python fits. */
const root = new URL('../', import.meta.url);
const out = new URL('public/examples/o7/', root);
mkdirSync(out, { recursive: true });
const fx = JSON.parse(readFileSync(new URL('fixtures/python/o7_fit.json', root), 'utf8')) as { variants: { length: number; fit3: { x: number[] }; loop: { q: number } }[] };
if (fx.variants.length !== DEFAULT_VARIANTS.length || fx.variants.some((v, i) => v.length !== DEFAULT_VARIANTS[i].cable.length)) {
  throw new Error('o7_fit.json variants do not match DEFAULT_VARIANTS');
}
const files: [string, string][] = [
  ['capfree.s1p', O7_FILES.capFree],
  ['130-230.s1p', O7_FILES.s130_230],
  ['100-200.s1p', O7_FILES.s100_200],
  ['80-200.s1p', O7_FILES.s80_200],
  ['80-200-loop.s1p', O7_FILES.s80_200_loop],
  ['80-180-loop.s1p', O7_FILES.s80_180_loop],
];
for (const [dst, src] of files) copyFileSync(new URL(`fixtures/sweeps/${src}`, root), new URL(dst, out));
const manifest: ExampleManifest = {
  name: 'O7 parallel 3:15 (2026-10-13 sweeps)',
  capFree: 'capfree.s1p',
  sweeps: [
    { id: 'o7-130-230', file: '130-230.s1p', label: '130/230', series: [1, 0, 1], shunt: [2, 0, 1], loop: false },
    { id: 'o7-100-200', file: '100-200.s1p', label: '100/200', series: [1, 0, 0], shunt: [2, 0, 0], loop: false },
    { id: 'o7-80-200', file: '80-200.s1p', label: '80/200', series: [0, 1, 1], shunt: [2, 0, 0], loop: false },
    { id: 'o7-80-200-loop', file: '80-200-loop.s1p', label: '80/200 + loop', series: [0, 1, 1], shunt: [2, 0, 0], loop: true },
    { id: 'o7-80-180-loop', file: '80-180-loop.s1p', label: '80/180 + loop', series: [0, 1, 1], shunt: [1, 1, 1], loop: true },
  ],
  fits: fx.variants.map((v, i) => ({
    variant: DEFAULT_VARIANTS[i].name,
    x: v.fit3.x,
    q: v.loop.q,
    source: '3-sweep fit + loop shift (o7_loopstate.py recipe, Python), captured by tools/capture_fixtures.py',
  })),
};
writeFileSync(new URL('o7.json', out), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`wrote ${files.length} sweeps and o7.json to ${out.pathname}`);
```

- [ ] **Step 4: Generate the example and run the tests**

Run: `npm run example && node --experimental-strip-types --test src/app/chainEdit.test.ts src/app/state.test.ts src/app/example.test.ts && npm run typecheck`
Expected:
- `wrote 6 sweeps and o7.json to …/public/examples/o7/`;
- 15 tests pass;
- no type errors.

The example test proves the opening screen will show 7.24 + j18.00, 6.83 + j16.89 and 4.98 + j11.52 Ω, the first two in the window.

- [ ] **Step 5: Commit**

```bash
git add src/app/state.ts src/app/state.test.ts src/app/chainEdit.ts src/app/chainEdit.test.ts src/app/evaluate.ts src/app/example.ts src/app/example.test.ts tools/make_example.ts public/examples/o7 package.json
git commit -m "feat(app): add the app state, the O7 example and per-variant evaluation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Plot panes and the landing strip, the first interactive screen

**Files:**
- Create: `src/ui/PlotPane.tsx`, `src/ui/LandingStrip.tsx`
- Replace: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `smithXY`, `windowOutline`, `s11dB`, `vswr`, `rxExtent`, `spanIndices` (Task 2); `fmtZ` (Task 2); `AppState`, `PaneMode`, `reducer`, `emptyState` (Task 3); `evaluateVariants`, `VariantResult` (Task 3); `loadExample` (Task 3); `evalGrid` (Task 2); `gammaFromZ`, `zFromGamma`, `nearestIndex`; `NOT_IN_WINDOW`.
- Produces:
  - `interface Trace { key; label; color; f; z; role: 'primary' | 'variant' | 'measured' }`, `interface Dot { key; z; color }`
  - `PlotPane({ mode, traces, dots, aitWindow, theme, onMode })`, `LandingStrip({ names, colors, results, measured })`
  - in `App.tsx`, four placeholder lines that Tasks 6–8 replace, written verbatim below.

UI rendering is verified in the browser, not by unit tests (stated per Global Constraints). Its inputs (`evaluateVariants`, plot math) are already tested.

- [ ] **Step 1: Write the plot pane**

`src/ui/PlotPane.tsx`:

```tsx
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { gammaFromZ } from '../io/sweep.ts';
import type { PaneMode } from '../app/state.ts';
import { type XY, rxExtent, s11dB, smithXY, spanIndices, vswr, windowOutline } from '../app/plotmath.ts';

export interface Trace { key: string; label: string; color: string; f: number[]; z: Complex[]; role: 'primary' | 'variant' | 'measured' }
export interface Dot { key: string; z: Complex; color: string }
type Span = 'zoom' | 'full';
interface Area { x: number; y: number; w: number; h: number }
interface DrawInput { mode: PaneMode; traces: Trace[]; dots: Dot[]; aitWindow: Window; dark: boolean; span: Span }

const ZOOM: [number, number] = [10e6, 17e6];
const F0 = 13.56e6;
const CYAN = '#009d9a';
const RED = '#d7191c';
const LABELS: Record<PaneMode, string> = { smith: 'Smith chart (S11)', s11db: '|S11| (dB)', rx: 'R and X (Ω), chosen variant', vswr: 'VSWR' };
const order = (t: Trace): number => (t.role === 'variant' ? 0 : t.role === 'measured' ? 1 : 2);
const widthOf = (t: Trace): number => (t.role === 'primary' ? 2 : 1.2);

function strokePath(ctx: CanvasRenderingContext2D, pts: XY[], color: string, width: number, dashed: boolean): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([5, 3]);
  ctx.beginPath();
  let on = false;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      on = false;
      continue;
    }
    if (on) ctx.lineTo(p.x, p.y);
    else {
      ctx.moveTo(p.x, p.y);
      on = true;
    }
  }
  ctx.stroke();
  ctx.restore();
}

function legend(ctx: CanvasRenderingContext2D, items: { label: string; color: string; dashed: boolean }[], x0: number, text: string, width: number): void {
  let x = x0;
  for (const it of items) {
    strokePath(ctx, [{ x, y: 8 }, { x: x + 14, y: 8 }], it.color, 2, it.dashed);
    ctx.fillStyle = text;
    ctx.fillText(it.label, x + 18, 11);
    x += 26 + ctx.measureText(it.label).width;
    if (x > width - 40) break;
  }
}

function drawSmith(ctx: CanvasRenderingContext2D, p: DrawInput, traces: Trace[], lo: number, hi: number, area: Area, grid: string): void {
  const radius = Math.min(area.w, area.h) * 0.48;
  const cx0 = area.x + area.w / 2;
  const cy0 = area.y + area.h / 2;
  ctx.strokeStyle = p.dark ? '#5f6268' : '#a7a7a7';
  ctx.beginPath(); ctx.arc(cx0, cy0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx0 - radius, cy0); ctx.lineTo(cx0 + radius, cy0); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx0, cy0, radius, 0, Math.PI * 2); ctx.clip();
  ctx.strokeStyle = grid;
  for (const r of [0.2, 0.5, 1, 2, 5]) { ctx.beginPath(); ctx.arc(cx0 + (radius * r) / (1 + r), cy0, radius / (1 + r), 0, Math.PI * 2); ctx.stroke(); }
  for (const x of [0.2, 0.5, 1, 2, 5]) for (const sign of [1, -1]) { ctx.beginPath(); ctx.arc(cx0 + radius, cy0 + (sign * radius) / x, radius / x, 0, Math.PI * 2); ctx.stroke(); }
  const win = windowOutline(p.aitWindow).map((g) => smithXY(g, cx0, cy0, radius));
  ctx.beginPath();
  win.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fillStyle = 'rgba(241,213,28,0.30)';
  ctx.fill();
  ctx.strokeStyle = '#aa9710';
  ctx.stroke();
  for (const t of traces) strokePath(ctx, spanIndices(t.f, lo, hi).map((i) => smithXY(gammaFromZ(t.z[i]), cx0, cy0, radius)), t.color, widthOf(t), t.role === 'measured');
  for (const d of p.dots) {
    const q = smithXY(gammaFromZ(d.z), cx0, cy0, radius);
    ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = d.color; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = p.dark ? '#17181a' : '#ffffff'; ctx.stroke();
  }
  ctx.restore();
}

function drawRect(ctx: CanvasRenderingContext2D, p: DrawInput, traces: Trace[], lo: number, hi: number, area: Area, grid: string, text: string, W: number, H: number): void {
  type Line = { pts: { f: number; v: number }[]; color: string; width: number; dashed: boolean };
  const lines: Line[] = [];
  let min = -40;
  let max = 0;
  let unit = 'dB';
  const sub = (t: Trace): number[] => spanIndices(t.f, lo, hi);
  if (p.mode === 's11db' || p.mode === 'vswr') {
    if (p.mode === 'vswr') { min = 1; max = 10; unit = 'VSWR'; }
    const val = p.mode === 's11db' ? s11dB : vswr;
    for (const t of traces) lines.push({ pts: sub(t).map((i) => ({ f: t.f[i], v: val(t.z[i]) })), color: t.color, width: widthOf(t), dashed: t.role === 'measured' });
  } else {
    unit = 'Ω';
    for (const t of traces.filter((x) => x.role !== 'variant')) {
      const idx = sub(t);
      const dashed = t.role === 'measured';
      lines.push({ pts: idx.map((i) => ({ f: t.f[i], v: t.z[i].re })), color: CYAN, width: widthOf(t), dashed });
      lines.push({ pts: idx.map((i) => ({ f: t.f[i], v: t.z[i].im })), color: RED, width: widthOf(t), dashed });
    }
    const ext = rxExtent(lines.flatMap((l) => l.pts.map((q) => q.v)));
    min = -ext;
    max = ext;
  }
  const X = (f: number): number => area.x + (area.w * (f - lo)) / Math.max(1, hi - lo);
  const Y = (v: number): number => area.y + (area.h * (max - Math.max(min, Math.min(max, v)))) / (max - min);
  ctx.strokeStyle = grid;
  ctx.fillStyle = text;
  for (let i = 0; i <= 5; i += 1) {
    const y = area.y + (area.h * i) / 5;
    ctx.beginPath(); ctx.moveTo(area.x, y); ctx.lineTo(area.x + area.w, y); ctx.stroke();
    const v = max - ((max - min) * i) / 5;
    ctx.fillText(v.toFixed(Math.abs(max - min) < 20 ? 1 : 0), 4, y + 3);
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = area.x + (area.w * i) / 5;
    ctx.beginPath(); ctx.moveTo(x, area.y); ctx.lineTo(x, area.y + area.h); ctx.stroke();
    ctx.fillText(`${((lo + ((hi - lo) * i) / 5) / 1e6).toFixed(1)} MHz`, Math.min(W - 52, x - 18), H - 8);
  }
  if (F0 >= lo && F0 <= hi) {
    ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = '#aa9710';
    ctx.beginPath(); ctx.moveTo(X(F0), area.y); ctx.lineTo(X(F0), area.y + area.h); ctx.stroke(); ctx.restore();
  }
  for (const l of lines) strokePath(ctx, l.pts.map((q) => ({ x: X(q.f), y: Y(q.v) })), l.color, l.width, l.dashed);
  if (p.mode !== 'rx') {
    for (const d of p.dots) {
      ctx.beginPath(); ctx.arc(X(F0), Y(p.mode === 's11db' ? s11dB(d.z) : vswr(d.z)), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = d.color; ctx.fill();
    }
  }
  ctx.fillStyle = text;
  ctx.fillText(unit, 4, area.y - 6);
}

function draw(canvas: HTMLCanvasElement, p: DrawInput): void {
  const ratio = window.devicePixelRatio || 1;
  const box = canvas.getBoundingClientRect();
  canvas.width = Math.floor(box.width * ratio);
  canvas.height = Math.floor(box.height * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  const W = box.width;
  const H = box.height;
  const grid = p.dark ? '#4a4c50' : '#c8c8c8';
  const text = p.dark ? '#d9d9d5' : '#333333';
  ctx.fillStyle = p.dark ? '#17181a' : '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '10px Arial, sans-serif';
  ctx.lineWidth = 1;
  if (!p.traces.length) {
    ctx.fillStyle = text;
    ctx.fillText('No prediction: the landing strip says why.', 12, 24);
    return;
  }
  const lo = p.span === 'zoom' ? ZOOM[0] : Math.min(...p.traces.map((t) => t.f[0]));
  const hi = p.span === 'zoom' ? ZOOM[1] : Math.max(...p.traces.map((t) => t.f[t.f.length - 1]));
  const traces = [...p.traces].sort((a, b) => order(a) - order(b));
  const area: Area = { x: 46, y: 20, w: W - 60, h: H - 48 };
  if (p.mode === 'smith') drawSmith(ctx, p, traces, lo, hi, area, grid);
  else drawRect(ctx, p, traces, lo, hi, area, grid, text, W, H);
  const items = p.mode === 'rx'
    ? [{ label: 'R', color: CYAN, dashed: false }, { label: 'X', color: RED, dashed: false }, ...(traces.some((t) => t.role === 'measured') ? [{ label: 'measured', color: text, dashed: true }] : [])]
    : traces.map((t) => ({ label: t.label, color: t.color, dashed: t.role === 'measured' }));
  legend(ctx, items, p.mode === 'smith' ? 8 : 46, text, W);
}

export function PlotPane({ mode, traces, dots, aitWindow, theme, onMode }: { mode: PaneMode; traces: Trace[]; dots: Dot[]; aitWindow: Window; theme: 'light' | 'dark'; onMode: (m: PaneMode) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [span, setSpan] = useState<Span>('zoom');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const o = new ResizeObserver(() => setTick((t) => t + 1));
    o.observe(c);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (ref.current) draw(ref.current, { mode, traces, dots, aitWindow, dark: theme === 'dark', span });
  }, [mode, traces, dots, aitWindow, theme, span, tick]);
  return (
    <section className="chart-panel" style={{ '--chart-height': '330px' } as CSSProperties}>
      <div className="chart-titlebar">
        <select value={mode} onChange={(e) => onMode(e.target.value as PaneMode)} aria-label="Plot">
          {(Object.keys(LABELS) as PaneMode[]).map((m) => <option key={m} value={m}>{LABELS[m]}</option>)}
        </select>
        <select value={span} onChange={(e) => setSpan(e.target.value as Span)} aria-label="Frequency span">
          <option value="zoom">10–17 MHz</option>
          <option value="full">Full span</option>
        </select>
      </div>
      <div className="chart-plot"><canvas className="trace-canvas" ref={ref} aria-label={LABELS[mode]} /></div>
    </section>
  );
}
```

- [ ] **Step 2: Write the landing strip**

`src/ui/LandingStrip.tsx`:

```tsx
import { Fragment } from 'react';
import type { Complex } from '../engine/complex.ts';
import type { VariantResult } from '../app/evaluate.ts';
import { fmtZ } from '../app/units.ts';

export function LandingStrip({ names, colors, results, measured }: { names: string[]; colors: string[]; results: VariantResult[]; measured: { label: string; z: Complex } | null }) {
  const inCount = results.filter((r) => r.landing?.inWindow).length;
  return (
    <div className="landing full-row">
      <b>13.56 MHz landing</b><b>Z at the AIT-out plane</b><b>AIT window</b><b>Drift room up / down</b>
      {results.map((r, i) => (
        <Fragment key={names[i]}>
          <span><i className="swatch" style={{ background: colors[i] }} />{names[i]}</span>
          {r.error ? <span className="error">{r.error}</span> : (
            <>
              <span>{r.landing ? fmtZ(r.landing.z) : 'no 12.5–14.6 MHz points'}{r.outOfRange ? <em className="warn-text"> · branch read outside its sweep</em> : null}</span>
              <span className={r.landing?.inWindow ? 'ok' : 'bad'}>{r.landing?.inWindow ? 'in' : 'out'}</span>
              <span>{r.landing?.inWindow ? `+${r.landing.roomUp.toFixed(2)} % / +${r.landing.roomDown.toFixed(2)} %` : '—'}</span>
            </>
          )}
        </Fragment>
      ))}
      {measured ? (
        <>
          <span><i className="swatch" style={{ background: '#777777' }} />{measured.label} (measured)</span>
          <span>{fmtZ(measured.z)}</span><span /><span />
        </>
      ) : null}
      <span className="landing-total">{inCount} of {results.length} variants put 13.56 MHz inside the AIT window.</span>
    </div>
  );
}
```

- [ ] **Step 3: Replace the app shell**

`src/ui/App.tsx`:

```tsx
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { nearestIndex, zFromGamma } from '../io/sweep.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { loadExample } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { type PaneMode, emptyState, reducer } from '../app/state.ts';
import { LandingStrip } from './LandingStrip.tsx';
import { type Dot, PlotPane, type Trace } from './PlotPane.tsx';

type Theme = 'light' | 'dark';
const VARIANT_COLORS = ['#a9008b', '#173de3', '#20aa35'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const openExample = (): void => {
    setLoadError(null);
    loadExample()
      .then((s) => dispatch({ type: 'load', state: s }))
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(openExample, []);

  const grid = useMemo(() => evalGrid(state.chain, state.sweeps), [state.chain, state.sweeps]);
  const results = useMemo(() => evaluateVariants(state, grid, caches.current), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);
  const colors = state.variants.map((_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length]);
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const traces = useMemo<Trace[]>(() => {
    const out: Trace[] = [];
    results.forEach((r, i) => {
      if (r.z.length) out.push({ key: `v${i}`, label: state.variants[i].name, color: colors[i], f: grid, z: r.z, role: i === state.primary ? 'primary' : 'variant' });
    });
    if (active) out.push({ key: 'measured', label: `${active.name} (measured)`, color: theme === 'dark' ? '#b0b0aa' : '#777777', f: active.f, z: active.gamma.map((g) => zFromGamma(g)), role: 'measured' });
    return out;
  }, [results, active, grid, state.primary, state.variants, theme]);
  const dots = useMemo<Dot[]>(() => results.flatMap((r, i) => (r.landing ? [{ key: `d${i}`, z: r.landing.z, color: colors[i] }] : [])), [results]);
  const measured = active ? { label: state.tagged.find((t) => t.sweepId === active.id)?.label ?? active.name, z: zFromGamma(active.gamma[nearestIndex(active.f, 13.56e6)]) } : null;

  return (
    <div className="application">
      <div className="window-title">
        <span>RF NETWORK MODELLER — {state.chain.name}</span>
        <div className="window-actions">
          <label className="title-select">Variant
            <select value={state.primary} onChange={(e) => dispatch({ type: 'setPrimary', index: Number(e.target.value) })}>
              {state.variants.map((v, i) => <option key={v.name} value={i}>{v.name}{v.flag ? ' (poor fit)' : ''}</option>)}
            </select>
          </label>
          <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        </div>
      </div>
      <main className="main-grid">
        <aside className="controls-column">
          <fieldset>
            <legend>Project</legend>
            {loadError ? <small className="bad">Could not load the O7 example: {loadError}</small> : <small>{state.chain.name}</small>}
            <button className="wide" onClick={openExample}>Reload O7 example</button>
          </fieldset>
          {/* SWEEPS */}
          {/* STOCK */}
        </aside>
        <section className="readouts-column">
          <fieldset><legend>Block</legend><small>The block inspector arrives in Task 7.</small></fieldset>
        </section>
        <section className="charts-grid">
          <div className="circuit full-row"><small>The circuit editor arrives in Task 6.</small></div>
          <LandingStrip names={state.variants.map((v) => v.name)} colors={colors} results={results} measured={measured} />
          {state.panes.map((mode, i) => <PlotPane key={i} mode={mode} traces={traces} dots={dots} aitWindow={state.window} theme={theme} onMode={(m: PaneMode) => dispatch({ type: 'setPane', index: i, mode: m })} />)}
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Type check, build, and run the suite**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; the Vite build succeeds; all tests pass.

- [ ] **Step 5: Browser check: the first interactive screen**

Start `npm run dev` in the background and open `http://localhost:5181`.

Expected:
- **Title bar:** "RF NETWORK MODELLER — O7 parallel 3:15 (2026-10-13 sweeps)" and a Variant selector.
- **Landing strip** (read it with `get_page_text`):
  - `7.24 + j18.00 Ω` in, `6.83 + j16.89 Ω` in, `4.98 + j11.52 Ω` out;
  - "80/180 + loop (measured)" `7.81 + j27.89 Ω`;
  - "2 of 3 variants…".
- **Four panes:**
  1. Smith chart with the yellow AIT window, three variant traces (magenta thickest), a dashed grey measured trace and three dots;
  2. |S11| dB with a dashed 13.56 MHz line;
  3. R and X (cyan/red solid, dashed measured);
  4. VSWR.

Switch a pane to "Full span" and see the 1–25 MHz trace. Choose variant "1.2825 m…" and see the blue trace become the thick one, with the R/X pane following it. Toggle Dark.

Take one screenshot in each theme and view both. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/ui/PlotPane.tsx src/ui/LandingStrip.tsx src/ui/App.tsx
git commit -m "feat(ui): live predicted Smith, |S11|, R/X and VSWR panes with the 13.56 MHz landing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Block palette and factories

**Files:**
- Modify: `src/app/chainEdit.ts` (add `NewBlockKind`, `PALETTE`, `newBlock`), `src/chain/types.ts` (`StackBlock` gains optional `design`)
- Test: `src/app/chainEdit.test.ts` (append)

**Interfaces:**
- Consumes: `counts` (ht50), `estimateUnit`, `Design` (blocks/design), `allBlocks` (chain/state), `param` (chain/types).
- Produces:
  - `type NewBlockKind = 'capBank' | 'inductor' | 'wire' | 'coax' | 'stack' | 'plates' | 'measuredBranch' | 'shunt' | 'parallel' | 'R' | 'L' | 'C' | 'short' | 'ideal'`
  - `PALETTE: readonly { kind; label }[]`
  - `newBlock(chain, kind, sweepId = ''): Block`, with ids unique against `chain`, nested blocks included
  - `StackBlock.design?: Design`

- [ ] **Step 1: Write the failing tests**

Append to `src/app/chainEdit.test.ts` (and add `PALETTE, newBlock` to its `./chainEdit.ts` import, plus `import { estimateUnit } from '../blocks/design.ts';`):

```ts
test('new blocks get ids unique against the chain, nested ones included', () => {
  assert.equal(newBlock(base, 'capBank').id, 'bank1');
  const c1 = insertAfter(base, null, newBlock(base, 'shunt'));
  const c2 = insertAfter(c1, null, newBlock(c1, 'parallel'));
  assert.deepEqual(duplicateIds(c2), []);
  assert.equal(newBlock(c2, 'capBank').id, 'bank2');
});

test('every palette entry makes a block that compiles at the end of the O7 chain', () => {
  for (const { kind } of PALETTE) {
    const c = insertAfter(base, null, newBlock(base, kind, 'capfree'));
    assert.deepEqual(duplicateIds(c), [], kind);
    compile(c, ctx);
  }
});

test('a new stack is estimated from its design with the design.py scaling laws', () => {
  const s = newBlock(base, 'stack');
  assert.equal(s.type, 'stack');
  if (s.type === 'stack') {
    assert.deepEqual(s.design, { N_p: 3, N_s: 15, N_c: 4, strap: false });
    assert.deepEqual(s.unit, estimateUnit({ N_p: 3, N_s: 15, N_c: 4, strap: false }));
    assert.equal(s.source, 'estimate');
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/app/chainEdit.test.ts`
Expected: FAIL with `does not provide an export named 'PALETTE'` (or `'newBlock'`).

- [ ] **Step 3: Write the implementation**

In `src/chain/types.ts`:
- add `import type { Design } from '../blocks/design.ts';` with the other type imports;
- change the `StackBlock` line to:

```ts
export interface StackBlock extends Base { type: 'stack'; unit: Unit; source: 'preset' | 'estimate' | 'fit'; design?: Design }
```

At the top of `src/app/chainEdit.ts`, replace the imports with:

```ts
import { counts } from '../blocks/ht50.ts';
import { estimateUnit } from '../blocks/design.ts';
import { allBlocks, mapBlocks } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';
```

and add after them:

```ts
export type NewBlockKind = 'capBank' | 'inductor' | 'wire' | 'coax' | 'stack' | 'plates' | 'measuredBranch' | 'shunt' | 'parallel' | 'R' | 'L' | 'C' | 'short' | 'ideal';

/** What the circuit toolbar can add, physical blocks first, standard parts after. */
export const PALETTE: readonly { kind: NewBlockKind; label: string }[] = [
  { kind: 'capBank', label: 'Cap bank (HT50 parts)' },
  { kind: 'inductor', label: 'Inductance (lumped L)' },
  { kind: 'wire', label: 'Wire / jumper' },
  { kind: 'coax', label: 'Coax (variant cable)' },
  { kind: 'stack', label: 'Transformer stack' },
  { kind: 'plates', label: 'Plates + load' },
  { kind: 'measuredBranch', label: 'Measured branch (sweep)' },
  { kind: 'shunt', label: 'Shunt to ground' },
  { kind: 'parallel', label: 'Parallel group' },
  { kind: 'R', label: 'Resistor' },
  { kind: 'L', label: 'Inductor' },
  { kind: 'C', label: 'Capacitor' },
  { kind: 'short', label: 'Short' },
  { kind: 'ideal', label: 'Ideal transformer' },
];

/** A new block with default values (typed badges), its ids unique against `chain`, nested blocks included. */
export function newBlock(chain: Chain, kind: NewBlockKind, sweepId = ''): Block {
  const used = new Set(allBlocks(chain.blocks).map((b) => b.id));
  const id = (base: string): string => {
    let i = 1;
    while (used.has(`${base}${i}`)) i += 1;
    used.add(`${base}${i}`);
    return `${base}${i}`;
  };
  const make = (k: NewBlockKind): Block => {
    switch (k) {
      case 'capBank':
        return { id: id('bank'), label: 'Cap bank', type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true };
      case 'inductor':
        return { id: id('L'), label: 'Inductance', type: 'inductor', L: param(100e-9, 'typed', true, -1e-6, 5e-6), R: 0 };
      case 'wire':
        return { id: id('wire'), label: 'Jumper', type: 'wire', lengthMm: 100, awg: 14, strands: 2 };
      case 'coax':
        return { id: id('coax'), label: 'Coax', type: 'coax' };
      case 'stack': {
        const design = { N_p: 3, N_s: 15, N_c: 4, strap: false };
        return { id: id('stack'), label: 'Stack', type: 'stack', unit: estimateUnit(design), source: 'estimate', design };
      }
      case 'plates':
        return { id: id('plates'), label: 'Plates + load', type: 'plates', C: param(3e-12), G_cube: param(0.3e-6), G_fix: param(1e-6) };
      case 'measuredBranch':
        return { id: id('branch'), label: 'Measured branch', type: 'measuredBranch', sweepId, kr: param(1, 'typed', true, 0.2, 3), d: param(0, 'typed', false, -2, 4), dLb: param(0, 'typed', false, -200e-9, 400e-9), loop: false };
      case 'shunt':
        return { id: id('shunt'), label: 'Shunt', type: 'shunt', chain: [make('capBank')] };
      case 'parallel':
        return { id: id('par'), label: 'Parallel', type: 'parallel', chains: [[make('inductor')], [make('inductor')]] };
      case 'R':
        return { id: id('R'), label: 'Resistor', type: 'primitive', kind: 'R', value: param(50) };
      case 'L':
        return { id: id('Lp'), label: 'Inductor', type: 'primitive', kind: 'L', value: param(100e-9, 'typed', false, 1e-9, 10e-6) };
      case 'C':
        return { id: id('Cp'), label: 'Capacitor', type: 'primitive', kind: 'C', value: param(100e-12, 'typed', false, 1e-12, 10e-9) };
      case 'short':
        return { id: id('short'), label: 'Short', type: 'primitive', kind: 'short', value: param(0) };
      case 'ideal':
        return { id: id('ideal'), label: 'Ideal transformer', type: 'ideal', n: 3 };
    }
  };
  return make(kind);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/app/chainEdit.test.ts && npm run typecheck && npm test`
Expected: 8 chain-edit tests pass; no type errors; the full suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/chainEdit.ts src/app/chainEdit.test.ts src/chain/types.ts
git commit -m "feat(app): add the block palette and factories with unique ids" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Circuit strip with physical and symbol drawings

**Files:**
- Create: `src/ui/BlockArt.tsx`, `src/ui/CircuitStrip.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `PALETTE`, `newBlock`, `NewBlockKind` (Task 5); `AppState`, `Action`, `variantChain` (Task 3); `blockSummary` (Task 2); `findBlock`; `CAP_VALUES`.
- Produces: `BlockArt({ block, view })`, `CircuitStrip({ state, dispatch })`.

UI rendering is verified in the browser. The editing logic behind it is tested in Tasks 3 and 5.

- [ ] **Step 1: Write the block drawings**

`src/ui/BlockArt.tsx`:

```tsx
import type { ReactNode } from 'react';
import { CAP_VALUES } from '../blocks/ht50.ts';
import type { Block } from '../chain/types.ts';

const LINE = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const COIL = 'M2 16H12a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0H62';
const RESISTOR = 'M2 16H14l3-7l6 14l6-14l6 14l6-14l6 14l3-7H62';
const CAPACITOR = 'M2 16H29M35 16H62M29 6V26M35 6V26';
const TRANSFORMER = 'M2 6H18M2 26H18M18 6a4 4 0 0 1 0 6.7a4 4 0 0 1 0 6.6a4 4 0 0 1 0 6.7M46 6a4 4 0 0 0 0 6.7a4 4 0 0 0 0 6.6a4 4 0 0 0 0 6.7M46 6H62M46 26H62M30 4V28M34 4V28';
const label = (text: string, y = 20, size = 9): ReactNode => <text x="32" y={y} fontSize={size} textAnchor="middle" fill="currentColor" stroke="none">{text}</text>;

function symbol(b: Block): ReactNode {
  switch (b.type) {
    case 'capBank': return <path d={CAPACITOR} />;
    case 'plates': return <><path d={CAPACITOR} /><path d="M24 29H40" /></>;
    case 'inductor': return <path d={COIL} />;
    case 'wire': return <path d="M2 16H62" strokeDasharray="4 3" />;
    case 'coax': return <><circle cx="32" cy="16" r="9" /><circle cx="32" cy="16" r="2" /><path d="M2 16H23M41 16H62" /></>;
    case 'measuredBranch': return <><rect x="16" y="7" width="32" height="18" rx="2" /><path d="M2 16H16M48 16H62" />{label('Z(f)')}</>;
    case 'stack':
    case 'ideal': return <path d={TRANSFORMER} />;
    case 'primitive': return <path d={b.kind === 'R' ? RESISTOR : b.kind === 'L' ? COIL : b.kind === 'C' ? CAPACITOR : 'M2 16H62'} />;
    default: return null;
  }
}

function physical(b: Block): ReactNode {
  switch (b.type) {
    case 'capBank': {
      const parts = CAP_VALUES.flatMap((v) => Array.from({ length: b.counts[v] }, () => v)).slice(0, 6);
      if (!parts.length) return label('empty');
      const step = 56 / parts.length;
      return <>{parts.map((v, i) => <circle key={i} cx={4 + step * (i + 0.5)} cy="16" r={v === 100 ? 7 : v === 50 ? 5.5 : 4.5} fill="rgba(201,139,74,.35)" />)}</>;
    }
    case 'inductor': return <path d={COIL} strokeWidth="2.4" />;
    case 'wire': return <path d="M2 16C12 4 20 28 32 16S52 4 62 16" strokeWidth="2.2" />;
    case 'coax': return <><rect x="6" y="11" width="52" height="10" rx="5" fill="rgba(0,0,0,.08)" /><path d="M2 16H6M58 16H62" /></>;
    case 'measuredBranch': return <><rect x="8" y="4" width="48" height="24" rx="3" /><path d="M12 22C20 8 28 8 32 16S44 26 52 10" /></>;
    case 'stack': return <><ellipse cx="21" cy="15" rx="12" ry="10" /><ellipse cx="21" cy="15" rx="5" ry="4" /><ellipse cx="43" cy="15" rx="12" ry="10" /><ellipse cx="43" cy="15" rx="5" ry="4" />{label(`${b.unit.N_p}:${Math.round(b.unit.n * b.unit.N_p)}`, 31, 7)}</>;
    case 'plates': return <><path d="M16 3V29M48 3V29" strokeWidth="3" /><rect x="27" y="11" width="10" height="10" fill="rgba(60,60,60,.45)" /></>;
    case 'primitive':
      if (b.kind === 'R') return <><path d="M2 16H18M46 16H62" /><rect x="18" y="10" width="28" height="12" rx="4" fill="rgba(201,139,74,.25)" /></>;
      if (b.kind === 'C') return <><path d="M2 16H24M40 16H62" /><circle cx="32" cy="16" r="8" fill="rgba(201,139,74,.35)" /></>;
      if (b.kind === 'L') return <path d={COIL} strokeWidth="2.4" />;
      return <path d="M2 16H62" strokeWidth="3" />;
    case 'ideal': return <path d={TRANSFORMER} />;
    default: return null;
  }
}

/** A 64 × 32 drawing of a block: what you would build (physical) or its standard symbol. */
export function BlockArt({ block, view }: { block: Block; view: 'physical' | 'symbol' }) {
  return (
    <svg className="block-art" viewBox="0 0 64 32" width="64" height="32" aria-hidden="true">
      <g {...LINE}>{view === 'physical' ? physical(block) : symbol(block)}</g>
    </svg>
  );
}
```

- [ ] **Step 2: Write the circuit strip**

`src/ui/CircuitStrip.tsx`:

```tsx
import { type Dispatch, Fragment, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Block } from '../chain/types.ts';
import { type NewBlockKind, PALETTE, newBlock } from '../app/chainEdit.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary } from '../app/units.ts';
import { BlockArt } from './BlockArt.tsx';

type Pick = (id: string) => void;

function Card({ block, selected, view, onPick }: { block: Block; selected: string | null; view: 'physical' | 'symbol'; onPick: Pick }) {
  if (block.type === 'shunt' || block.type === 'parallel') {
    const arms = block.type === 'shunt' ? [block.chain] : block.chains;
    return (
      <div className={`block-group ${selected === block.id ? 'selected' : ''}`}>
        <header onClick={() => onPick(block.id)} title="Select this group">{block.type === 'shunt' ? `${block.label} ⏚` : `${block.label} ∥`}</header>
        <div className="group-arms">
          {arms.map((arm, i) => (
            <div className="group-col" key={i}>
              {arm.map((b) => <Card key={b.id} block={b} selected={selected} view={view} onPick={onPick} />)}
              {block.type === 'shunt' ? <span className="ground" aria-label="ground">⏚</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <button type="button" className={`block-card ${selected === block.id ? 'selected' : ''}`} onClick={() => onPick(block.id)} title={blockSummary(block)}>
      <BlockArt block={block} view={view} />
      <b>{block.label}</b>
      <span>{blockSummary(block)}</span>
    </button>
  );
}

export function CircuitStrip({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [kind, setKind] = useState<NewBlockKind>('capBank');
  const view = variantChain(state, state.primary);
  const sel = state.selected ? findBlock(state.chain, state.selected) : undefined;
  const make = (): Block => newBlock(state.chain, kind, Object.keys(state.sweeps)[0] ?? '');
  const pick: Pick = (id) => dispatch({ type: 'select', id: state.selected === id ? null : id });
  return (
    <div className="circuit full-row">
      <div className="circuit-toolbar">
        <select value={kind} onChange={(e) => setKind(e.target.value as NewBlockKind)} aria-label="Block to add">
          {PALETTE.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}
        </select>
        <button onClick={() => dispatch({ type: 'insertAfter', targetId: state.selected, block: make() })}>{sel ? 'Add after selected' : 'Add at end'}</button>
        {sel && (sel.type === 'shunt' || sel.type === 'parallel') ? <button onClick={() => dispatch({ type: 'insertInto', containerId: sel.id, arm: 0, block: make() })}>Add inside</button> : null}
        {sel?.type === 'parallel' ? <button onClick={() => dispatch({ type: 'insertInto', containerId: sel.id, arm: sel.chains.length, block: make() })}>Add arm</button> : null}
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'move', id: sel.id, dir: -1 })} aria-label="Move left">◀</button>
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'move', id: sel.id, dir: 1 })} aria-label="Move right">▶</button>
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'remove', id: sel.id })}>✕ Remove</button>
        <span className="toolbar-spacer" />
        <button onClick={() => dispatch({ type: 'setView', view: state.view === 'physical' ? 'symbol' : 'physical' })}>⇄ {state.view === 'physical' ? 'Symbol view' : 'Physical view'}</button>
      </div>
      <div className="circuit-row">
        <span className="port-tag">VNA / AIT out</span>
        {view.blocks.map((b) => (
          <Fragment key={b.id}>
            <span className="wire-seg" />
            <Card block={b} selected={state.selected} view={state.view} onPick={pick} />
          </Fragment>
        ))}
        <span className="wire-seg" />
        <span className="port-tag">open end</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the app**

In `src/ui/App.tsx`:
- add `import { CircuitStrip } from './CircuitStrip.tsx';` after the `LandingStrip` import;
- replace the line

```tsx
          <div className="circuit full-row"><small>The circuit editor arrives in Task 6.</small></div>
```

with

```tsx
          <CircuitStrip state={state} dispatch={dispatch} />
```

- [ ] **Step 4: Type check and build**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; build succeeds; all tests pass.

- [ ] **Step 5: Browser check**

Start `npm run dev` in the background and open `http://localhost:5181`.

Expected strip, left to right:
- VNA / AIT out;
- Cage coax;
- Series bank "1×50 + 1×30 = 80 pF" (two pucks);
- Series path L;
- a "Shunt bank arm ⏚" group holding the Shunt bank "1×100 + 1×50 + 1×30 = 180 pF";
- a "Transformer arm ⏚" group holding Branch L and "O7 pair… measured, loop on";
- open end.

Then check each interaction:
1. Click ⇄: the cards switch to schematic symbols.
2. Select "Series path L" and press ◀: it moves before the series bank, and the landing values change.
3. Press ▶ to restore it: the landing strip returns to 7.24 + j18.00.
4. Select the Shunt bank and Remove: its arm disappears, and the strip shows new values, not an error.
5. Reload the O7 example.
6. Add a "Shunt to ground" at the end: a new group with "Cap bank 1×100 = 100 pF" appears.

Screenshot both views and view them. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/ui/BlockArt.tsx src/ui/CircuitStrip.tsx src/ui/App.tsx
git commit -m "feat(ui): circuit strip with physical and symbol views, add/move/remove" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Block inspector with live edits

**Files:**
- Copy: `src/ui/DraftNumberInput.tsx` ← `~/code/put_github_repos_here/nanovna-web/src/components/DraftNumberInput.tsx` (verbatim)
- Create: `src/ui/ParamField.tsx`, `src/ui/Inspector.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `displayUnit`, `toDisplay`, `blockSummary` (Task 2); `variantChain`, `Action`, `AppState` (Task 3); `estimateUnit`, `Design`; `estimateWire`; `findBlock`; `param`, `Param`, `Block`; `ParamKey`.
- Produces: `DraftNumberInput({ value, onCommit, ...inputProps })`, `ParamField({ block, k, label, param, onValue, onFree })`, `Inspector({ state, dispatch })`.

UI rendering is verified in the browser. The value semantics (typed values apply to every variant) are tested in Task 3.

- [ ] **Step 1: Copy the number input and write the parameter row**

```bash
cp ~/code/put_github_repos_here/nanovna-web/src/components/DraftNumberInput.tsx src/ui/DraftNumberInput.tsx
```

`src/ui/ParamField.tsx`:

```tsx
import type { Block, Param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { displayUnit, toDisplay } from '../app/units.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

const BADGE_TITLE = { fit: 'Fitted to sweeps', est: 'Estimated from geometry', typed: 'Typed by you' } as const;

/** One parameter: value in display units, its source badge, and whether Fit may change it (spec §5). */
export function ParamField({ block, k, label, param, onValue, onFree }: { block: Block; k: ParamKey; label: string; param: Param; onValue: (si: number) => void; onFree: (free: boolean) => void }) {
  const u = displayUnit(block, k);
  return (
    <div className="param-row">
      <label>{label}</label>
      <DraftNumberInput step="any" value={toDisplay(param.value, u)} onCommit={(v) => onValue(v * u.scale)} />
      <span>{u.unit}</span>
      <span className={`badge ${param.badge}`} title={BADGE_TITLE[param.badge]}>{param.badge}</span>
      <label className="free-toggle" title="Let Fit adjust this value">
        <input type="checkbox" checked={param.free} onChange={(e) => onFree(e.target.checked)} />fit
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Write the inspector**

`src/ui/Inspector.tsx`:

```tsx
import type { Dispatch, ReactNode } from 'react';
import { CAP_VALUES } from '../blocks/ht50.ts';
import { type Design, estimateUnit } from '../blocks/design.ts';
import { estimateWire } from '../blocks/wire.ts';
import { findBlock } from '../chain/state.ts';
import { type Block, type Param, param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary } from '../app/units.ts';
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

function fields(b: Block, s: AppState, num: Num, field: Field, patch: Patch): ReactNode[] {
  switch (b.type) {
    case 'capBank':
      return [
        ...CAP_VALUES.map((v) => num(`${v} pF parts`, b.counts[v], (n) => patch({ counts: { ...b.counts, [v]: Math.max(0, Math.round(n)) } }), { min: '0', step: '1' })),
        num('Custom pF (per group)', b.customPf, (n) => patch({ customPf: Math.max(0, n) }), { min: '0' }),
        <div className="form-row" key="ns"><label>Groups in series</label><select value={b.nSeries} onChange={(e) => patch({ nSeries: e.target.value === '2' ? 2 : 1 })}><option value={1}>1</option><option value={2}>2</option></select></div>,
        num('Slots in this bank', b.slots, (n) => patch({ slots: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        field('k', 'Cap scale k'),
        num('ESR (Ω)', b.esr, (n) => patch({ esr: Math.max(0, n) }), { min: '0' }),
        <label className="check-row" key="search"><input type="checkbox" checked={b.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> Recommend may change this bank</label>,
      ];
    case 'inductor':
      return [field('L', 'Inductance'), num('Series R (Ω)', b.R, (n) => patch({ R: Math.max(0, n) }), { min: '0' })];
    case 'wire': {
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
        <div className="form-row" key="sw"><label>Cap-free sweep</label><select value={b.sweepId} onChange={(e) => patch({ sweepId: e.target.value })}>{Object.values(s.sweeps).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>,
        <label className="check-row" key="loop"><input type="checkbox" checked={b.loop} onChange={(e) => patch({ loop: e.target.checked })} /> Sense loop installed</label>,
        field('kr', 'Branch R scale'),
        field('d', 'Loop shift'),
        field('dLb', 'Loop ΔL'),
      ];
    case 'stack': {
      const d: Design = b.design ?? { N_p: b.unit.N_p, N_s: Math.round(b.unit.n * b.unit.N_p), N_c: b.unit.N_c, strap: false };
      const set = (next: Design): void => patch({ design: next, unit: estimateUnit(next), source: 'estimate' });
      const u = b.unit;
      return [
        num('Primary turns', d.N_p, (n) => set({ ...d, N_p: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Secondary turns', d.N_s, (n) => set({ ...d, N_s: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Cores (Material 67)', d.N_c, (n) => set({ ...d, N_c: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <label className="check-row" key="strap"><input type="checkbox" checked={d.strap} onChange={(e) => set({ ...d, strap: e.target.checked })} /> Strap primary</label>,
        <small key="unit">
          Model <span className={`badge ${b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}`}>{b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}</span>:
          {' '}n {u.n.toFixed(3)}, L_leak {(u.L_leak * 1e6).toFixed(3)} µH, L_m {(u.L_m * 1e6).toFixed(3)} µH, R1 {u.R1.toFixed(3)} Ω, R2 {u.R2.toFixed(2)} Ω, C_w {(u.C_w * 1e12).toFixed(2)} pF.
          Changing turns or cores re-estimates it with the design.py scaling laws.
        </small>,
      ];
    }
    case 'plates':
      return [field('C', 'Plate C'), field('G_cube', 'Cube conductance'), field('G_fix', 'Fixture conductance')];
    case 'primitive':
      return [
        <div className="form-row" key="kind"><label>Kind</label><select value={b.kind} onChange={(e) => { const k = e.target.value as 'R' | 'L' | 'C' | 'short'; patch({ kind: k, value: PRIMITIVE_DEFAULT[k] }); }}><option value="R">Resistor</option><option value="L">Inductor</option><option value="C">Capacitor</option><option value="short">Short</option></select></div>,
        ...(b.kind === 'short' ? [] : [field('value', 'Value')]),
      ];
    case 'ideal':
      return [num('Turns ratio n (1:n)', b.n, (n) => patch({ n: n > 0 ? n : b.n }), { min: '0' })];
    case 'coax': {
      const c = s.variants[s.primary].cable;
      return [<small key="c">Uses the cable of the variant chosen in the title bar: {c.length} m, VF {c.vf}, Z₀ {c.z0} Ω, loss {c.alpha13} Np. Editing variants comes in Plan 2b.</small>];
    }
    case 'shunt':
      return [<small key="s">Everything inside runs from this node to ground. Use "Add inside" in the circuit toolbar.</small>];
    case 'parallel':
      return [<small key="p">{b.chains.length} arms between the same two nodes. "Add inside" adds to the first arm; "Add arm" adds an arm.</small>];
  }
}

export function Inspector({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const view = variantChain(state, state.primary);
  const b = state.selected ? findBlock(view, state.selected) : undefined;
  if (!b) {
    return <fieldset><legend>Block</legend><small>Click a block in the circuit to edit it. Numbers shown are for the variant chosen in the title bar; typing a value applies it to every variant.</small></fieldset>;
  }
  const patch: Patch = (p) => dispatch({ type: 'patchBlock', id: b.id, patch: p });
  const field: Field = (k, label) => (
    <ParamField key={k} block={b} k={k} label={label} param={(b as unknown as Record<string, Param>)[k]}
      onValue={(v) => dispatch({ type: 'setParam', ref: { blockId: b.id, key: k }, value: v })}
      onFree={(free) => dispatch({ type: 'setFree', ref: { blockId: b.id, key: k }, free })} />
  );
  const num: Num = (label, value, onCommit, attrs = {}) => <div className="form-row" key={label}><label>{label}</label><DraftNumberInput {...attrs} value={value} onCommit={onCommit} /></div>;
  return (
    <fieldset>
      <legend>Block</legend>
      <div className="form-row"><label>Name</label><input value={b.label} onChange={(e) => patch({ label: e.target.value })} /></div>
      <small>{blockSummary(b)} · values for {state.variants[state.primary].name}</small>
      <div className="inspector-body">{fields(b, state, num, field, patch)}</div>
    </fieldset>
  );
}
```

- [ ] **Step 3: Wire it into the app**

In `src/ui/App.tsx`:
- add `import { Inspector } from './Inspector.tsx';` after the `CircuitStrip` import;
- replace the line

```tsx
          <fieldset><legend>Block</legend><small>The block inspector arrives in Task 7.</small></fieldset>
```

with

```tsx
          <Inspector state={state} dispatch={dispatch} />
```

- [ ] **Step 4: Type check, build, and compute the browser check's expected values**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; build succeeds; all tests pass.

Then compute what the landing strip must show after setting the shunt bank to 1×100 + 1×30:

```bash
node --experimental-strip-types --input-type=module -e "
import { readFileSync } from 'node:fs';
import { exampleState } from './src/app/example.ts';
import { evaluateVariants } from './src/app/evaluate.ts';
import { evalGrid } from './src/app/grid.ts';
import { reducer } from './src/app/state.ts';
import { counts } from './src/blocks/ht50.ts';
import { fmtZ } from './src/app/units.ts';
const m = JSON.parse(readFileSync('public/examples/o7/o7.json', 'utf8'));
const t = Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, readFileSync('public/examples/o7/' + f, 'utf8')]));
const s = reducer(exampleState(m, t), { type: 'patchBlock', id: 'sh', patch: { counts: counts(1, 0, 1) } });
console.log(evaluateVariants(s, evalGrid(s.chain, s.sweeps)).map((r) => fmtZ(r.landing.z)).join(' | '));
"
```

Expected: three impedances separated by `|`. Note them.

- [ ] **Step 5: Browser check**

Start `npm run dev` in the background and open `http://localhost:5181`.

1. Select the Shunt bank. The inspector shows: 100/50/30 counts 1/1/1, Custom pF 0, Groups 1, Slots 4, "Cap scale k" with a **fit** badge and value 1.234 (the 1.245 m variant's fit), ESR 0, Recommend checkbox.
2. Set "50 pF parts" to 0 and press Enter. The card reads "1×100 + 1×30 = 130 pF", and the landing strip shows exactly the three values from Step 4.
3. Type "abc" into a count and press Escape, then blur: the value reverts and nothing changes (Review Focus 4).
4. Select "Series path L". It shows a **fit** badge at about 586.85 nH. Choose variant "1.2825 m…" in the title bar: it shows about 536.15 nH.
5. Type 500 and press Enter. The badge becomes **typed**, and the value reads 500 for every variant (Review Focus 2).
6. Select the measured branch ("O7 pair (cap-free sweep)"): loop is ticked and the loop shift shows about 3.31 % (**fit**).

Screenshot the inspector and view it. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/ui/DraftNumberInput.tsx src/ui/ParamField.tsx src/ui/Inspector.tsx src/ui/App.tsx
git commit -m "feat(ui): block inspector with badges, fit toggles and live edits" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sweeps and HT50 stock panels

**Files:**
- Create: `src/ui/SweepsPanel.tsx`, `src/ui/StockPanel.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `parseS1p`; `uniqueSweepId`, `Action`, `AppState` (Task 3); `tagSummary` (Task 2); `CAP_VALUES`, `physicalParts`, `stockLeft`, `sumCounts`; `allBlocks`; `CapBankBlock`; `DraftNumberInput` (Task 7).
- Produces: `SweepsPanel({ state, dispatch })`, `StockPanel({ state, dispatch })`.

UI rendering is verified in the browser. Tagging, include, active and remove are tested in Task 3, and file parsing in Plan 1.

- [ ] **Step 1: Write the sweeps panel**

`src/ui/SweepsPanel.tsx`:

```tsx
import { type Dispatch, useState } from 'react';
import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
import { type Action, type AppState, uniqueSweepId } from '../app/state.ts';
import { tagSummary } from '../app/units.ts';

export function SweepsPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [error, setError] = useState<string | null>(null);
  async function onFiles(files: FileList | null): Promise<void> {
    setError(null);
    const taken: Record<string, Sweep> = { ...state.sweeps };
    const problems: string[] = [];
    for (const file of Array.from(files ?? [])) {
      try {
        const t = parseS1p(await file.text());
        const id = uniqueSweepId(taken, file.name);
        const sweep: Sweep = { id, name: file.name, f: t.f, gamma: t.gamma };
        taken[id] = sweep;
        dispatch({ type: 'addSweep', sweep, label: file.name.replace(/\.s1p$/i, '') });
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (problems.length) setError(problems.join(' · '));
  }
  return (
    <fieldset>
      <legend>Sweeps</legend>
      <label className="file-picker">Load .s1p sweep(s)…<input type="file" accept=".s1p" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
      {error ? <small className="bad">{error}</small> : null}
      <small>A loaded sweep is tagged with the circuit as it is now, so set the circuit to match that build first.</small>
      <div className="sweep-list">
        {state.tagged.map((t) => (
          <div className={`sweep-row ${state.activeSweep === t.sweepId ? 'active' : ''}`} key={t.sweepId}>
            <input type="radio" name="active-sweep" checked={state.activeSweep === t.sweepId} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: t.sweepId })} title="Show on the plots" />
            <label className="sweep-name"><input type="checkbox" checked={t.include} onChange={() => dispatch({ type: 'toggleInclude', sweepId: t.sweepId })} title="Use in fits (Plan 2b)" /> {t.label}</label>
            <button onClick={() => dispatch({ type: 'applySweepState', sweepId: t.sweepId })} title="Set the circuit to the state this sweep was taken in">Set circuit</button>
            <button className="marker-remove" onClick={() => dispatch({ type: 'removeSweep', sweepId: t.sweepId })} aria-label={`Remove ${t.label}`}>×</button>
            <small className="sweep-tag">{tagSummary(state.chain, t.state)}</small>
          </div>
        ))}
      </div>
      <label className="check-row"><input type="radio" name="active-sweep" checked={state.activeSweep === null} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: null })} /> Show no measured sweep</label>
    </fieldset>
  );
}
```

- [ ] **Step 2: Write the stock panel**

`src/ui/StockPanel.tsx`:

```tsx
import type { Dispatch } from 'react';
import { CAP_VALUES, physicalParts, stockLeft, sumCounts } from '../blocks/ht50.ts';
import { allBlocks } from '../chain/state.ts';
import type { CapBankBlock } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

export function StockPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const used = sumCounts(allBlocks(state.chain.blocks).filter((b): b is CapBankBlock => b.type === 'capBank').map((b) => physicalParts(b)));
  const left = stockLeft(state.stock, used);
  return (
    <fieldset>
      <legend>HT50 stock</legend>
      <div className="stock-grid">
        <b>Value</b><b>On hand</b><b>In circuit</b><b>Left</b>
        {CAP_VALUES.map((v) => [
          <span key={`v${v}`}>{v} pF</span>,
          <DraftNumberInput key={`s${v}`} min="0" step="1" value={state.stock[v]} onCommit={(n) => dispatch({ type: 'setStock', stock: { ...state.stock, [v]: Math.max(0, Math.round(n)) } })} />,
          <span key={`u${v}`}>{used[v]}</span>,
          <span key={`l${v}`} className={left[v] < 0 ? 'bad' : ''}>{left[v]}</span>,
        ])}
      </div>
      {CAP_VALUES.some((v) => left[v] < 0) ? <small className="bad">The circuit uses more parts than you have on hand.</small> : null}
    </fieldset>
  );
}
```

- [ ] **Step 3: Wire them into the app**

In `src/ui/App.tsx`:
- add `import { StockPanel } from './StockPanel.tsx';` and `import { SweepsPanel } from './SweepsPanel.tsx';` after the `PlotPane` import;
- replace `          {/* SWEEPS */}` with `          <SweepsPanel state={state} dispatch={dispatch} />`;
- replace `          {/* STOCK */}` with `          <StockPanel state={state} dispatch={dispatch} />`.

- [ ] **Step 4: Type check and build**

Run: `npm run typecheck && npm run build && npm test`
Expected: no type errors; build succeeds; all tests pass.

- [ ] **Step 5: Browser check**

Start `npm run dev` in the background and open `http://localhost:5181`.

1. **Sweeps:** 130/230, 100/200, 80/200, 80/200 + loop and 80/180 + loop are listed with their states (e.g. "Series bank 130 pF · Shunt bank 230 pF · loop off"). 80/180 + loop is active, and its dashed trace is on the plots.
2. **Set circuit:** click it on "130/230". The series and shunt cards change to 130 and 230 pF, the loop turns off, and the predicted traces jump. Make 130/230 active and compare the dashed measurement with the predictions.
3. **Load a real file:** the built-in browser cannot drive the file dialog, so load the file in-page with `javascript_tool`:

```js
const text = await (await fetch('examples/o7/80-200.s1p')).text();
const dt = new DataTransfer();
dt.items.add(new File([text], 'my-80-200.s1p'));
const input = document.querySelector('input[type=file]');
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));
```

   Expected: a new "my-80-200" row tagged with the current circuit, made active.
4. **Load a bad file** the same way, with `new File(['# MHz S RI R 75\n1 0 0'], 'bad.s1p')`. Expected: the panel says `bad.s1p: Only 50 Ω reference impedance is supported…`, and no row is added (Review Focus 3).
5. **Stock:** it shows 10/3/2 on hand and 1/2/2 in circuit for the as-built 80/180 (one 100, two 50, two 30). Set "On hand 30 pF" to 1: Left turns red at −1 and the warning appears.

Screenshot and view it. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/ui/SweepsPanel.tsx src/ui/StockPanel.tsx src/ui/App.tsx
git commit -m "feat(ui): sweep loading, tagging and overlays; HT50 stock panel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: README and the Plan 2a walkthrough

**Files:**
- Modify: `README.md`

This task is documentation plus an end-to-end browser check. It is not unit-testable; the check below is the gate.

- [ ] **Step 1: Document how to run the app**

In `README.md`, replace the code block with:

````markdown
```bash
npm install
npm run dev         # the app at http://localhost:5181 (opens on the O7 example)
npm test            # unit + parity tests
npm run typecheck
npm run build       # static site in dist/ (open dist/index.html through any static server)
npm run validate    # blind replay of the 2026-10-13 history -> docs/validation/
npm run example     # rebuild public/examples/o7 from the fixtures
```
````

- [ ] **Step 2: Walk the whole of 2a in the browser, in both themes**

Start `npm run dev` in the background, open `http://localhost:5181`, and run this sequence. Take a screenshot at each numbered step and view it:

1. **Opening screen:** the landing strip shows 7.24 + j18.00 (in), 6.83 + j16.89 (in), 4.98 + j11.52 (out), and measured 7.81 + j27.89.
2. **Variant 1.5094 m:** the green trace becomes primary and the R/X pane follows it.
3. **Edit:** set the shunt bank to 1×100 + 1×30. The landing values match the Task 7 Step 4 command.
4. **Remove:** remove the series path L. The values change and no error appears. Reload the example.
5. **Symbol view:** switch, then switch back.
6. **Load:** load `examples/o7/80-200.s1p` via `javascript_tool` (Task 8 Step 5) and make it active.
7. **Dark theme:** repeat steps 1 and 5.
8. **Console:** read the browser console (`read_console_messages`, errors only). Expected: no errors.

Stop the dev server.

- [ ] **Step 3: Run every gate once more**

Run: `npm test && npm run typecheck && npm run build && npm run validate -- 2026-10-14`
Expected:
- all tests pass;
- no type errors;
- the build succeeds;
- validation passes 6/6 with the report unchanged (`git diff --stat docs/validation` shows nothing).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: how to run the modeller app" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## What Plan 2b will cover

Written after Matt has used 2a, against this API:

- **Fit panel:**
  - stage 2 (network fit over the included sweeps, per variant) and the loop shift;
  - stage 1 (transformer fit) and stage 0 (shorted-jumper fit → new variant);
  - results per variant: parameters ± stderr, rms per sweep, the measured-vs-model table at 12.9 / 13.1 / 13.3 / 13.45 / 13.56 MHz, ill-determined pairs;
  - **Apply** writes `fits[variant]`.
- **Recommend panel:** stock picks ranked across variants, moves text, max stress at the Stress power, **Apply**, and a Smith overlay of the selected pick.
- **Stress panel:** forward power; per-part % of HT50 rating bars; jumper and primary currents; plate voltage; the power split (T-model) or the branch total (measured branch); the flux and loop-voltage range with the measured point beside it; and scope reading → f_pri.
- **Trust chip (spec §11):** "validated" or "extrapolating", with reasons. It must check the fit's `converged` flag (Plan 1 ruling).
- **Variant editor:** cable, VF, Z₀, α, L_j and flag. Also the AIT window editor.
- **Project file:** `*.rfnm.json` (`schema: "rfnm/1"`) save / open, plus `localStorage` autosave with try/catch (spec §13).
- **Primitives:** the generic Z(f) and explicit open primitives.
- **Extra pane modes:** |Z|, phase, reflected power %, and stress bars (spec §12).
- **Spec §14 walkthrough:** O7 preset → 5 sweeps → Fit → Recommend → Stress at 500 W → light/dark.

# RF Network Modeller: Plan 1 of 2 (Headless Core and Validation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and validate the TypeScript core of the modeller: engine, blocks, chain compiler, fitter, stress calculator and recommender. When this plan is done, `npm run validate` replays Matt's 2026-10-13 sweep history blind and reproduces the Python predictions within 0.5 Ω.

**Architecture:**
- Pure TypeScript modules with no UI and no runtime dependencies, tested headless with `node --test`.
- The chain of blocks compiles to a netlist, which a complex nodal solver evaluates per frequency.
- Fitting is bounded Levenberg–Marquardt over named block parameters.
- Every model function is checked against reference outputs captured from the real Python (`rfchain.py`, `design.py`, `calib.py`, and the `o7_joint.py` / `o7_loopstate.py` recipes) on the real sweeps.
- **Plan 2 (the interface)** is written after this plan lands, against the finished core API.

**Tech Stack:**
- TypeScript 5.9.3, written to be compatible with Node's type stripping;
- Node >= 22.13 (`node --experimental-strip-types --test`);
- Python 3.12 + numpy + scipy via `uv`, used only to capture fixtures.

**Spec:** `docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md`

All commands run from the repo root: `cd ~/code/put_github_repos_here/rf-network-modeller`.

## Global Constraints

- Node >= 22.13.0; TypeScript 5.9.3; `@types/node` 22.19.19. **No runtime dependencies in Plan 1.** React and Vite arrive in Plan 2.
- Tests run with `node --experimental-strip-types --test`.
  - Imports use explicit `.ts` extensions.
  - Type-only imports use `import type` or inline `type` (`verbatimModuleSyntax`).
  - No enums, namespaces or constructor parameter properties (`erasableSyntaxOnly`).
- **Units:** SI internally; rms phasors with e^{jωt}; Z₀ = 50 Ω.
- **File size:** each file at or under ~400 lines. `src/engine`, `src/blocks`, `src/chain`, `src/fit`, `src/stress` and `src/recommend` never import React.
- **Fixtures:** files under `fixtures/python/` are produced only by `tools/capture_fixtures.py` and never edited by hand.
- **Python** always runs as `VECLIB_MAXIMUM_THREADS=2 uv run --no-project --python 3.12 --with numpy --with scipy python …`. Never the system python3.14, never installs into `.venv312`.
- **Parity tolerance** for ported closed forms: |a − b| ≤ 1e-9 · max(|b|, 1) on the complex magnitude (`assertClose`).
- **Fit gate (spec §14):** the TypeScript 13.56 MHz landing is within 0.5 Ω of the Python landing in both R and X.
- **The 13.56 MHz landing** is read at the grid point nearest 13.56 MHz (13.5622 MHz on the 10-13 sweeps).
- **AIT window:** R 5–17 Ω, X +6..+48 Ω.
- **Commits:** Conventional Commits, each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (second `-m`).
- **No remote:** the repo stays local. Never push; the private GitHub repo is created only after Matt's explicit OK.

## Review Focus

The five inputs most likely to bite a user that no ordinary test would exercise. Each has a pinned test in the task that owns the code.

1. **An empty cap bank (0 parts)** must act as an open circuit: Z_in = OPEN and Γ = 1, never NaN. *(Task 10 blockZ test; Task 11 compile test.)*
2. **An empty shunt branch or empty parallel arm** would silently short its node. Compile must throw a named `ChainError`. *(Task 11.)*
3. **A measured branch read outside its sweep's range** (a 1–30 MHz grid against a 1–25 MHz sweep, or a loop shift pushing f·(1+d) past the edge) clamps like `np.interp`, and `outOfRangeAt` reports it. *(Task 10, Task 11.)*
4. **A caps-in sweep on a different frequency grid from the cap-free sweep** must be interpolated, not index-matched. *(Task 14: a half-step-offset grid gives zero residual at the true parameters.)*
5. **Driving at power when Re(Z_in) ≤ 0 or the port is open** must raise a named `DriveError`, not return Infinity or NaN currents. *(Task 15.)*

## Evidence this plan relies on (probed 2026-10-14 against the real files)

| Fact | Evidence |
|---|---|
| The fixture recipe reproduces the recorded predictions | 80/200 from the 2-sweep fit = 6.64 + j12.59 / 6.43 + j12.67 / 4.77 + j8.01 (recorded 6.4–6.6 + j12.6; 4.8 + j8.0, `SWEEP_NOTES.md` L490). 80/180 + loop = 7.24 + j18.00 / 6.83 + j16.89 / 4.98 + j11.52 (recorded 6.7–7.2 + j16.9–18.1; 4.9–5.0 + j11.4, L522) |
| Loop shift per variant | q = 3.31 / 3.41 / 4.16 % |
| Drift room for 80/180 + loop (all-points definition) | +1.35/+0.83 and +1.42/+0.68 for the two good cables (recorded +1.3–1.4 / +0.6–0.8) |
| Enumeration size | Series combos(2) × shunt combos(4) within stock = **209** candidates (9 × 34 before the stock filter) |
| T-model fit on the O7 cap-free sweep | `calib.fit_one_port` (n 5, N_p 3, N_c 4, variant 1.245 m + 342 nH) → rms_rel 0.1099 in 1.2 s |
| Shorted-jumper fit on `coax-jumpers-shorted_for_both_trans_*`, 2–25 MHz, fixed length | L = 344 / 329 / 248 nH at 1.245 / 1.2825 / 1.5094 m (recorded 342 / 329 / 256). A free-length fit gives 1.383 m, not the recorded 1.245 m: the historical band is unknown, so free-length results are reported, never gated |
| Sweep grids | All 10-13 sweeps share one grid: 5,050 points, 1–25 MHz; the 12.0–14.6 MHz fit band holds 547 points, the 12.5–14.6 MHz room segment 442 |
| C+D preset `G_sec` | `builds_fit.json` `G_sec` = `ld.G_fix` (`fit_builds.py` L37) |

## File Structure

```
package.json  tsconfig.json  .gitignore  README.md
tools/capture_fixtures.py        Python: reference outputs from the real model code         (Task 2)
tools/replay.ts                  blind replay + report rendering (pure apart from reads)    (Task 18)
tools/validate.ts                CLI: runs the replay, writes docs/validation/*.md          (Task 18)
fixtures/sweeps/*.s1p            10 real sweeps copied from MANUAL_MATCHING_NETWORK         (Task 2)
fixtures/python/*.json           captured reference outputs                                 (Task 2)
src/testutil.ts                  assertClose, fixture readers, seeded noise                 (Tasks 1, 7, 8, 13)
src/engine/complex.ts            complex arithmetic                                         (Task 1)
src/engine/linsolve.ts           dense complex + real solvers                               (Task 3)
src/engine/twoport.ts            ABCD / Y helpers                                           (Task 4)
src/engine/coax.ts               line embed / de-embed / 2-port                             (Task 4)
src/engine/transformer.ts        T-model unit (port of rfchain)                             (Task 5)
src/engine/mna.ts                netlist + nodal solve                                      (Task 6)
src/engine/parity.test.ts        engine vs rfchain fixtures                                 (Task 7)
src/io/s1p.ts  src/io/sweep.ts   Touchstone parser; Sweep, Γ↔Z, interp, band                (Task 8)
src/blocks/ht50.ts  wire.ts  design.ts   parts data, wire estimate, stack estimate          (Task 9)
src/chain/types.ts  blockZ.ts    block types; two-terminal impedances                       (Task 10)
src/chain/compile.ts             chain → netlist                                            (Task 11)
src/chain/state.ts  presets.ts  src/fit/params.ts   states, presets, parameter refs         (Task 12)
src/fit/lm.ts                    bounded Levenberg–Marquardt + parameter statistics         (Task 13)
src/fit/network.ts               stage-2 network fit + loop shift                           (Task 14)
src/stress/drive.ts  flux.ts     drive at P, block reports, flux range, f_pri solve         (Task 15)
src/fit/tmodel.ts  short.ts      stage-1 T-model fit; stage-0 shorted-jumper fit            (Task 16)
src/recommend/enumerate.ts  landing.ts  rank.ts  recommend.ts                               (Task 17)
```

Each `src/**/x.ts` has its tests in `x.test.ts` beside it.

---

### Task 1: Scaffold and complex arithmetic

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `README.md`, `src/testutil.ts`, `src/engine/complex.ts`
- Test: `src/engine/complex.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Complex { re; im }`
  - `cx(re, im?)`, constants `ZERO`, `ONE`, `OPEN` (= `{re: Infinity, im: 0}`)
  - `add`, `sub`, `neg`, `scale(a, k)`, `conj`, `abs`, `mul`, `div` (Smith), `inv`, `exp`, `cosh`, `sinh`, `tanh`, `jw(f, x)`, `isFiniteC`
  - `src/testutil.ts`: `assertClose(a, b, rel = 1e-9, msg?)`, `assertNear(a, b, rel = 1e-9, msg?)`, `fmt(z)`, `pair([re, im])`

- [ ] **Step 1: Write the scaffold files**

`package.json`:

```json
{
  "name": "rf-network-modeller",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13.0" },
  "scripts": {
    "test": "node --experimental-strip-types --test 'src/**/*.test.ts'",
    "typecheck": "tsc --noEmit",
    "validate": "node --experimental-strip-types tools/validate.ts"
  },
  "devDependencies": {
    "@types/node": "22.19.19",
    "typescript": "5.9.3"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tools/**/*.ts"]
}
```

`.gitignore`:

```
node_modules/
dist/
.DS_Store
__pycache__/
```

`README.md`:

````markdown
# RF Network Modeller

Browser tool for designing and tuning the RFAM matching network: build a chain of blocks, see the predicted VNA
response, fit it to measured sweeps, get stock-cap recommendations and part stress. Design:
`docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md`.

```bash
npm install
npm test            # unit + parity tests
npm run typecheck
npm run validate    # blind replay of the 2026-10-13 history -> docs/validation/
```

Reference fixtures come from the real Python model (`tools/capture_fixtures.py`); never edit `fixtures/python/` by hand.
````

- [ ] **Step 2: Install the dev dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors, `package-lock.json` written.

- [ ] **Step 3: Write the failing tests**

`src/testutil.ts`:

```ts
import assert from 'node:assert/strict';
import type { Complex } from './engine/complex.ts';

/** Passes when |a - b| <= rel * max(|b|, 1), measured on the complex magnitude. */
export function assertClose(a: Complex, b: Complex, rel = 1e-9, msg = ''): void {
  const err = Math.hypot(a.re - b.re, a.im - b.im);
  const tol = rel * Math.max(Math.hypot(b.re, b.im), 1);
  assert.ok(err <= tol, `${msg} got ${fmt(a)}, want ${fmt(b)} (|err| ${err.toExponential(2)} > ${tol.toExponential(2)})`);
}

/** Passes when |a - b| <= rel * max(|b|, 1). */
export function assertNear(a: number, b: number, rel = 1e-9, msg = ''): void {
  const tol = rel * Math.max(Math.abs(b), 1);
  assert.ok(Math.abs(a - b) <= tol, `${msg} got ${a}, want ${b}`);
}

export const fmt = (z: Complex): string => `${z.re}${z.im >= 0 ? '+' : '-'}${Math.abs(z.im)}j`;
export const pair = (p: number[]): Complex => ({ re: p[0], im: p[1] });
```

`src/engine/complex.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { abs, add, conj, cosh, cx, div, exp, inv, isFiniteC, jw, mul, neg, scale, sinh, sub, tanh } from './complex.ts';
import { assertClose } from '../testutil.ts';

test('field operations', () => {
  const a = cx(3, -4);
  const b = cx(-1.5, 2);
  assertClose(add(a, b), cx(1.5, -2), 1e-15);
  assertClose(sub(a, b), cx(4.5, -6), 1e-15);
  assertClose(mul(a, b), cx(3 * -1.5 - -4 * 2, 3 * 2 + -4 * -1.5), 1e-15);
  assertClose(mul(div(a, b), b), a, 1e-14);
  assertClose(mul(inv(a), a), cx(1, 0), 1e-15);
  assert.equal(abs(a), 5);
  assertClose(conj(a), cx(3, 4), 0);
  assertClose(scale(a, 2), cx(6, -8), 0);
  assertClose(neg(a), cx(-3, 4), 0);
});

test('division stays accurate across 1e-15 .. 1e12 magnitudes', () => {
  const big = cx(1e12, 3e11);
  const tiny = cx(2e-12, -5e-13);
  assertClose(mul(div(big, tiny), tiny), big, 1e-12);
  assertClose(div(cx(1, 1), cx(0, 1e-15)), cx(1e15, -1e15), 1e-12);
});

test('hyperbolic functions', () => {
  assertClose(tanh(cx(0, Math.PI / 4)), cx(0, 1), 1e-12);
  const z = cx(0.3, 1.1);
  assertClose(sub(mul(cosh(z), cosh(z)), mul(sinh(z), sinh(z))), cx(1, 0), 1e-12);
  assertClose(exp(cx(0, Math.PI)), cx(-1, 0), 1e-12);
});

test('jw is j·2πf·x', () => assertClose(jw(13.56e6, 1e-9), cx(0, 2 * Math.PI * 13.56e6 * 1e-9), 1e-15));

test('finite check', () => {
  assert.equal(isFiniteC(cx(1, 2)), true);
  assert.equal(isFiniteC(cx(Infinity, 0)), false);
  assert.equal(isFiniteC(cx(0, Number.NaN)), false);
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/engine/complex.test.ts`
Expected: FAIL with `Cannot find module` … `src/engine/complex.ts`.

- [ ] **Step 5: Write the implementation**

`src/engine/complex.ts`:

```ts
/** Complex arithmetic on plain {re, im} objects (rms phasors, e^{jωt}). */
export interface Complex {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const ZERO: Complex = cx(0, 0);
export const ONE: Complex = cx(1, 0);
/** Impedance of an open circuit. */
export const OPEN: Complex = cx(Number.POSITIVE_INFINITY, 0);

export const add = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const neg = (a: Complex): Complex => cx(-a.re, -a.im);
export const scale = (a: Complex, k: number): Complex => cx(a.re * k, a.im * k);
export const conj = (a: Complex): Complex => cx(a.re, -a.im);
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export const mul = (a: Complex, b: Complex): Complex => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const isFiniteC = (a: Complex): boolean => Number.isFinite(a.re) && Number.isFinite(a.im);

/** a / b by Smith's algorithm (no overflow for large or tiny b). b = 0 gives NaN. */
export function div(a: Complex, b: Complex): Complex {
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re;
    const d = b.re + b.im * r;
    return cx((a.re + a.im * r) / d, (a.im - a.re * r) / d);
  }
  const r = b.re / b.im;
  const d = b.re * r + b.im;
  return cx((a.re * r + a.im) / d, (a.im * r - a.re) / d);
}

export const inv = (a: Complex): Complex => div(ONE, a);

export function exp(a: Complex): Complex {
  const m = Math.exp(a.re);
  return cx(m * Math.cos(a.im), m * Math.sin(a.im));
}

export const cosh = (a: Complex): Complex => cx(Math.cosh(a.re) * Math.cos(a.im), Math.sinh(a.re) * Math.sin(a.im));
export const sinh = (a: Complex): Complex => cx(Math.sinh(a.re) * Math.cos(a.im), Math.cosh(a.re) * Math.sin(a.im));
export const tanh = (a: Complex): Complex => div(sinh(a), cosh(a));

/** j·2πf·x: the impedance of an inductance x, or the admittance of a capacitance x. */
export const jw = (f: number, x: number): Complex => cx(0, 2 * Math.PI * f * x);
```

- [ ] **Step 6: Run the tests and the type check**

Run: `node --experimental-strip-types --test src/engine/complex.test.ts && npm run typecheck`
Expected: 5 tests pass; `tsc` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore README.md src/testutil.ts src/engine/complex.ts src/engine/complex.test.ts
git commit -m "feat: scaffold the modeller and add complex arithmetic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Real sweeps and Python-captured reference fixtures

**Files:**
- Create: `fixtures/sweeps/` (10 copied `.s1p` files), `tools/capture_fixtures.py`
- Produces: `fixtures/python/rfchain_cases.json`, `design_units.json`, `o7_fit.json`, `tmodel_short.json`, `cd_check.json`

**Interfaces:**
- Consumes: the real model code in `MANUAL_MATCHING_NETWORK/2026-10-10_DESIGN_SPACE/model/` (read-only).
- Produces the JSON schemas the parity tests read. Every complex value is `[re, im]`.
  - **`rfchain_cases.json`:** `{cases: [{name, units: Unit[], load, net, cable: {length, vf, z0, alpha13}, rows: [{f, abcd: [unit][4][2], zx, zin, emb, de, chain: {z_ait, z_net_in, i_series, v_series_cap, i_shunt, v_node, i_branch, p_esr_series, p_esr_shunt, p_lseries, p_cable, v1, v2, i1_total, p_cube, p_fix, units: [{i1, vm, i_r2, p_r1, p_core, p_r2, b_pk_mT, v_loop_rms}]}}]}]}`
  - **`design_units.json`:** `{consts, designs: [{N_p, N_s, N_c, strap, turn_length_mm, unit}]}`
  - **`o7_fit.json`:**
    - `{k0, f_k0, band, window, x0, bounds, variants, recommend}`;
    - `variants`: `[{variant, length, Lj, fit2: {x, cost, rms, pred_80_200, samples: [{index, cs, cp, z}]}, fit3: {x, cost, rms}, loop: {q, cost, pred_80_180_loop, samples: [{index, z}]}}]`;
    - `recommend`: `{current, count, candidates: [{series, shunt, landings, room_up, room_down, n_in, moves}], top12, seg, seg_points}`.
  - **`tmodel_short.json`:** `{tmodel: {variant, n, n_p, n_c, f_pri, k1, f_lo, f_hi, unit, load, rms_rel, n_res, cost}, shorts: [{file, band, fixed: [{length, L_nH, rms}], free: {length, L_nH, rms}}]}`
  - **`cd_check.json`:** `{f, unit, load, cable_length, c_series, c_shunt, pred, meas}`
  - Every file also carries `_sources` (SHA-256 of the model files) and `_sweeps` (SHA-256 of each sweep).

- [ ] **Step 1: Copy the 10 sweeps into the repo (read-only source, exact names)**

```bash
M="/Users/mattmccoy/GaTech Dropbox/Matthew McCoy/mattmccoy-research/research/binderjet/experiments/rf_sintering/MANUAL_MATCHING_NETWORK"
O="$M/2026-10-13_O7-4core_parallel_build/single-transformer"
mkdir -p fixtures/sweeps
for f in noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_nanovna-sweep-1791927664566.s1p \
         noAIT_130ser_230sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791930836256.s1p \
         noAIT_100ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931275980.s1p \
         noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p \
         noAIT_sense-loop_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791932761517.s1p \
         noAIT_sense-loop_80ser_180sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791933400391.s1p \
         coax-jumpers-shorted_nanovna-sweep-1791923630763.s1p \
         coax-jumpers-shorted_for_both_trans_nanovna-sweep-1791928236499.s1p; do cp "$O/$f" fixtures/sweeps/; done
cp "$M/2026-09-30_218-2core_v2/2026-09-30_CAPFREE_218_CD_1-60M_nanovna-sweep-1790787282764.s1p" fixtures/sweeps/
cp "$M/2026-10-01_218-2core-mat67_100ser-330sh/2026-10-01_NET_218_CD_100s_3x100+30p_10-18M_PRE-loop_nanovna-sweep-1790884838445.s1p" fixtures/sweeps/
ls fixtures/sweeps | wc -l
```

Expected: `10`.

- [ ] **Step 2: Write the capture script**

`tools/capture_fixtures.py`:

```python
"""Capture reference outputs from the real RFAM network Python for the TypeScript parity tests.

Run from the repo root:
  VECLIB_MAXIMUM_THREADS=2 uv run --no-project --python 3.12 --with numpy --with scipy python tools/capture_fixtures.py

Reads the model code in MANUAL_MATCHING_NETWORK/2026-10-10_DESIGN_SPACE/model (override with RFNM_MNET) and the sweeps
in fixtures/sweeps. Writes fixtures/python/*.json; never edit those by hand. Exits 1, writing nothing for the O7 file, if
the O7 recipe stops reproducing the predictions recorded in 2026-10-13_O7-4core_parallel_build/SWEEP_NOTES.md L490/L522.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[1]
MNET = Path(os.environ.get("RFNM_MNET", "/Users/mattmccoy/GaTech Dropbox/Matthew McCoy/mattmccoy-research/research/"
                           "binderjet/experiments/rf_sintering/MANUAL_MATCHING_NETWORK"))
MODEL = MNET / "2026-10-10_DESIGN_SPACE" / "model"
sys.path.insert(0, str(MODEL))
import calib  # noqa: E402
import design as dz  # noqa: E402
import rfchain as rc  # noqa: E402

SW = ROOT / "fixtures" / "sweeps"
OUT = ROOT / "fixtures" / "python"
CAPFREE = "noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_nanovna-sweep-1791927664566.s1p"
S130 = "noAIT_130ser_230sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791930836256.s1p"
S100 = "noAIT_100ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931275980.s1p"
S80 = "noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p"
S80L = "noAIT_sense-loop_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791932761517.s1p"
S180L = "noAIT_sense-loop_80ser_180sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791933400391.s1p"
SHORT_OLD = "coax-jumpers-shorted_nanovna-sweep-1791923630763.s1p"
SHORT_NEW = "coax-jumpers-shorted_for_both_trans_nanovna-sweep-1791928236499.s1p"
CD_NET = "2026-10-01_NET_218_CD_100s_3x100+30p_10-18M_PRE-loop_nanovna-sweep-1790884838445.s1p"
VARIANTS = (("1.245", 1.245, 342e-9), ("1.2825", 1.2825, 329e-9), ("1.5094", 1.5094, 256e-9))
WIN = (5.0, 17.0, 6.0, 48.0)
X0 = [300.0, 150.0, 1.0, 1.0, 1.0]
BOUNDS = ([150.0, -100.0, 0.8, 0.8, 0.2], [700.0, 600.0, 1.5, 1.5, 3.0])
# SWEEP_NOTES.md L490 (2-sweep fit -> 80/200) and L522 (3-sweep fit + loop -> 80/180 + loop), rounded to 0.1 ohm there.
RECORDED_80_200 = {"1.245": (6.4, 6.6, 12.6, 12.6), "1.2825": (6.4, 6.6, 12.6, 12.6), "1.5094": (4.8, 4.8, 8.0, 8.0)}
RECORDED_80_180L = {"1.245": (6.7, 7.2, 16.9, 18.1), "1.2825": (6.7, 7.2, 16.9, 18.1), "1.5094": (4.9, 5.0, 11.4, 11.4)}


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def cx(z) -> list:
    z = complex(z)
    return [z.real, z.imag]


def load(name: str):
    d = np.loadtxt(SW / name, comments=("!", "#"))
    return d[:, 0], d[:, 1] + 1j * d[:, 2]


def zport(g):
    return 50 * (1 + g) / (1 - g)


def unit_dict(u) -> dict:
    return dict(n=u.n, L_leak=u.L_leak, f_pri=u.f_pri, L_m=u.L_m, G_core=u.G_core, R1=u.R1, R2=u.R2, C_w=u.C_w,
                N_p=u.N_p, N_c=u.N_c)


def dump(name: str, obj: dict) -> None:
    obj["_sources"] = {p.name: sha(p) for p in (MODEL / "rfchain.py", MODEL / "design.py", MODEL / "calib.py",
                                                 MODEL / "builds_fit.json")}
    obj["_sweeps"] = {p.name: sha(p) for p in sorted(SW.glob("*.s1p"))}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(obj, indent=1))
    print("wrote", (OUT / name).relative_to(ROOT))


def cd_preset():
    bf = json.loads((MODEL / "builds_fit.json").read_text())["CD_0930_load|0.0|0.0"]
    u = rc.Unit(n=bf["n"], L_leak=bf["L_leak"], f_pri=0.0, L_m=bf["L_m"], G_core=bf["G_core"], R1=bf["R1"],
                R2=bf["R2"], C_w=0.0, N_p=bf["N_p"], N_c=bf["N_c"])
    return u, rc.PlateLoad(C=bf["C"], G_cube=0.0, G_fix=bf["G_sec"])


def capture_rfchain() -> None:
    cd, cd_load = cd_preset()
    k = dz.Consts()
    o7u = dz.make_unit(dz.Design(N_p=3, N_s=15, N_c=4), k)
    cases = [("cd_fpri0", [cd], cd_load),
             ("cd_fpri01_cw", [dataclasses.replace(cd, f_pri=0.1, C_w=0.2e-12)],
              rc.PlateLoad(C=cd_load.C, G_cube=0.3e-6, G_fix=cd_load.G_fix)),
             ("o7_estimate_pair", [o7u, o7u], rc.PlateLoad(C=k.C_plate, G_cube=k.G_cube, G_fix=k.G_plate))]
    nets = [rc.Network(c_series=80e-12, c_shunt=180e-12, esr_series=0.01, esr_shunt=0.02, l_series=100e-9, r_lseries=0.05),
            rc.Network(c_series=100e-12, c_shunt=330e-12, l_series=50e-9)]
    cables = [rc.Cable(length=1.245, vf=0.70, z0=50.0, alpha_13=0.0),
              rc.Cable(length=1.5094, vf=0.70, z0=50.0, alpha_13=0.0073)]
    out = []
    for name, units, ld in cases:
        for ni, net in enumerate(nets):
            for ci, cab in enumerate(cables):
                rows = []
                for f in (1e6, 5e6, 9.85e6, 13.56e6, 20e6, 25e6):
                    zx = complex(rc.input_impedance(units, ld, f))
                    zin = complex(rc.network_input(zx, net, f))
                    emb = complex(rc.embed(zin, cab, f))
                    st = rc.solve_chain(units, ld, net, cab, f, p_ait_out=100.0)
                    tr = st.transformer
                    rows.append(dict(
                        f=f, abcd=[[cx(v) for v in np.asarray(rc.unit_abcd(u, f)).reshape(-1)] for u in units],
                        zx=cx(zx), zin=cx(zin), emb=cx(emb), de=cx(rc.deembed(emb, cab, f)),
                        chain=dict(z_ait=cx(st.z_ait), z_net_in=cx(st.z_net_in), i_series=cx(st.i_series),
                                   v_series_cap=float(st.v_series_cap), i_shunt=cx(st.i_shunt), v_node=cx(st.v_node),
                                   i_branch=cx(st.i_branch), p_esr_series=float(st.p_esr_series),
                                   p_esr_shunt=float(st.p_esr_shunt), p_lseries=float(st.p_lseries),
                                   p_cable=float(st.p_cable), v1=cx(tr.v1), v2=cx(tr.v2), i1_total=cx(tr.i1_total),
                                   p_cube=float(tr.p_cube), p_fix=float(tr.p_fix),
                                   units=[dict(i1=cx(s.i1), vm=cx(s.vm), i_r2=cx(s.i_r2), p_r1=float(s.p_r1),
                                               p_core=float(s.p_core), p_r2=float(s.p_r2), b_pk_mT=float(s.b_pk_mT),
                                               v_loop_rms=float(s.v_loop_rms)) for s in tr.units])))
                out.append(dict(name=f"{name}/net{ni}/cable{ci}", units=[unit_dict(u) for u in units],
                                load=dict(C=ld.C, G_cube=ld.G_cube, G_fix=ld.G_fix),
                                net=dict(c_series=net.c_series, c_shunt=net.c_shunt, esr_series=net.esr_series,
                                         esr_shunt=net.esr_shunt, l_series=net.l_series, r_lseries=net.r_lseries),
                                cable=dict(length=cab.length, vf=cab.vf, z0=cab.z0, alpha13=cab.alpha_13), rows=rows))
    dump("rfchain_cases.json", dict(cases=out))


def capture_design() -> None:
    k = dz.Consts()
    designs = [dz.Design(N_p=2, N_s=18, N_c=2), dz.Design(N_p=3, N_s=15, N_c=4), dz.Design(N_p=2, N_s=16, N_c=4, strap=True)]
    dump("design_units.json", dict(consts=dataclasses.asdict(k), designs=[
        dict(N_p=d.N_p, N_s=d.N_s, N_c=d.N_c, strap=d.strap, turn_length_mm=dz.turn_length_mm(d.N_c),
             unit=unit_dict(dz.make_unit(d, k))) for d in designs]))


def make_zin(f, w, z15, ln, lj):
    """o7_joint.py / o7_loopstate.py board model for one cable variant, re-embedded through the same cable."""
    cab = rc.Cable(length=ln, vf=0.70, z0=50.0, alpha_13=0.0)
    zp0 = rc.deembed(z15, cab, f) - 1j * w * lj

    def zin(p, cs, cp, d=0.0):
        zp = np.interp(f * (1 + d), f, zp0.real) + 1j * np.interp(f * (1 + d), f, zp0.imag)
        zb = p[4] * zp.real + 1j * zp.imag + 1j * w * p[1] * 1e-9
        return rc.embed(1 / (1j * w * cs * p[2]) + 1j * w * p[0] * 1e-9 + 1 / (1 / zb + 1j * w * cp * p[3]), cab, f)
    return zin


def residual(zin, states, band):
    def res(p):
        out = []
        for cs, cp, gm in states:
            zi = zin(p, cs, cp)
            r = ((zi - 50) / (zi + 50) - gm)[band]
            out += [r.real, r.imag]
        return np.concatenate(out)
    return res


def combos(nmax):
    return [(a, b, c) for a in range(nmax + 1) for b in range(nmax + 1) for c in range(nmax + 1) if 0 < a + b + c <= nmax]


def inwin(z):
    return (z.real >= WIN[0]) & (z.real <= WIN[1]) & (z.imag >= WIN[2]) & (z.imag <= WIN[3])


def rooms_contiguous(f, z, k0, seg):
    """Contiguous in-window band around k0 inside seg (spec section 9); -99 when 13.56 MHz is out of the window."""
    if not (bool(inwin(z[k0:k0 + 1])[0]) and bool(seg[k0])):
        return -99.0, -99.0
    hi = k0
    while hi + 1 < len(f) and seg[hi + 1] and inwin(z[hi + 1:hi + 2])[0]:
        hi += 1
    lo = k0
    while lo - 1 >= 0 and seg[lo - 1] and inwin(z[lo - 1:lo])[0]:
        lo -= 1
    return float((f[hi] - 13.56e6) / 13.56e6 * 100), float((13.56e6 - f[lo]) / 13.56e6 * 100)


def capture_recommend(f, k0, seg, models) -> dict:
    """o7_joint.py enumeration with the loop-state models (3-sweep fit + loop shift); current build 80/200."""
    cur_s, cur_p = (0, 1, 1), (2, 0, 0)
    vals = (100, 50, 30)
    rows = []
    for s in combos(2):
        for p in combos(4):
            if s[0] + p[0] > 10 or s[1] + p[1] > 3 or s[2] + p[2] > 2:
                continue
            cs = sum(n * v for n, v in zip(s, vals)) * 1e-12
            cp = sum(n * v for n, v in zip(p, vals)) * 1e-12
            lands, ups, downs = [], [], []
            for zin, p3, q in models:
                z = zin(p3, cs, cp, d=q * 1e-2)
                up, down = rooms_contiguous(f, z, k0, seg)
                lands.append(cx(z[k0]))
                ups.append(up)
                downs.append(down)
            rows.append(dict(series=list(s), shunt=list(p), landings=lands, room_up=ups, room_down=downs,
                             n_in=sum(1 for u in ups if u != -99.0),
                             moves=sum(abs(a - b) for a, b in zip(s, cur_s)) + sum(abs(a - b) for a, b in zip(p, cur_p))))
    good = [r for r in rows if r["n_in"] * 2 > len(models)]
    good.sort(key=lambda r: (-r["n_in"], -min(sorted(r["room_up"])[(len(models) - 1) // 2], 2.5), r["moves"]))
    top = [[r["series"], r["shunt"]] for r in good[:12]]
    print(f"recommend: {len(rows)} candidates, {len(good)} with a majority in window; top 3 {top[:3]}")
    return dict(current=dict(series=list(cur_s), shunt=list(cur_p)), count=len(rows), candidates=rows, top12=top,
                seg=[12.5e6, 14.6e6], seg_points=int(np.count_nonzero(seg)))


def capture_o7() -> None:
    f, g15 = load(CAPFREE)
    meas = {name: load(name)[1] for name in (S130, S100, S80, S80L, S180L)}
    w = 2 * np.pi * f
    z15 = zport(g15)
    k0 = int(np.argmin(abs(f - 13.56e6)))
    band = (f > 12.0e6) & (f < 14.6e6)
    seg = (f > 12.5e6) & (f < 14.6e6)
    st2 = [(130e-12, 230e-12, meas[S130]), (100e-12, 200e-12, meas[S100])]
    st3 = st2 + [(80e-12, 200e-12, meas[S80])]
    out, bad, models = [], [], []
    for name, ln, lj in VARIANTS:
        zin = make_zin(f, w, z15, ln, lj)
        s2 = least_squares(residual(zin, st2, band), X0, bounds=BOUNDS)
        s3 = least_squares(residual(zin, st3, band), X0, bounds=BOUNDS)

        def rl(q, zin=zin, p3=s3.x):
            zi = zin(p3, 80e-12, 200e-12, d=q[0] * 1e-2)
            r = ((zi - 50) / (zi + 50) - meas[S80L])[band]
            return np.concatenate([r.real, r.imag])
        sq = least_squares(rl, [20.0], bounds=([-200.0], [400.0]))
        q = float(sq.x[0])
        p80 = complex(zin(s2.x, 80e-12, 200e-12)[k0])
        p180 = complex(zin(s3.x, 80e-12, 180e-12, d=q * 1e-2)[k0])
        samples = [dict(index=i, cs=cs, cp=cp, z=cx(zin(s2.x, cs, cp)[i]))
                   for i in (0, k0 - 100, k0, k0 + 100, len(f) - 1) for cs, cp in ((80e-12, 200e-12), (130e-12, 230e-12))]
        loop_samples = [dict(index=i, z=cx(zin(s3.x, 80e-12, 180e-12, d=q * 1e-2)[i])) for i in (0, k0, len(f) - 1)]
        out.append(dict(variant=name, length=ln, Lj=lj,
                        fit2=dict(x=[float(v) for v in s2.x], cost=float(s2.cost),
                                  rms=float(np.sqrt(np.mean(s2.fun ** 2) * 2)), pred_80_200=cx(p80), samples=samples),
                        fit3=dict(x=[float(v) for v in s3.x], cost=float(s3.cost),
                                  rms=float(np.sqrt(np.mean(s3.fun ** 2) * 2))),
                        loop=dict(q=q, cost=float(sq.cost), pred_80_180_loop=cx(p180), samples=loop_samples)))
        models.append((zin, s3.x, q))
        print(f"{name}: 80/200 {p80.real:.2f}{p80.imag:+.2f}j   loop q {q:.2f}%   80/180+loop {p180.real:.2f}{p180.imag:+.2f}j")
        for (lo_r, hi_r, lo_x, hi_x), z, tag, slack in ((RECORDED_80_200[name], p80, "L490 80/200", 0.1),
                                                        (RECORDED_80_180L[name], p180, "L522 80/180+loop", 0.15)):
            if not (lo_r - slack <= z.real <= hi_r + slack and lo_x - slack <= z.imag <= hi_x + slack):
                bad.append(f"{name} {tag}: {z:.2f} outside recorded R {lo_r}-{hi_r}, X {lo_x}-{hi_x}")
    if bad:
        print("RECIPE NO LONGER REPRODUCES SWEEP_NOTES:\n  " + "\n  ".join(bad))
        sys.exit(1)
    rec = capture_recommend(f, k0, seg, models)
    dump("o7_fit.json", dict(k0=k0, f_k0=float(f[k0]), band=[12.0e6, 14.6e6], window=list(WIN), x0=X0,
                             bounds=[list(BOUNDS[0]), list(BOUNDS[1])], variants=out, recommend=rec))


def capture_tmodel_and_short() -> None:
    f, g = load(CAPFREE)
    w = 2 * np.pi * f
    cab = rc.Cable(length=1.245, vf=0.70, z0=50.0, alpha_13=0.0)
    zp = rc.deembed(zport(g), cab, f) - 1j * w * 342e-9
    r = calib.fit_one_port(f, zp, n=5.0, f_pri=0.0, n_p=3, n_c=4)
    m = int(np.count_nonzero((f >= 2e6) & (f <= 25e6)))
    tm = dict(variant="1.245", n=5.0, n_p=3, n_c=4, f_pri=0.0, k1=0.7, f_lo=2e6, f_hi=25e6, unit=unit_dict(r.unit),
              load=dict(C=r.load.C, G_cube=r.load.G_cube, G_fix=r.load.G_fix), rms_rel=float(r.rms_rel), n_res=2 * m,
              cost=float(0.5 * 2 * m * r.rms_rel ** 2))
    print(f"tmodel: rms_rel {r.rms_rel:.4f}  L_leak {r.unit.L_leak:.3e}  L_m {r.unit.L_m:.3e}  C {r.load.C:.3e}")
    shorts = []
    for name in (SHORT_NEW, SHORT_OLD):
        fs, gs = load(name)
        zs, ws = zport(gs), 2 * np.pi * fs
        msk = (fs >= 2e6) & (fs <= 25e6)

        def res(x, zs=zs, ws=ws, fs=fs, msk=msk):
            c = rc.Cable(length=x[0], vf=0.70, z0=50.0, alpha_13=0.0)
            e = (rc.deembed(zs, c, fs) - 1j * ws * x[1] * 1e-9)[msk]
            return np.r_[e.real, e.imag]
        fixed = []
        for ln in (1.245, 1.2825, 1.5094):
            s1 = least_squares(lambda x, ln=ln: res([ln, x[0]]), [300.0], bounds=([0.0], [2000.0]))
            fixed.append(dict(length=ln, L_nH=float(s1.x[0]), rms=float(np.sqrt(np.mean(s1.fun ** 2)))))
        s = least_squares(res, [1.3, 300.0], bounds=([0.5, 0.0], [3.0, 2000.0]))
        shorts.append(dict(file=name, band=[2e6, 25e6], fixed=fixed,
                           free=dict(length=float(s.x[0]), L_nH=float(s.x[1]), rms=float(np.sqrt(np.mean(s.fun ** 2))))))
        print(f"short {name[:36]}: fixed " + " ".join(f"{x['length']} m {x['L_nH']:.0f} nH" for x in fixed)
              + f" | free {s.x[0]:.4f} m {s.x[1]:.0f} nH")
    dump("tmodel_short.json", dict(tmodel=tm, shorts=shorts))


def capture_cd() -> None:
    u, ld = cd_preset()
    cab = rc.Cable(length=1.5094, vf=0.70, z0=50.0, alpha_13=0.0)
    f, g = load(CD_NET)
    k0 = int(np.argmin(abs(f - 13.56e6)))
    fk = float(f[k0])
    zx = complex(rc.input_impedance([u], ld, fk))
    zin = complex(rc.network_input(zx, rc.Network(c_series=100e-12, c_shunt=330e-12), fk))
    pred = complex(rc.embed(zin, cab, fk))
    meas = complex(zport(g[k0]))
    dump("cd_check.json", dict(f=fk, unit=unit_dict(u), load=dict(C=ld.C, G_cube=ld.G_cube, G_fix=ld.G_fix),
                               cable_length=1.5094, c_series=100e-12, c_shunt=330e-12, pred=cx(pred), meas=cx(meas)))
    print(f"C+D check at {fk / 1e6:.4f} MHz: predicted {pred:.2f}, measured {meas:.2f}")


if __name__ == "__main__":
    capture_rfchain()
    capture_design()
    capture_o7()
    capture_tmodel_and_short()
    capture_cd()
```

- [ ] **Step 3: Run the capture and check it against the probe values**

Run: `VECLIB_MAXIMUM_THREADS=2 uv run --no-project --python 3.12 --with numpy --with scipy python tools/capture_fixtures.py`

Expected, within ±0.02 Ω of the 2026-10-14 probe:
- 5 `wrote fixtures/python/…` lines;
- `1.245: 80/200 6.64+12.59j … 80/180+loop 7.24+18.00j`;
- `1.2825: 80/200 6.43+12.67j … 6.83+16.89j`;
- `1.5094: 80/200 4.77+8.01j … 4.98+11.52j`;
- `recommend: 209 candidates`;
- `tmodel: rms_rel 0.1099`;
- the new-jumper short at fixed lengths `344 / 329 / 248 nH`.

**If the script exits 1 with "RECIPE NO LONGER REPRODUCES SWEEP_NOTES", STOP and report the printed lines. Do not loosen the slack.**

- [ ] **Step 4: Commit**

```bash
git add fixtures/sweeps tools/capture_fixtures.py fixtures/python
git commit -m "test: capture reference fixtures from the real network Python on the 10-13 sweeps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Dense linear solvers

**Files:**
- Create: `src/engine/linsolve.ts`
- Test: `src/engine/linsolve.test.ts`

**Interfaces:**
- Consumes: `Complex`, `abs`, `div`, `mul`, `sub` (Task 1).
- Produces:
  - `class SingularMatrixError extends Error`
  - `solveLinear(A: Complex[][], b: Complex[]): Complex[]`
  - `solveReal(A: number[][], b: number[]): number[]`
  - Both use scaled partial pivoting, leave their inputs unmodified, and throw `SingularMatrixError` on an all-zero row or a scaled pivot ≤ 1e-14.

- [ ] **Step 1: Write the failing test**

`src/engine/linsolve.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { type Complex, add, cx, mul } from './complex.ts';
import { SingularMatrixError, solveLinear, solveReal } from './linsolve.ts';
import { assertClose, assertNear } from '../testutil.ts';

const times = (A: Complex[][], x: Complex[]): Complex[] => A.map((row) => row.reduce((acc, a, j) => add(acc, mul(a, x[j])), cx(0)));

test('solves a 3x3 complex system to round-off', () => {
  const A = [[cx(4, 1), cx(-2), cx(1, -1)], [cx(-2), cx(5, 2), cx(0, 3)], [cx(1, -1), cx(0, 3), cx(6, -1)]];
  const xTrue = [cx(1, -2), cx(0.5, 0.25), cx(-3, 1)];
  solveLinear(A, times(A, xTrue)).forEach((x, i) => assertClose(x, xTrue[i], 1e-12));
});

test('pivots past a zero leading entry', () => {
  const x = solveLinear([[cx(0), cx(1)], [cx(1), cx(0)]], [cx(2), cx(3)]);
  assertClose(x[0], cx(3), 1e-15);
  assertClose(x[1], cx(2), 1e-15);
});

test('mixed row scales (1e-12 and 1e4) still solve', () => {
  const A = [[cx(1e-12, 2e-12), cx(3e-12)], [cx(1e4), cx(-2e4, 5e3)]];
  const xTrue = [cx(0.7, -0.1), cx(-1.2, 0.4)];
  solveLinear(A, times(A, xTrue)).forEach((x, i) => assertClose(x, xTrue[i], 1e-10));
});

test('does not modify its inputs', () => {
  const A = [[cx(2), cx(1)], [cx(1), cx(3)]];
  const b = [cx(1), cx(2)];
  const copy = JSON.stringify([A, b]);
  solveLinear(A, b);
  assert.equal(JSON.stringify([A, b]), copy);
});

test('throws SingularMatrixError on a singular matrix and on an all-zero row', () => {
  assert.throws(() => solveLinear([[cx(1), cx(2)], [cx(2), cx(4)]], [cx(1), cx(1)]), SingularMatrixError);
  assert.throws(() => solveLinear([[cx(1), cx(2)], [cx(0), cx(0)]], [cx(1), cx(1)]), SingularMatrixError);
});

test('solveReal solves a real system and refuses a singular one', () => {
  const x = solveReal([[4, -2, 1], [-2, 5, 3], [1, 3, 6]], [3, 1, 2]);
  const back = [[4, -2, 1], [-2, 5, 3], [1, 3, 6]].map((r) => r.reduce((s, a, j) => s + a * x[j], 0));
  back.forEach((v, i) => assertNear(v, [3, 1, 2][i], 1e-12));
  assert.throws(() => solveReal([[1, 2], [2, 4]], [1, 1]), SingularMatrixError);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/engine/linsolve.test.ts`
Expected: FAIL with `Cannot find module` … `linsolve.ts`.

- [ ] **Step 3: Write the implementation**

`src/engine/linsolve.ts`:

```ts
import { type Complex, abs, div, mul, sub } from './complex.ts';

export class SingularMatrixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SingularMatrixError';
  }
}

const PIVOT_FLOOR = 1e-14;

/** Solves A x = b for a dense complex matrix by Gaussian elimination with scaled partial pivoting. Inputs are not modified. */
export function solveLinear(A: Complex[][], b: Complex[]): Complex[] {
  const n = b.length;
  const m = A.map((row) => row.slice());
  const r = b.slice();
  const s = m.map((row) => row.reduce((mx, v) => Math.max(mx, abs(v)), 0));
  const zeroRow = s.findIndex((v) => v === 0);
  if (zeroRow >= 0) throw new SingularMatrixError(`row ${zeroRow} is all zero (a floating node)`);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    let best = -1;
    for (let i = k; i < n; i += 1) {
      const v = abs(m[i][k]) / s[i];
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > PIVOT_FLOOR)) throw new SingularMatrixError(`matrix is singular at column ${k}`);
    if (p !== k) {
      [m[k], m[p]] = [m[p], m[k]];
      [r[k], r[p]] = [r[p], r[k]];
      [s[k], s[p]] = [s[p], s[k]];
    }
    for (let i = k + 1; i < n; i += 1) {
      if (m[i][k].re === 0 && m[i][k].im === 0) continue;
      const factor = div(m[i][k], m[k][k]);
      for (let j = k; j < n; j += 1) m[i][j] = sub(m[i][j], mul(factor, m[k][j]));
      r[i] = sub(r[i], mul(factor, r[k]));
    }
  }
  const x: Complex[] = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let acc = r[i];
    for (let j = i + 1; j < n; j += 1) acc = sub(acc, mul(m[i][j], x[j]));
    x[i] = div(acc, m[i][i]);
  }
  return x;
}

/** Real-valued counterpart of solveLinear, used by the least-squares fitter. */
export function solveReal(A: number[][], b: number[]): number[] {
  const n = b.length;
  const m = A.map((row) => row.slice());
  const r = b.slice();
  const s = m.map((row) => row.reduce((mx, v) => Math.max(mx, Math.abs(v)), 0));
  const zeroRow = s.findIndex((v) => v === 0);
  if (zeroRow >= 0) throw new SingularMatrixError(`row ${zeroRow} is all zero`);
  for (let k = 0; k < n; k += 1) {
    let p = k;
    let best = -1;
    for (let i = k; i < n; i += 1) {
      const v = Math.abs(m[i][k]) / s[i];
      if (v > best) {
        best = v;
        p = i;
      }
    }
    if (!(best > PIVOT_FLOOR)) throw new SingularMatrixError(`matrix is singular at column ${k}`);
    if (p !== k) {
      [m[k], m[p]] = [m[p], m[k]];
      [r[k], r[p]] = [r[p], r[k]];
      [s[k], s[p]] = [s[p], s[k]];
    }
    for (let i = k + 1; i < n; i += 1) {
      if (m[i][k] === 0) continue;
      const factor = m[i][k] / m[k][k];
      for (let j = k; j < n; j += 1) m[i][j] -= factor * m[k][j];
      r[i] -= factor * r[k];
    }
  }
  const x: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i -= 1) {
    let acc = r[i];
    for (let j = i + 1; j < n; j += 1) acc -= m[i][j] * x[j];
    x[i] = acc / m[i][i];
  }
  return x;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/engine/linsolve.test.ts && npm run typecheck`
Expected: 6 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/linsolve.ts src/engine/linsolve.test.ts
git commit -m "feat(engine): add dense complex and real linear solvers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Two-port helpers and the coax line

**Files:**
- Create: `src/engine/twoport.ts`, `src/engine/coax.ts`
- Test: `src/engine/twoport.test.ts`, `src/engine/coax.test.ts`

**Interfaces:**
- Consumes: Task 1 complex functions.
- Produces:
  - `type M2 = [Complex, Complex, Complex, Complex]`; `type Y2 = M2`
  - `mul2(p, q)`, `seriesZ(z)`, `shuntY(y)`, `idealN(n)`, `abcdToY(m)`, `zinTerminated(y, yl)`, `addY(p, q)`
  - `interface Cable { length; vf; z0; alpha13 }`, `C0`, `F_REF`
  - `gammaL(c, f)`, `embed(zLoad, c, f)` (an open load is allowed), `deembed(zIn, c, f)`, `coaxY(c, f): Y2`

- [ ] **Step 1: Write the failing tests**

`src/engine/twoport.test.ts`:

```ts
import test from 'node:test';
import { add, cx, inv, scale } from './complex.ts';
import { abcdToY, idealN, mul2, seriesZ, shuntY, zinTerminated } from './twoport.ts';
import { assertClose } from '../testutil.ts';

test('series Z converts to Y = [1/Z, -1/Z, -1/Z, 1/Z]', () => {
  const z = cx(3, 4);
  const y = abcdToY(seriesZ(z));
  assertClose(y[0], inv(z), 1e-15);
  assertClose(y[1], scale(inv(z), -1), 1e-15);
  assertClose(y[2], scale(inv(z), -1), 1e-15);
  assertClose(y[3], inv(z), 1e-15);
});

test('series Z terminated by R reads Z + R', () => {
  assertClose(zinTerminated(abcdToY(seriesZ(cx(3, 4))), inv(cx(10))), cx(13, 4), 1e-14);
});

test('series z1, ideal 1:n, series z2 into R reads z1 + (z2 + R)/n²', () => {
  const z1 = cx(0.5, 2);
  const z2 = cx(4, 30);
  const m = [seriesZ(z1), idealN(3), seriesZ(z2)].reduce(mul2);
  assertClose(zinTerminated(abcdToY(m), inv(cx(90))), add(z1, scale(add(z2, cx(90)), 1 / 9)), 1e-13);
});

test('shunt Y in a cascade adds admittance', () => {
  const m = [seriesZ(cx(1, 0)), shuntY(cx(0, 0.02))].reduce(mul2);
  assertClose(zinTerminated(abcdToY(m), cx(0.01)), add(cx(1), inv(cx(0.01, 0.02))), 1e-13);
});
```

`src/engine/coax.test.ts`:

```ts
import test from 'node:test';
import { OPEN, cx, div, inv, tanh } from './complex.ts';
import { C0, type Cable, coaxY, deembed, embed, gammaL } from './coax.ts';
import { zinTerminated } from './twoport.ts';
import { assertClose } from '../testutil.ts';

const lossy: Cable = { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0.0073 };

test('a matched load is unchanged by a lossless line', () => {
  assertClose(embed(cx(50), { ...lossy, alpha13: 0 }, 13.56e6), cx(50), 1e-12);
});

test('a quarter-wave line inverts impedance', () => {
  const f = 13.56e6;
  const quarter: Cable = { length: (0.7 * C0) / (4 * f), vf: 0.7, z0: 50, alpha13: 0 };
  assertClose(embed(cx(10, 5), quarter, f), div(cx(2500), cx(10, 5)), 1e-9);
});

test('deembed undoes embed on a lossy line', () => {
  const z = cx(7.8, 27.9);
  assertClose(deembed(embed(z, lossy, 13.56e6), lossy, 13.56e6), z, 1e-10);
});

test('the 2-port Y terminated by a load equals embed', () => {
  const zl = cx(12, -30);
  assertClose(zinTerminated(coaxY(lossy, 9e6), inv(zl)), embed(zl, lossy, 9e6), 1e-10);
});

test('an open far end reads Z0·coth(γl)', () => {
  assertClose(embed(OPEN, lossy, 5e6), div(cx(50), tanh(gammaL(lossy, 5e6))), 1e-12);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/engine/twoport.test.ts src/engine/coax.test.ts`
Expected: FAIL with `Cannot find module` for `twoport.ts` and `coax.ts`.

- [ ] **Step 3: Write the implementations**

`src/engine/twoport.ts`:

```ts
import { type Complex, ONE, ZERO, add, cx, div, inv, mul, neg, sub } from './complex.ts';

/** A 2x2 complex matrix [m11, m12, m21, m22] (row-major): ABCD or Y parameters. */
export type M2 = [Complex, Complex, Complex, Complex];
export type Y2 = M2;

export const mul2 = (p: M2, q: M2): M2 => [
  add(mul(p[0], q[0]), mul(p[1], q[2])),
  add(mul(p[0], q[1]), mul(p[1], q[3])),
  add(mul(p[2], q[0]), mul(p[3], q[2])),
  add(mul(p[2], q[1]), mul(p[3], q[3])),
];
export const seriesZ = (z: Complex): M2 => [ONE, z, ZERO, ONE];
export const shuntY = (y: Complex): M2 => [ONE, ZERO, y, ONE];
export const idealN = (n: number): M2 => [cx(1 / n), ZERO, ZERO, cx(n)];

/** ABCD → Y with both ports referenced to a common ground (rfchain.abcd_to_y). */
export function abcdToY(m: M2): Y2 {
  const [a, b, c, d] = m;
  return [div(d, b), div(sub(mul(b, c), mul(a, d)), b), neg(inv(b)), div(a, b)];
}

/** Impedance into port 1 with port 2 terminated in admittance yl. */
export function zinTerminated(y: Y2, yl: Complex): Complex {
  return inv(sub(y[0], div(mul(y[1], y[2]), add(y[3], yl))));
}

export const addY = (p: Y2, q: Y2): Y2 => [add(p[0], q[0]), add(p[1], q[1]), add(p[2], q[2]), add(p[3], q[3])];
```

`src/engine/coax.ts`:

```ts
import { type Complex, add, cosh, cx, div, inv, isFiniteC, mul, scale, sinh, sub, tanh } from './complex.ts';
import type { Y2 } from './twoport.ts';

export const C0 = 299792458.0;
export const F_REF = 13.56e6;

/** Coax between the AIT output (the VNA calibration plane) and the network input (rfchain.Cable). */
export interface Cable {
  length: number;
  vf: number;
  z0: number;
  alpha13: number;
}

/** γl: attenuation alpha13·sqrt(f/13.56 MHz) [Np] plus jβl (rfchain._gl). */
export const gammaL = (c: Cable, f: number): Complex =>
  cx(c.alpha13 * Math.sqrt(f / F_REF), (2 * Math.PI * f * c.length) / (c.vf * C0));

/** Impedance at the cable input for a load zLoad at the far end (rfchain.embed). An open load is allowed. */
export function embed(zLoad: Complex, c: Cable, f: number): Complex {
  const t = tanh(gammaL(c, f));
  const z0 = cx(c.z0);
  if (!isFiniteC(zLoad)) return div(z0, t);
  return mul(z0, div(add(zLoad, mul(z0, t)), add(z0, mul(zLoad, t))));
}

/** Far-end load from the cable-input impedance (rfchain.deembed). */
export function deembed(zIn: Complex, c: Cable, f: number): Complex {
  const t = tanh(gammaL(c, f));
  const z0 = cx(c.z0);
  return mul(z0, div(sub(zIn, mul(z0, t)), sub(z0, mul(zIn, t))));
}

/** Ground-referenced 2-port admittance of the line: y11 = y22 = coth(γl)/Z0, y12 = y21 = -csch(γl)/Z0. */
export function coaxY(c: Cable, f: number): Y2 {
  const g = gammaL(c, f);
  const coth = div(cosh(g), sinh(g));
  const csch = inv(sinh(g));
  return [scale(coth, 1 / c.z0), scale(csch, -1 / c.z0), scale(csch, -1 / c.z0), scale(coth, 1 / c.z0)];
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/engine/twoport.test.ts src/engine/coax.test.ts && npm run typecheck`
Expected: 9 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/twoport.ts src/engine/twoport.test.ts src/engine/coax.ts src/engine/coax.test.ts
git commit -m "feat(engine): add ABCD/Y helpers and the coax line" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Transformer T-model unit

**Files:**
- Create: `src/engine/transformer.ts`
- Test: `src/engine/transformer.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 4 (`M2`, `Y2`, `abcdToY`, `addY`, `idealN`, `mul2`, `seriesZ`, `shuntY`, `zinTerminated`).
- Produces:
  - `A_E = 1.58e-4`
  - `interface Unit { n; L_leak; f_pri; L_m; G_core; R1; R2; C_w; N_p; N_c }`, `interface PlateLoad { C; G_cube; G_fix }`
  - `unitAbcd(u, f): M2`, `unitY(u, f): Y2`, `loadAdmittance(l, f)`, `inputImpedanceUnits(units, load, f)`, `unitInputZ(u, load, f)` (closed form, one unit)
  - `interface UnitState { i1; vm; i_r2; p_r1; p_core; p_r2; b_pk_mT; v_loop_rms }`, `interface TransformerState { v1; v2; i1_total; p_cube; p_fix; units }`
  - `bPeak_mT(vTurnRms, nTurns, nCores, f, aE?)`, `unitState(u, y, f, v1, v2)`, `solveTransformer(units, load, f, v1)`

- [ ] **Step 1: Write the failing test**

`src/engine/transformer.test.ts`:

```ts
import test from 'node:test';
import { conj, cx, mul } from './complex.ts';
import { type PlateLoad, type Unit, bPeak_mT, inputImpedanceUnits, solveTransformer, unitInputZ } from './transformer.ts';
import { assertClose, assertNear } from '../testutil.ts';

const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0.2, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };

test('the ABCD cascade equals the closed-form T-model', () => {
  for (const f of [1e6, 9e6, 13.56e6, 25e6]) assertClose(inputImpedanceUnits([u], load, f), unitInputZ(u, load, f), 1e-10, `f=${f}`);
});

test('a near-ideal unit maps a resistive load by 1/n²', () => {
  const ideal: Unit = { ...u, L_leak: 0, L_m: 1e3, G_core: 0, R1: 1e-6, R2: 1e-6, C_w: 0 };
  assertClose(inputImpedanceUnits([ideal], { C: 0, G_cube: 1 / 2500, G_fix: 0 }, 13.56e6), cx(100), 1e-6);
});

test('peak flux formula (rfchain.b_peak_mT)', () => assertNear(bPeak_mT(10, 2, 2, 13.56e6), 0.262639, 1e-5));

test('power into the primary equals copper + core + plate losses', () => {
  const f = 13.56e6;
  const v1 = cx(120, 30);
  const st = solveTransformer([u, { ...u, R2: 6 }], load, f, v1);
  const pin = mul(v1, conj(st.i1_total)).re;
  const ploss = st.units.reduce((a, s) => a + s.p_r1 + s.p_core + s.p_r2, 0) + st.p_cube + st.p_fix;
  assertNear(pin, ploss, 1e-9);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/engine/transformer.test.ts`
Expected: FAIL with `Cannot find module` … `transformer.ts`.

- [ ] **Step 3: Write the implementation**

`src/engine/transformer.ts`:

```ts
import { type Complex, abs, add, cx, div, inv, mul, scale, sub } from './complex.ts';
import { type M2, type Y2, abcdToY, addY, idealN, mul2, seriesZ, shuntY, zinTerminated } from './twoport.ts';

/** Fair-Rite 5967003801 effective area [m²] (rfchain.A_E). */
export const A_E = 1.58e-4;

/** One transformer unit, T-model with leakage referred to the primary (rfchain.Unit). */
export interface Unit {
  n: number;
  L_leak: number;
  f_pri: number;
  L_m: number;
  G_core: number;
  R1: number;
  R2: number;
  C_w: number;
  N_p: number;
  N_c: number;
}

/** Secondary-side plate load (rfchain.PlateLoad). */
export interface PlateLoad {
  C: number;
  G_cube: number;
  G_fix: number;
}

const w = (f: number): number => 2 * Math.PI * f;
const z1 = (u: Unit, f: number): Complex => cx(u.R1, w(f) * u.f_pri * u.L_leak);
const ym = (u: Unit, f: number): Complex => cx(u.G_core, -1 / (w(f) * u.L_m));
const z2 = (u: Unit, f: number): Complex => cx(u.R2, w(f) * (1 - u.f_pri) * u.L_leak * u.n ** 2);
const yw = (u: Unit, f: number): Complex => cx(0, w(f) * u.C_w);

/** ABCD of one unit: series z1, shunt ym, ideal 1:n, series z2, shunt C_w (rfchain.unit_abcd). */
export function unitAbcd(u: Unit, f: number): M2 {
  return [seriesZ(z1(u, f)), shuntY(ym(u, f)), idealN(u.n), seriesZ(z2(u, f)), shuntY(yw(u, f))].reduce(mul2);
}

export const unitY = (u: Unit, f: number): Y2 => abcdToY(unitAbcd(u, f));
export const loadAdmittance = (l: PlateLoad, f: number): Complex => cx(l.G_cube + l.G_fix, w(f) * l.C);

/** Primary-side input impedance of paralleled units terminated by the plate load (rfchain.input_impedance). */
export function inputImpedanceUnits(units: Unit[], load: PlateLoad, f: number): Complex {
  const y = units.map((u) => unitY(u, f)).reduce(addY);
  return zinTerminated(y, loadAdmittance(load, f));
}

/** Closed-form input impedance of one unit and its load: the fast path for the T-model fitter. */
export function unitInputZ(u: Unit, load: PlateLoad, f: number): Complex {
  const zSecRef = scale(add(z2(u, f), inv(add(yw(u, f), loadAdmittance(load, f)))), 1 / u.n ** 2);
  return add(z1(u, f), inv(add(ym(u, f), inv(zSecRef))));
}

export interface UnitState {
  i1: Complex;
  vm: Complex;
  i_r2: Complex;
  p_r1: number;
  p_core: number;
  p_r2: number;
  b_pk_mT: number;
  v_loop_rms: number;
}

export interface TransformerState {
  v1: Complex;
  v2: Complex;
  i1_total: Complex;
  p_cube: number;
  p_fix: number;
  units: UnitState[];
}

/** Peak flux density per core for an rms voltage across nTurns encircling nCores stacked cores (rfchain.b_peak_mT). */
export const bPeak_mT = (vTurnRms: number, nTurns: number, nCores: number, f: number, aE = A_E): number =>
  ((Math.SQRT2 * vTurnRms) / (2 * Math.PI * f * nTurns * nCores * aE)) * 1e3;

/** Currents, losses, flux and 1-turn loop voltage of one unit for terminal voltages v1 and v2 (rfchain.solve_transformer). */
export function unitState(u: Unit, y: Y2, f: number, v1: Complex, v2: Complex): UnitState {
  const i1 = add(mul(y[0], v1), mul(y[1], v2));
  const vm = sub(v1, mul(i1, z1(u, f)));
  const iIntoPort2 = add(mul(y[2], v1), mul(y[3], v2));
  const i_r2 = add(scale(iIntoPort2, -1), mul(cx(0, w(f) * u.C_w), v2));
  const vmAbs = abs(vm);
  return {
    i1, vm, i_r2,
    p_r1: abs(i1) ** 2 * u.R1,
    p_core: vmAbs ** 2 * u.G_core,
    p_r2: abs(i_r2) ** 2 * u.R2,
    b_pk_mT: bPeak_mT(vmAbs, u.N_p, u.N_c, f),
    v_loop_rms: vmAbs / (u.N_p * u.N_c),
  };
}

/** Secondary voltage and per-unit states for a primary-node voltage v1 (rfchain.solve_transformer). */
export function solveTransformer(units: Unit[], load: PlateLoad, f: number, v1: Complex): TransformerState {
  const ys = units.map((u) => unitY(u, f));
  const y = ys.reduce(addY);
  const v2 = div(mul(scale(y[2], -1), v1), add(y[3], loadAdmittance(load, f)));
  const states = units.map((u, k) => unitState(u, ys[k], f, v1, v2));
  const i1_total = states.reduce((acc, s) => add(acc, s.i1), cx(0));
  const v2a = abs(v2);
  return { v1, v2, i1_total, p_cube: v2a ** 2 * load.G_cube, p_fix: v2a ** 2 * load.G_fix, units: states };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/engine/transformer.test.ts && npm run typecheck`
Expected: 4 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/transformer.ts src/engine/transformer.test.ts
git commit -m "feat(engine): port the rfchain T-model transformer unit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Nodal solver

**Files:**
- Create: `src/engine/mna.ts`
- Test: `src/engine/mna.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5 (the tests use `coaxY`, `embed`, `unitY`, `loadAdmittance`, `inputImpedanceUnits`).
- Produces:
  - `interface YElement { kind: 'y'; a; b; y: (f) => Complex }`
  - `interface Y2Element { kind: 'y2'; a; b; y: (f) => Y2 }`
  - `interface IdealElement { kind: 'ideal'; p1; p2; s1; s2; n }`
  - `type Element`, `interface Netlist { nodeCount; port; elements }` (node 0 = ground), `interface Solution { v: Complex[]; idealCurrents: Complex[] }`
  - `solveNetlist(net, f, iPort = ONE): Solution`: `v[0]` is ground; `port === 0` gives all-zero voltages.
  - `inputImpedance(net, f): Complex`: returns `OPEN` when the matrix is singular.

- [ ] **Step 1: Write the failing test**

`src/engine/mna.test.ts`:

```ts
import test from 'node:test';
import { OPEN, add, cx, inv } from './complex.ts';
import { type Cable, coaxY, embed } from './coax.ts';
import { type Netlist, inputImpedance } from './mna.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits, loadAdmittance, unitY } from './transformer.ts';
import { assertClose } from '../testutil.ts';

const w = (f: number): number => 2 * Math.PI * f;

test('series R, L, C to ground on separate nodes is resistive at resonance', () => {
  const R = 2;
  const L = 1e-6;
  const C = 100e-12;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const net: Netlist = { nodeCount: 4, port: 1, elements: [
    { kind: 'y', a: 1, b: 2, y: () => cx(1 / R) },
    { kind: 'y', a: 2, b: 3, y: (f) => inv(cx(0, w(f) * L)) },
    { kind: 'y', a: 3, b: 0, y: (f) => cx(0, w(f) * C) },
  ] };
  assertClose(inputImpedance(net, f0), cx(R), 1e-9);
});

test('an ideal 1:3 transformer maps 450 Ω to 50 Ω', () => {
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'ideal', p1: 1, p2: 0, s1: 2, s2: 0, n: 3 },
    { kind: 'y', a: 2, b: 0, y: () => cx(1 / 450) },
  ] };
  assertClose(inputImpedance(net, 13.56e6), cx(50), 1e-12);
});

test('a coax 2-port plus a load equals embed', () => {
  const cab: Cable = { length: 1.245, vf: 0.7, z0: 50, alpha13: 0.0073 };
  const zl = cx(7.8, 27.9);
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y2', a: 1, b: 2, y: (f) => coaxY(cab, f) },
    { kind: 'y', a: 2, b: 0, y: () => inv(zl) },
  ] };
  assertClose(inputImpedance(net, 13.56e6), embed(zl, cab, 13.56e6), 1e-10);
});

test('two paralleled T-model units equal summed unit admittances', () => {
  const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y2', a: 1, b: 2, y: (f) => unitY(u, f) },
    { kind: 'y2', a: 1, b: 2, y: (f) => unitY(u, f) },
    { kind: 'y', a: 2, b: 0, y: (f) => loadAdmittance(load, f) },
  ] };
  assertClose(inputImpedance(net, 12e6), inputImpedanceUnits([u, u], load, 12e6), 1e-10);
});

test('an L-network matches the closed form', () => {
  const f = 13.56e6;
  const zl = cx(1.5, 24.6);
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y', a: 1, b: 2, y: (x) => cx(0, w(x) * 80e-12) },
    { kind: 'y', a: 2, b: 0, y: (x) => cx(0, w(x) * 180e-12) },
    { kind: 'y', a: 2, b: 0, y: () => inv(zl) },
  ] };
  const want = add(cx(0, -1 / (w(f) * 80e-12)), inv(add(cx(0, w(f) * 180e-12), inv(zl))));
  assertClose(inputImpedance(net, f), want, 1e-12);
});

test('a port with no path to ground reads OPEN', () => {
  const net: Netlist = { nodeCount: 3, port: 1, elements: [{ kind: 'y', a: 1, b: 2, y: () => cx(0.01) }] };
  assertClose(inputImpedance(net, 1e6), OPEN, 0);
});

test('a port shorted to ground (port 0) reads 0 Ω', () => {
  assertClose(inputImpedance({ nodeCount: 1, port: 0, elements: [] }, 1e6), cx(0), 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/engine/mna.test.ts`
Expected: FAIL with `Cannot find module` … `mna.ts`.

- [ ] **Step 3: Write the implementation**

`src/engine/mna.ts`:

```ts
import { type Complex, ONE, OPEN, ZERO, add, cx, neg } from './complex.ts';
import { SingularMatrixError, solveLinear } from './linsolve.ts';
import type { Y2 } from './twoport.ts';

/** Two-terminal admittance between nodes a and b (0 = ground). */
export interface YElement { kind: 'y'; a: number; b: number; y: (f: number) => Complex }
/** Ground-referenced 2-port between node a (port 1) and node b (port 2). */
export interface Y2Element { kind: 'y2'; a: number; b: number; y: (f: number) => Y2 }
/** Ideal transformer 1:n: V(s1) − V(s2) = n·(V(p1) − V(p2)). */
export interface IdealElement { kind: 'ideal'; p1: number; p2: number; s1: number; s2: number; n: number }
export type Element = YElement | Y2Element | IdealElement;

/** Nodes are 0..nodeCount−1 with 0 = ground; a current source drives `port` against ground. */
export interface Netlist { nodeCount: number; port: number; elements: Element[] }
export interface Solution { v: Complex[]; idealCurrents: Complex[] }

export function solveNetlist(net: Netlist, f: number, iPort: Complex = ONE): Solution {
  const nv = net.nodeCount - 1;
  const ideals = net.elements.filter((e): e is IdealElement => e.kind === 'ideal');
  if (net.port === 0) return { v: Array.from({ length: net.nodeCount }, () => ZERO), idealCurrents: ideals.map(() => ZERO) };
  const size = nv + ideals.length;
  const A: Complex[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ZERO));
  const b: Complex[] = Array.from({ length: size }, () => ZERO);
  const put = (i: number, j: number, v: Complex): void => {
    if (i > 0 && j > 0) A[i - 1][j - 1] = add(A[i - 1][j - 1], v);
  };
  for (const e of net.elements) {
    if (e.kind === 'y') {
      const y = e.y(f);
      put(e.a, e.a, y);
      put(e.b, e.b, y);
      put(e.a, e.b, neg(y));
      put(e.b, e.a, neg(y));
    } else if (e.kind === 'y2') {
      const [y11, y12, y21, y22] = e.y(f);
      put(e.a, e.a, y11);
      put(e.a, e.b, y12);
      put(e.b, e.a, y21);
      put(e.b, e.b, y22);
    }
  }
  ideals.forEach((e, k) => {
    const q = nv + k; // row and column of this transformer's primary current
    const col = (node: number, v: Complex): void => {
      if (node > 0) A[node - 1][q] = add(A[node - 1][q], v);
    };
    const row = (node: number, v: Complex): void => {
      if (node > 0) A[q][node - 1] = add(A[q][node - 1], v);
    };
    col(e.p1, ONE);
    col(e.p2, neg(ONE));
    col(e.s1, cx(-1 / e.n));
    col(e.s2, cx(1 / e.n));
    row(e.p1, cx(e.n));
    row(e.p2, cx(-e.n));
    row(e.s1, neg(ONE));
    row(e.s2, ONE);
  });
  b[net.port - 1] = iPort;
  const x = solveLinear(A, b);
  return { v: [ZERO, ...x.slice(0, nv)], idealCurrents: x.slice(nv) };
}

/** Impedance looking into the port; OPEN when no current path exists (singular matrix). */
export function inputImpedance(net: Netlist, f: number): Complex {
  try {
    return solveNetlist(net, f).v[net.port];
  } catch (err) {
    if (err instanceof SingularMatrixError) return OPEN;
    throw err;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/engine/mna.test.ts && npm run typecheck`
Expected: 7 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/engine/mna.ts src/engine/mna.test.ts
git commit -m "feat(engine): add the complex nodal solver" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: Engine parity against the Python model

**Files:**
- Modify: `src/testutil.ts` (add `ROOT`, `readFixtureJson`)
- Test: `src/engine/parity.test.ts`

**Interfaces:**
- Consumes:
  - `fixtures/python/rfchain_cases.json` (Task 2);
  - `unitAbcd`, `inputImpedanceUnits`, `unitY`, `loadAdmittance` (Task 5);
  - `coaxY`, `embed`, `deembed` (Task 4); `inputImpedance` (Task 6).
- Produces:
  - `ROOT: URL` (the repo root);
  - `readFixtureJson<T>(name): T`, reading `fixtures/python/<name>`.

This task adds only tests. If one fails, the bug is in Tasks 4–6: fix it there, re-run, and commit the fix with this test.

- [ ] **Step 1: Add the fixture reader to `src/testutil.ts`**

Append:

```ts
import { readFileSync } from 'node:fs';

/** Repository root. */
export const ROOT = new URL('../', import.meta.url);

export function readFixtureJson<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`fixtures/python/${name}`, ROOT), 'utf8')) as T;
}
```

(Move the `import { readFileSync }` line to the top of the file with the other imports.)

- [ ] **Step 2: Write the parity test**

`src/engine/parity.test.ts`:

```ts
import test from 'node:test';
import { cx, inv } from './complex.ts';
import { type Cable, coaxY, deembed, embed } from './coax.ts';
import { type Element, type Netlist, inputImpedance } from './mna.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits, loadAdmittance, unitAbcd, unitY } from './transformer.ts';
import { assertClose, pair, readFixtureJson } from '../testutil.ts';

interface Row { f: number; abcd: number[][][]; zx: number[]; zin: number[]; emb: number[]; de: number[] }
interface Net { c_series: number; c_shunt: number; esr_series: number; esr_shunt: number; l_series: number; r_lseries: number }
interface Case { name: string; units: Unit[]; load: PlateLoad; net: Net; cable: Cable; rows: Row[] }

const { cases } = readFixtureJson<{ cases: Case[] }>('rfchain_cases.json');
const w = (f: number): number => 2 * Math.PI * f;

/** rfchain.network_input as a netlist: series C → node (shunt C) → series L → paralleled units → plate load. */
function caseNetlist(c: Case, withCable: boolean): Netlist {
  const n = c.net;
  // nodes: 1 network input, 2 node, 3 primary, 4 secondary, 5 cable input (only with the cable)
  const elements: Element[] = [
    { kind: 'y', a: 1, b: 2, y: (f) => inv(cx(n.esr_series, -1 / (w(f) * n.c_series))) },
    { kind: 'y', a: 2, b: 0, y: (f) => inv(cx(n.esr_shunt, -1 / (w(f) * n.c_shunt))) },
    { kind: 'y', a: 2, b: 3, y: (f) => inv(cx(n.r_lseries, w(f) * n.l_series)) },
    ...c.units.map((u): Element => ({ kind: 'y2', a: 3, b: 4, y: (f) => unitY(u, f) })),
    { kind: 'y', a: 4, b: 0, y: (f) => loadAdmittance(c.load, f) },
  ];
  if (withCable) elements.push({ kind: 'y2', a: 5, b: 1, y: (f) => coaxY(c.cable, f) });
  return { nodeCount: withCable ? 6 : 5, port: withCable ? 5 : 1, elements };
}

for (const c of cases) {
  test(`rfchain parity: ${c.name}`, () => {
    for (const r of c.rows) {
      c.units.forEach((u, k) => unitAbcd(u, r.f).forEach((m, i) => assertClose(m, pair(r.abcd[k][i]), 1e-9, `abcd[${k}][${i}] @${r.f}`)));
      assertClose(inputImpedanceUnits(c.units, c.load, r.f), pair(r.zx), 1e-9, `input_impedance @${r.f}`);
      assertClose(inputImpedance(caseNetlist(c, false), r.f), pair(r.zin), 1e-9, `network_input @${r.f}`);
      assertClose(inputImpedance(caseNetlist(c, true), r.f), pair(r.emb), 1e-9, `netlist with cable @${r.f}`);
      assertClose(embed(pair(r.zin), c.cable, r.f), pair(r.emb), 1e-9, `embed @${r.f}`);
      assertClose(deembed(pair(r.emb), c.cable, r.f), pair(r.de), 1e-9, `deembed @${r.f}`);
    }
  });
}
```

- [ ] **Step 3: Run the parity test**

Run: `node --experimental-strip-types --test src/engine/parity.test.ts`
Expected: 12 tests pass (3 cases × 2 networks × 2 cables), each checking 6 frequencies.

A failure names the quantity and frequency. Fix the engine module, not the tolerance.

- [ ] **Step 4: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: all tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/testutil.ts src/engine/parity.test.ts
git commit -m "test(engine): prove parity with rfchain on captured fixtures" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Touchstone parser and sweep utilities

**Files:**
- Create: `src/io/s1p.ts`, `src/io/sweep.ts`
- Modify: `src/testutil.ts` (add `loadFixtureSweep`)
- Test: `src/io/s1p.test.ts`, `src/io/sweep.test.ts`

**Interfaces:**
- Consumes: Task 1 complex functions.
- Produces:
  - `interface Touchstone { f: number[]; gamma: Complex[] }`, `parseS1p(text): Touchstone`
  - `Z0 = 50`, `interface Sweep { id; name; f: number[]; gamma: Complex[] }`
  - `zFromGamma(g, z0?)` (Γ = 1 gives OPEN), `gammaFromZ(z, z0?)` (non-finite Z gives Γ = 1)
  - `nearestIndex(f, target)`: the first minimum, like `np.argmin`
  - `interpClamp(xs, ys, x)`: `np.interp` semantics, clamped at both ends
  - `bandIndices(f, lo, hi)`: strict `lo < f < hi`
  - `src/testutil.ts`: `loadFixtureSweep(id, file): Sweep`

- [ ] **Step 1: Write the failing tests**

`src/io/s1p.test.ts`:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { parseS1p } from './s1p.ts';
import { ROOT, assertClose, assertNear } from '../testutil.ts';

const S80 = 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p';

test('parses RI data in MHz', () => {
  const t = parseS1p('# MHz S RI R 50\n1 0.5 -0.25\n2 0.4 0.1');
  assert.deepEqual(t.f, [1e6, 2e6]);
  assertClose(t.gamma[0], cx(0.5, -0.25), 0);
});

test('converts dB-angle pairs', () => {
  const t = parseS1p('# GHz S DB R 50\n1 -6.020599913 90');
  assertClose(t.gamma[0], cx(0, 0.5), 1e-9);
});

test('refuses a non-50 Ω reference, Touchstone 2.0, and an incomplete record', () => {
  assert.throws(() => parseS1p('# MHz S RI R 75\n1 0 0'), /50 Ω/);
  assert.throws(() => parseS1p('[Version] 2.0\n# MHz S RI R 50\n1 0 0'), /Touchstone 2.0/);
  assert.throws(() => parseS1p('# MHz S RI R 50\n1 0'), /incomplete/);
});

test('reads a real NanoVNA Web export', () => {
  const t = parseS1p(readFileSync(new URL(`fixtures/sweeps/${S80}`, ROOT), 'utf8'));
  assert.equal(t.f.length, 5050);
  assert.equal(t.f[0], 1e6);
  assertNear(t.f[5049], 25e6, 1e-6);
  assertClose(t.gamma[0], cx(0.994826688, -0.100195592), 1e-12);
});
```

`src/io/sweep.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ONE, OPEN, cx } from '../engine/complex.ts';
import { bandIndices, gammaFromZ, interpClamp, nearestIndex, zFromGamma } from './sweep.ts';
import { assertClose, loadFixtureSweep } from '../testutil.ts';

test('Γ ↔ Z round trip, with open and Γ = 1 handled', () => {
  const z = cx(7.81, 27.89);
  assertClose(zFromGamma(gammaFromZ(z)), z, 1e-12);
  assertClose(gammaFromZ(OPEN), ONE, 0);
  assertClose(zFromGamma(ONE), OPEN, 0);
});

test('interpClamp matches np.interp: nodes exact, linear between, clamped outside', () => {
  const xs = [10, 20, 30];
  const ys = [1, 3, 2];
  assert.equal(interpClamp(xs, ys, 20), 3);
  assert.equal(interpClamp(xs, ys, 15), 2);
  assert.equal(interpClamp(xs, ys, 5), 1);
  assert.equal(interpClamp(xs, ys, 35), 2);
});

test('nearestIndex returns the first minimum; bandIndices is strict', () => {
  assert.equal(nearestIndex([1, 2, 3, 4], 2.5), 1);
  assert.deepEqual(bandIndices([12.0e6, 12.5e6, 14.6e6, 14.0e6], 12.0e6, 14.6e6), [1, 3]);
});

test('the real 80/200 sweep lands at 5.03 + j4.30 Ω at 13.56 MHz (spec §14)', () => {
  const s = loadFixtureSweep('s80', 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p');
  const k = nearestIndex(s.f, 13.56e6);
  assert.ok(Math.abs(s.f[k] - 13.5622e6) < 100);
  const z = zFromGamma(s.gamma[k]);
  assert.ok(Math.abs(z.re - 5.03) < 0.005 && Math.abs(z.im - 4.3) < 0.005, `${z.re} ${z.im}`);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/io/s1p.test.ts src/io/sweep.test.ts`
Expected: FAIL with `Cannot find module` for `s1p.ts` and `sweep.ts`, and for `loadFixtureSweep` in testutil.

- [ ] **Step 3: Write the implementations**

`src/io/s1p.ts`:

```ts
import { type Complex, cx } from '../engine/complex.ts';

/** A one-port Touchstone sweep: frequencies [Hz] and S11. */
export interface Touchstone {
  f: number[];
  gamma: Complex[];
}

function pairOf(a: number, b: number, format: string): Complex {
  if (format === 'MA') {
    const t = (b * Math.PI) / 180;
    return cx(a * Math.cos(t), a * Math.sin(t));
  }
  if (format === 'DB') {
    const m = 10 ** (a / 20);
    const t = (b * Math.PI) / 180;
    return cx(m * Math.cos(t), m * Math.sin(t));
  }
  return cx(a, b);
}

/** Parses a Touchstone 1.x .s1p file (adapted from nanovna-web src/lib/files.ts parseTouchstone). */
export function parseS1p(text: string): Touchstone {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/!.*/, '').trim()).filter(Boolean);
  if (lines.some((line) => line.startsWith('['))) throw new Error('Touchstone 2.0 keyword files are not supported; export as Touchstone 1.x.');
  const option = lines.find((line) => line.startsWith('#'))?.toUpperCase().split(/\s+/) ?? ['#', 'GHZ', 'S', 'MA', 'R', '50'];
  const unit = option[1] ?? 'GHZ';
  const parameter = option[2] ?? 'S';
  const format = option[3] ?? 'MA';
  if (parameter !== 'S') throw new Error('Only Touchstone S-parameter files are supported.');
  if (!['RI', 'MA', 'DB'].includes(format)) throw new Error(`Unsupported Touchstone format: ${format}`);
  const ri = option.indexOf('R');
  const reference = ri >= 0 ? Number(option[ri + 1]) : 50;
  if (!Number.isFinite(reference) || Math.abs(reference - 50) > 1e-9) {
    throw new Error(`Only 50 Ω reference impedance is supported; this file declares ${reference} Ω.`);
  }
  const factor = ({ HZ: 1, KHZ: 1e3, MHZ: 1e6, GHZ: 1e9 } as Record<string, number>)[unit];
  if (!factor) throw new Error(`Unsupported Touchstone frequency unit: ${unit}`);
  const values = lines.filter((line) => !line.startsWith('#')).flatMap((line) => line.split(/\s+/)).map(Number);
  if (values.some((v) => !Number.isFinite(v))) throw new Error('Touchstone data contain a non-numeric token.');
  if (values.length % 3 !== 0) throw new Error('Touchstone data end with an incomplete 1-port record.');
  const f: number[] = [];
  const gamma: Complex[] = [];
  for (let i = 0; i < values.length; i += 3) {
    f.push(values[i] * factor);
    gamma.push(pairOf(values[i + 1], values[i + 2], format));
  }
  if (!f.length) throw new Error('No S-parameter rows were found.');
  for (let i = 1; i < f.length; i += 1) {
    if (f[i] <= f[i - 1]) throw new Error('Frequencies must be strictly increasing without duplicates.');
  }
  return { f, gamma };
}
```

`src/io/sweep.ts`:

```ts
import { type Complex, ONE, OPEN, add, cx, div, isFiniteC, scale, sub } from '../engine/complex.ts';

export const Z0 = 50;

/** A measured one-port sweep at the AIT-out plane. */
export interface Sweep {
  id: string;
  name: string;
  f: number[];
  gamma: Complex[];
}

export function zFromGamma(g: Complex, z0 = Z0): Complex {
  const d = sub(ONE, g);
  if (d.re === 0 && d.im === 0) return OPEN;
  return scale(div(add(ONE, g), d), z0);
}

export function gammaFromZ(z: Complex, z0 = Z0): Complex {
  if (!isFiniteC(z)) return ONE;
  return div(sub(z, cx(z0)), add(z, cx(z0)));
}

/** Index of the first grid point nearest `target` (np.argmin(abs(f - target))). */
export function nearestIndex(f: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < f.length; i += 1) if (Math.abs(f[i] - target) < Math.abs(f[best] - target)) best = i;
  return best;
}

/** np.interp: linear inside, exact at nodes, clamped to the end values outside. */
export function interpClamp(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const slope = (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]);
  return slope * (x - xs[lo]) + ys[lo];
}

/** Indices with lo < f < hi (strict, as the Python band masks). */
export function bandIndices(f: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  f.forEach((x, i) => {
    if (x > lo && x < hi) out.push(i);
  });
  return out;
}
```

Append to `src/testutil.ts` (imports to the top):

```ts
import { parseS1p } from './io/s1p.ts';
import type { Sweep } from './io/sweep.ts';

export function loadFixtureSweep(id: string, file: string): Sweep {
  const t = parseS1p(readFileSync(new URL(`fixtures/sweeps/${file}`, ROOT), 'utf8'));
  return { id, name: file, f: t.f, gamma: t.gamma };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/io/s1p.test.ts src/io/sweep.test.ts && npm run typecheck`
Expected: 8 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/io src/testutil.ts
git commit -m "feat(io): add the Touchstone parser and sweep utilities" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Parts data: HT50 stock, wire estimate, stack estimate

**Files:**
- Create: `src/blocks/ht50.ts`, `src/blocks/wire.ts`, `src/blocks/design.ts`
- Test: `src/blocks/ht50.test.ts`, `src/blocks/wire.test.ts`, `src/blocks/design.test.ts`

**Interfaces:**
- Consumes: `Unit` (Task 5); `fixtures/python/design_units.json` (Task 2).
- Produces:
  - `type CapValue = 100 | 50 | 30`, `CAP_VALUES`, `interface Rating { vRms; iRms }`, `HT50`
  - `type Counts = Record<CapValue, number>`, `counts(n100?, n50?, n30?)`, `DEFAULT_STOCK`, `countsPf`, `partTotal`
  - `interface BankParts { counts; nSeries: 1 | 2 }`, `physicalParts(b)`, `sumCounts(list)`, `stockLeft(stock, used)`, `overdrawn(left)`
  - `awgDiameter`, `skinDepth`, `straightWireL`, `wireR`, `interface WireEstimate { L; R }`, `estimateWire(lengthMm, awg, strands, f)`
  - `interface Design { N_p; N_s; N_c; strap }`, `interface Consts`, `DESIGN_CONSTS`, `turnLengthMm(n_c)`, `l2Secondary(n_s, n_c, k)`, `estimateUnit(d, k?): Unit`

- [ ] **Step 1: Write the failing tests**

`src/blocks/ht50.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, HT50, counts, countsPf, overdrawn, physicalParts, stockLeft, sumCounts } from './ht50.ts';

test('HT50 ratings at 13.56 MHz and the stock on hand (model/match.py, stock_net.py)', () => {
  assert.deepEqual(HT50[100], { vRms: 1080, iRms: 9.2 });
  assert.deepEqual(HT50[50], { vRms: 1530, iRms: 6.5 });
  assert.deepEqual(HT50[30], { vRms: 1980, iRms: 5.1 });
  assert.deepEqual(DEFAULT_STOCK, counts(10, 3, 2));
});

test('capacitance and physical parts', () => {
  assert.equal(countsPf(counts(1, 1, 1)), 180);
  assert.deepEqual(physicalParts({ counts: counts(1, 0, 1), nSeries: 2 }), counts(2, 0, 2));
  assert.deepEqual(sumCounts([counts(1, 1, 0), counts(2, 0, 1)]), counts(3, 1, 1));
});

test('stock accounting flags overdrawn values', () => {
  const left = stockLeft(DEFAULT_STOCK, counts(4, 1, 3));
  assert.deepEqual(left, counts(6, 2, -1));
  assert.deepEqual(overdrawn(left), [30]);
});
```

`src/blocks/wire.test.ts`:

```ts
import test from 'node:test';
import { awgDiameter, estimateWire, skinDepth, straightWireL } from './wire.ts';
import { assertNear } from '../testutil.ts';

test('14 AWG is 1.628 mm', () => assertNear(awgDiameter(14) * 1e3, 1.628, 3e-3));
test('copper skin depth at 13.56 MHz is 17.7 µm', () => assertNear(skinDepth(13.56e6) * 1e6, 17.7, 5e-3));
test('a 100 mm, 1 mm-radius straight wire is 86.0 nH', () => assertNear(straightWireL(0.1, 1e-3) * 1e9, 85.97, 1e-3));
test('a 100 mm single 14 AWG wire is about 18.8 mΩ at 13.56 MHz', () => assertNear(estimateWire(100, 14, 1, 13.56e6).R * 1e3, 18.76, 1e-2));
```

`src/blocks/design.test.ts`:

```ts
import test from 'node:test';
import type { Unit } from '../engine/transformer.ts';
import { DESIGN_CONSTS, estimateUnit, turnLengthMm } from './design.ts';
import { assertNear, readFixtureJson } from '../testutil.ts';

interface Fx { consts: Record<string, number>; designs: { N_p: number; N_s: number; N_c: number; strap: boolean; turn_length_mm: number; unit: Unit }[] }
const fx = readFixtureJson<Fx>('design_units.json');

test('ported constants equal model/design.py Consts', () => {
  for (const [k, v] of Object.entries(DESIGN_CONSTS)) assertNear(v, fx.consts[k], 1e-15, k);
});

test('estimateUnit equals design.make_unit', () => {
  for (const d of fx.designs) {
    const u = estimateUnit({ N_p: d.N_p, N_s: d.N_s, N_c: d.N_c, strap: d.strap }) as unknown as Record<string, number>;
    const want = d.unit as unknown as Record<string, number>;
    for (const key of Object.keys(want)) assertNear(u[key], want[key], 1e-12, `${d.N_p}:${d.N_s} ${key}`);
    assertNear(turnLengthMm(d.N_c), d.turn_length_mm, 1e-12);
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/blocks/*.test.ts`
Expected: FAIL with `Cannot find module` for each block module.

- [ ] **Step 3: Write the implementations**

`src/blocks/ht50.ts`:

```ts
/** HEC HT50 parts at 13.56 MHz (model/match.py HT50) and the stock on hand (pass5/stock/stock_net.py STOCK). */
export type CapValue = 100 | 50 | 30;
export const CAP_VALUES: readonly CapValue[] = [100, 50, 30];

export interface Rating {
  vRms: number;
  iRms: number;
}

export const HT50: Readonly<Record<CapValue, Rating>> = {
  100: { vRms: 1080, iRms: 9.2 },
  50: { vRms: 1530, iRms: 6.5 },
  30: { vRms: 1980, iRms: 5.1 },
};

export type Counts = Record<CapValue, number>;
export const counts = (n100 = 0, n50 = 0, n30 = 0): Counts => ({ 100: n100, 50: n50, 30: n30 });
export const DEFAULT_STOCK: Counts = counts(10, 3, 2);
export const countsPf = (c: Counts): number => 100 * c[100] + 50 * c[50] + 30 * c[30];
export const partTotal = (c: Counts): number => c[100] + c[50] + c[30];

/** A bank's parts: one parallel group, or two identical groups in series. */
export interface BankParts {
  counts: Counts;
  nSeries: 1 | 2;
}

export const physicalParts = (b: BankParts): Counts =>
  counts(b.counts[100] * b.nSeries, b.counts[50] * b.nSeries, b.counts[30] * b.nSeries);
export const sumCounts = (list: Counts[]): Counts =>
  list.reduce((a, c) => counts(a[100] + c[100], a[50] + c[50], a[30] + c[30]), counts());
export const stockLeft = (stock: Counts, used: Counts): Counts =>
  counts(stock[100] - used[100], stock[50] - used[50], stock[30] - used[30]);
export const overdrawn = (left: Counts): CapValue[] => CAP_VALUES.filter((v) => left[v] < 0);
```

`src/blocks/wire.ts`:

```ts
const MU0 = 4e-7 * Math.PI;
export const RHO_CU = 1.68e-8;

/** Bare-conductor diameter of an AWG gauge [m]. */
export const awgDiameter = (awg: number): number => 0.127e-3 * 92 ** ((36 - awg) / 39);
export const skinDepth = (f: number, rho = RHO_CU): number => Math.sqrt(rho / (Math.PI * f * MU0));

/** High-frequency inductance of a straight round conductor: (μ0/2π)·l·[ln(2l/r) − 1]. An estimate (badge `est`). */
export const straightWireL = (length: number, radius: number): number =>
  (MU0 / (2 * Math.PI)) * length * (Math.log((2 * length) / radius) - 1);

/** AC resistance of `strands` parallel round strands with the current in a skin-depth annulus. An estimate. */
export function wireR(length: number, strandRadius: number, strands: number, f: number, rho = RHO_CU): number {
  const d = skinDepth(f, rho);
  const area = strandRadius > d ? Math.PI * (strandRadius ** 2 - (strandRadius - d) ** 2) : Math.PI * strandRadius ** 2;
  return (rho * length) / (area * strands);
}

export interface WireEstimate {
  L: number;
  R: number;
}

/** Jumper estimate: strands treated as one conductor of radius √N·r for L, N parallel strands for R. */
export function estimateWire(lengthMm: number, awg: number, strands: number, f: number): WireEstimate {
  const len = lengthMm * 1e-3;
  const r = awgDiameter(awg) / 2;
  return { L: straightWireL(len, r * Math.sqrt(strands)), R: wireR(len, r, strands, f) };
}
```

`src/blocks/design.ts`:

```ts
import type { Unit } from '../engine/transformer.ts';

/** A stack to estimate from its turns and cores (model/design.py Design, without the C+D `ref` branch). */
export interface Design {
  N_p: number;
  N_s: number;
  N_c: number;
  strap: boolean;
}

/** The subset of model/design.py Consts that make_unit uses. */
export interface Consts {
  AL13: number;
  L_air_t2: number;
  leak_a: number;
  leak_b: number;
  leak_mult: number;
  leak_gamma: number;
  c_w_cd: number;
  c_w_gamma: number;
  R1_fix: number;
  r1_per_mm: number;
  strap_factor: number;
  R2_fix: number;
  r2_per_mm: number;
}

export const DESIGN_CONSTS: Consts = {
  AL13: 72e-9, L_air_t2: 0.0175e-6, leak_a: 0.163e-6, leak_b: 1.436e-9, leak_mult: 1.0, leak_gamma: 2.0,
  c_w_cd: 0.2e-12, c_w_gamma: 1.5, R1_fix: 0.1, r1_per_mm: 1.5e-4, strap_factor: 0.35, R2_fix: 0.05, r2_per_mm: 6.0e-4,
};

export const CORE_RADIAL_MM = 12.8;
export const CORE_H_MM = 12.85;
export const SPACER_MM = 1.6;

/** Length of one turn around a stack of n_c cores (design.turn_length_mm). */
export const turnLengthMm = (n_c: number): number => 2 * (CORE_RADIAL_MM + n_c * CORE_H_MM + (n_c - 1) * SPACER_MM);

/** Secondary-side leakage [H] (design.l2_secondary). */
export const l2Secondary = (n_s: number, n_c: number, k: Consts): number =>
  k.leak_mult * 18 ** 2 * (n_s / 18) ** k.leak_gamma * (k.leak_a + k.leak_b * turnLengthMm(n_c));

/** T-model unit from turns and cores via the scaling laws calibrated on the measured builds (design.make_unit). */
export function estimateUnit(d: Design, k: Consts = DESIGN_CONSTS): Unit {
  const lt = turnLengthMm(d.N_c);
  const n = d.N_s / d.N_p;
  const r1 = k.R1_fix + k.r1_per_mm * d.N_p * lt * (d.strap ? k.strap_factor : 1.0);
  const r2 = k.R2_fix + k.r2_per_mm * d.N_s * lt;
  const c_w = k.c_w_cd * (d.N_s / 18) * (lt / turnLengthMm(2)) ** k.c_w_gamma;
  const l_m = d.N_p ** 2 * (d.N_c * k.AL13 + k.L_air_t2);
  return { n, L_leak: l2Secondary(d.N_s, d.N_c, k) / n ** 2, f_pri: 0, L_m: l_m, G_core: 0, R1: r1, R2: r2, C_w: c_w, N_p: d.N_p, N_c: d.N_c };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/blocks/*.test.ts && npm run typecheck`
Expected: 9 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/blocks
git commit -m "feat(blocks): add HT50 stock, wire estimate and stack estimate (design.make_unit port)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Chain types and block impedances

**Files:**
- Create: `src/chain/types.ts`, `src/chain/blockZ.ts`
- Test: `src/chain/blockZ.test.ts`

**Interfaces:**
- Consumes:
  - `Complex` and functions (Task 1); `Cable`, `deembed` (Task 4); `Unit` (Task 5);
  - `Counts`, `countsPf`, `counts` (Task 9); `estimateWire` (Task 9);
  - `Sweep`, `interpClamp`, `zFromGamma`, `gammaFromZ` (Task 8).
- Produces (`types.ts`):
  - `type Badge`, `interface Param { value; badge; free; lo; hi }`, `param(value, badge?, free?, lo?, hi?)`
  - Block interfaces: `CoaxBlock`, `CapBankBlock`, `InductorBlock`, `WireBlock`, `MeasuredBranchBlock`, `StackBlock`, `PlatesBlock`, `PrimitiveBlock`, `IdealBlock`, `ShuntBlock`, `ParallelBlock`
  - `type TwoTerminalBlock`, `type Block`, `interface Chain { name; blocks }`
  - `interface Variant { name; cable; Lj; flag? }`, `interface Window { rLo; rHi; xLo; xHi }`
  - `interface BranchTable { f; re; im }`, `interface Context { variant; sweeps: Record<string, Sweep>; cache?: Map<string, BranchTable> }`, `type ZFn`
- Produces (`blockZ.ts`):
  - `type BlockImpedance = {kind:'z', z} | {kind:'short'} | {kind:'open'}`
  - `groupPf(b)`, `capBankFarads(b)`, `buildBranchTable(sweep, variant)`, `branchFreq(b, f)`, `branchOutOfRange(b, table, f)`, `measuredZ(b, table)`
  - `twoTerminalZ(b, table: (sweepId) => BranchTable)`

**Block parameter units (SI):**
- `InductorBlock.L` in H (may be negative: the fitted branch L bounds are −100…600 nH).
- `CapBankBlock.k`: unitless scale; `customPf` in pF.
- `MeasuredBranchBlock.d`: a fraction (0.0331 = 3.31 %); `dLb` in H.
- `PlatesBlock.C` in F; `G_cube`, `G_fix` in S; `PrimitiveBlock.value` in Ω, H or F.

- [ ] **Step 1: Write `src/chain/types.ts` (types only; exercised by the tests below)**

```ts
import type { Complex } from '../engine/complex.ts';
import type { Cable } from '../engine/coax.ts';
import type { Unit } from '../engine/transformer.ts';
import type { Counts } from '../blocks/ht50.ts';
import type { Sweep } from '../io/sweep.ts';

/** Where a number came from: fitted to sweeps, estimated from geometry, or typed by the user (spec §5). */
export type Badge = 'fit' | 'est' | 'typed';

/** A numeric block parameter in SI units, with its fit bounds. */
export interface Param {
  value: number;
  badge: Badge;
  free: boolean;
  lo: number;
  hi: number;
}

export const param = (value: number, badge: Badge = 'typed', free = false, lo = -Infinity, hi = Infinity): Param => ({ value, badge, free, lo, hi });

interface Base {
  id: string;
  label: string;
}

export interface CoaxBlock extends Base { type: 'coax' }
export interface CapBankBlock extends Base {
  type: 'capBank';
  counts: Counts;
  customPf: number;
  nSeries: 1 | 2;
  slots: number;
  k: Param;
  esr: number;
  searchable: boolean;
}
export interface InductorBlock extends Base { type: 'inductor'; L: Param; R: number }
export interface WireBlock extends Base { type: 'wire'; lengthMm: number; awg: number; strands: number }
export interface MeasuredBranchBlock extends Base { type: 'measuredBranch'; sweepId: string; kr: Param; d: Param; dLb: Param; loop: boolean }
export interface StackBlock extends Base { type: 'stack'; unit: Unit; source: 'preset' | 'estimate' | 'fit' }
export interface PlatesBlock extends Base { type: 'plates'; C: Param; G_cube: Param; G_fix: Param }
export interface PrimitiveBlock extends Base { type: 'primitive'; kind: 'R' | 'L' | 'C' | 'short'; value: Param }
export interface IdealBlock extends Base { type: 'ideal'; n: number }
/** A sub-chain from the current node whose far end is tied to ground. */
export interface ShuntBlock extends Base { type: 'shunt'; chain: Block[] }
/** Sub-chains that start at the current node and end on one shared node. */
export interface ParallelBlock extends Base { type: 'parallel'; chains: Block[][] }

export type TwoTerminalBlock = CapBankBlock | InductorBlock | WireBlock | MeasuredBranchBlock | PlatesBlock | PrimitiveBlock;
export type Block = CoaxBlock | TwoTerminalBlock | StackBlock | IdealBlock | ShuntBlock | ParallelBlock;

/** Blocks from the port outward; the main chain's far end is left open. */
export interface Chain {
  name: string;
  blocks: Block[];
}

/** Parameters the sweeps cannot separate; used both to de-embed the measured branch and to embed predictions (spec §8). */
export interface Variant {
  name: string;
  cable: Cable;
  Lj: number;
  flag?: string;
}

export interface Window {
  rLo: number;
  rHi: number;
  xLo: number;
  xHi: number;
}

/** A measured branch z_p(f) on its sweep's grid, for one variant. */
export interface BranchTable {
  f: number[];
  re: number[];
  im: number[];
}

export interface Context {
  variant: Variant;
  sweeps: Record<string, Sweep>;
  cache?: Map<string, BranchTable>;
}

export type ZFn = (f: number) => Complex;
```

- [ ] **Step 2: Write the failing test**

`src/chain/blockZ.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cx, sub } from '../engine/complex.ts';
import { deembed } from '../engine/coax.ts';
import { counts } from '../blocks/ht50.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { branchOutOfRange, buildBranchTable, capBankFarads, measuredZ, twoTerminalZ } from './blockZ.ts';
import { type BranchTable, type CapBankBlock, type MeasuredBranchBlock, type Variant, param } from './types.ts';
import { assertClose, assertNear } from '../testutil.ts';

const bank = (n100: number, n50: number, n30: number, extra: Partial<CapBankBlock> = {}): CapBankBlock => ({
  id: 'b', label: 'bank', type: 'capBank', counts: counts(n100, n50, n30), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true, ...extra,
});
const noTable = (): BranchTable => {
  throw new Error('no table expected');
};

test('a 50 + 30 pF series bank is −j146.7 Ω at 13.56 MHz', () => {
  const imp = twoTerminalZ(bank(0, 1, 1), noTable);
  assert.equal(imp.kind, 'z');
  if (imp.kind === 'z') assertClose(imp.z(13.56e6), cx(0, -1 / (2 * Math.PI * 13.56e6 * 80e-12)), 1e-12);
});

test('scale k and two groups in series set the actual capacitance', () => {
  assertNear(capBankFarads(bank(0, 1, 1, { k: param(1.1), nSeries: 2 })) * 1e12, 44, 1e-12);
});

test('an empty bank is an open circuit, not NaN (review focus 1)', () => {
  assert.equal(twoTerminalZ(bank(0, 0, 0), noTable).kind, 'open');
});

test('zero inductor and zero resistor are shorts; a zero capacitor is open', () => {
  assert.equal(twoTerminalZ({ id: 'l', label: 'l', type: 'inductor', L: param(0), R: 0 }, noTable).kind, 'short');
  assert.equal(twoTerminalZ({ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(0) }, noTable).kind, 'short');
  assert.equal(twoTerminalZ({ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: param(0) }, noTable).kind, 'open');
});

test('plates with no conductance and no capacitance are open', () => {
  const imp = twoTerminalZ({ id: 'p', label: 'p', type: 'plates', C: param(0), G_cube: param(0), G_fix: param(0) }, noTable);
  assert.equal(imp.kind, 'open');
});

const mb = (extra: Partial<MeasuredBranchBlock> = {}): MeasuredBranchBlock => ({
  id: 'm', label: 'm', type: 'measuredBranch', sweepId: 's', kr: param(0.5), d: param(0.1), dLb: param(10e-9), loop: true, ...extra,
});
const table: BranchTable = { f: [10e6, 20e6], re: [1, 3], im: [10, 30] };

test('measured branch: kr scales R, the loop reads the table at f(1+d) and adds jω·dLb', () => {
  assertClose(measuredZ(mb(), table)(10e6), cx(0.6, 12 + 2 * Math.PI * 10e6 * 10e-9), 1e-12);
  assertClose(measuredZ(mb({ loop: false }), table)(15e6), cx(1.0, 20), 1e-12);
});

test('reads outside the table clamp to the end values and are flagged (review focus 3)', () => {
  assertClose(measuredZ(mb({ loop: false }), table)(30e6), cx(1.5, 30), 1e-12);
  assert.equal(branchOutOfRange(mb({ loop: false }), table, 30e6), true);
  assert.equal(branchOutOfRange(mb({ loop: false }), table, 15e6), false);
  assert.equal(branchOutOfRange(mb({ d: param(0.3) }), table, 18e6), true);
});

test('buildBranchTable de-embeds the variant cable and removes its jumper L', () => {
  const s: Sweep = { id: 's', name: 's', f: [13.56e6], gamma: [gammaFromZ(cx(12, 200))] };
  const v: Variant = { name: 'v', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 342e-9 };
  const t = buildBranchTable(s, v);
  const want = sub(deembed(cx(12, 200), v.cable, 13.56e6), cx(0, 2 * Math.PI * 13.56e6 * 342e-9));
  assertClose(cx(t.re[0], t.im[0]), want, 1e-9);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/chain/blockZ.test.ts`
Expected: FAIL with `Cannot find module` … `blockZ.ts`.

- [ ] **Step 4: Write the implementation**

`src/chain/blockZ.ts`:

```ts
import { cx, inv, sub } from '../engine/complex.ts';
import { deembed } from '../engine/coax.ts';
import { countsPf } from '../blocks/ht50.ts';
import { estimateWire } from '../blocks/wire.ts';
import { type Sweep, interpClamp, zFromGamma } from '../io/sweep.ts';
import type { BranchTable, CapBankBlock, MeasuredBranchBlock, TwoTerminalBlock, Variant, ZFn } from './types.ts';

export type BlockImpedance = { kind: 'z'; z: ZFn } | { kind: 'short' } | { kind: 'open' };

const w = (f: number): number => 2 * Math.PI * f;

/** Nominal capacitance of one parallel group [pF]. */
export const groupPf = (b: CapBankBlock): number => countsPf(b.counts) + b.customPf;

/** Actual bank capacitance [F]: nominal group × scale k, divided by the number of groups in series. */
export const capBankFarads = (b: CapBankBlock): number => (groupPf(b) * 1e-12 * b.k.value) / b.nSeries;

/** z_p(f) = deembed(Z_sweep, variant cable) − jωL_j on the sweep's own grid (o7_joint.py). */
export function buildBranchTable(s: Sweep, v: Variant): BranchTable {
  const re: number[] = [];
  const im: number[] = [];
  s.f.forEach((f, i) => {
    const zp = sub(deembed(zFromGamma(s.gamma[i]), v.cable, f), cx(0, w(f) * v.Lj));
    re.push(zp.re);
    im.push(zp.im);
  });
  return { f: s.f, re, im };
}

/** Frequency at which the branch table is read: f·(1 + d) with the sense loop on (o7_loopstate.py `shifted`). */
export const branchFreq = (b: MeasuredBranchBlock, f: number): number => f * (1 + (b.loop ? b.d.value : 0));

export function branchOutOfRange(b: MeasuredBranchBlock, t: BranchTable, f: number): boolean {
  const fe = branchFreq(b, f);
  return fe < t.f[0] || fe > t.f[t.f.length - 1];
}

/** kr·Re z_p(f(1+d)) + j·Im z_p(f(1+d)) (+ jω·dLb with the loop on), clamped at the table ends. */
export function measuredZ(b: MeasuredBranchBlock, t: BranchTable): ZFn {
  return (f) => {
    const fe = branchFreq(b, f);
    const re = interpClamp(t.f, t.re, fe);
    const im = interpClamp(t.f, t.im, fe);
    return cx(b.kr.value * re, im + (b.loop ? w(f) * b.dLb.value : 0));
  };
}

function primitiveZ(kind: 'R' | 'L' | 'C' | 'short', v: number): BlockImpedance {
  if (kind === 'short') return { kind: 'short' };
  if (kind === 'R') return v === 0 ? { kind: 'short' } : { kind: 'z', z: () => cx(v) };
  if (kind === 'L') return v === 0 ? { kind: 'short' } : { kind: 'z', z: (f) => cx(0, w(f) * v) };
  return v > 0 ? { kind: 'z', z: (f) => cx(0, -1 / (w(f) * v)) } : { kind: 'open' };
}

/** Impedance of a two-terminal block; `table` supplies the measured branch for the active variant. */
export function twoTerminalZ(b: TwoTerminalBlock, table: (sweepId: string) => BranchTable): BlockImpedance {
  switch (b.type) {
    case 'capBank': {
      const c = capBankFarads(b);
      if (!(c > 0)) return { kind: 'open' };
      return { kind: 'z', z: (f) => cx(b.esr, -1 / (w(f) * c)) };
    }
    case 'inductor':
      if (b.L.value === 0 && b.R === 0) return { kind: 'short' };
      return { kind: 'z', z: (f) => cx(b.R, w(f) * b.L.value) };
    case 'wire':
      return {
        kind: 'z',
        z: (f) => {
          const e = estimateWire(b.lengthMm, b.awg, b.strands, f);
          return cx(e.R, w(f) * e.L);
        },
      };
    case 'measuredBranch':
      return { kind: 'z', z: measuredZ(b, table(b.sweepId)) };
    case 'plates': {
      const g = b.G_cube.value + b.G_fix.value;
      const c = b.C.value;
      if (g === 0 && c === 0) return { kind: 'open' };
      return { kind: 'z', z: (f) => inv(cx(g, w(f) * c)) };
    }
    case 'primitive':
      return primitiveZ(b.kind, b.value.value);
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `node --experimental-strip-types --test src/chain/blockZ.test.ts && npm run typecheck`
Expected: 8 tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/chain/types.ts src/chain/blockZ.ts src/chain/blockZ.test.ts
git commit -m "feat(chain): add block types and two-terminal block impedances" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Chain compiler

**Files:**
- Create: `src/chain/compile.ts`
- Test: `src/chain/compile.test.ts`

**Interfaces:**
- Consumes:
  - Tasks 1, 4, 5, 6 (`coaxY`, `unitY`, `Element`, `Netlist`, `inputImpedance`);
  - Task 10 (`twoTerminalZ`, `buildBranchTable`, `branchOutOfRange`, the types).
- Produces:
  - `class ChainError extends Error`
  - `interface RunPart { blockId; z: ZFn }`, `interface Run { a; b; parts }`
  - `interface TwoPortRef { blockId; kind: 'coax' | 'stack'; a; b; y }`, `interface BranchRef { block; table }`
  - `interface Compiled { net: Netlist; runs: Run[]; twoPorts: TwoPortRef[]; branches: BranchRef[] }`
  - `seriesY(parts, f)` (any open part makes the admittance 0)
  - `compile(chain, ctx): Compiled`, `zin(c, f)`, `evaluate(chain, ctx, freqs): Complex[]`, `outOfRangeAt(c, f): boolean`

**Rules the compiler implements (spec §6):**
- Consecutive two-terminal blocks on one path merge into one run, solved as 1/Σz. This avoids zero-impedance internal nodes and matches the Python, which sums them.
- `coax` and `stack` are ground-referenced 2-ports. `ideal` is a 1:n transformer to ground.
- `shunt` grounds its sub-chain's far end. `parallel` joins its arms' far ends.
- An empty shunt or an empty parallel arm throws `ChainError`.
- An open block ends its path: the rest of that path hangs off a fresh, unconnected node.
- Nodes not connected to the port are pruned.

- [ ] **Step 1: Write the failing test**

`src/chain/compile.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { ONE, OPEN, add, cx, inv } from '../engine/complex.ts';
import { embed } from '../engine/coax.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { ChainError, compile, evaluate, outOfRangeAt, zin } from './compile.ts';
import { type Block, type CapBankBlock, type Chain, type Context, param } from './types.ts';
import { assertClose } from '../testutil.ts';

const w = (f: number): number => 2 * Math.PI * f;
const cable = { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 };
const ctx = (sweeps: Record<string, Sweep> = {}): Context => ({ variant: { name: 'v', cable, Lj: 0 }, sweeps });
const cap = (id: string, pf: number): CapBankBlock => ({ id, label: id, type: 'capBank', counts: counts(), customPf: pf, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: false });
const res = (id: string, ohm: number): Block => ({ id, label: id, type: 'primitive', kind: 'R', value: param(ohm) });
const ind = (id: string, h: number): Block => ({ id, label: id, type: 'inductor', L: param(h), R: 0 });
const shunt = (id: string, chain: Block[]): Block => ({ id, label: id, type: 'shunt', chain });
const chainOf = (blocks: Block[]): Chain => ({ name: 't', blocks });

test('series C, shunt C and a series R–L load equal the closed-form L-network', () => {
  const f = 13.56e6;
  const c = chainOf([cap('cs', 80), shunt('a', [cap('cp', 180)]), shunt('b', [res('r', 2), ind('l', 290e-9)])]);
  const want = add(cx(0, -1 / (w(f) * 80e-12)), inv(add(cx(0, w(f) * 180e-12), inv(cx(2, w(f) * 290e-9)))));
  assertClose(evaluate(c, ctx(), [f])[0], want, 1e-12);
});

test('consecutive series blocks merge into one run', () => {
  const c = compile(chainOf([cap('cs', 80), ind('ls', 300e-9), shunt('a', [res('r', 5)])]), ctx());
  assert.equal(c.runs.filter((r) => r.parts.some((p) => p.blockId === 'cs')).length, 1);
  assert.deepEqual(c.runs.find((r) => r.parts.some((p) => p.blockId === 'cs'))?.parts.map((p) => p.blockId), ['cs', 'ls']);
});

test('a coax block in front equals embed of the rest', () => {
  const rest = [cap('cs', 80), shunt('a', [res('r', 5)])];
  const f = 13.56e6;
  assertClose(evaluate(chainOf([{ id: 'coax', label: 'coax', type: 'coax' }, ...rest]), ctx(), [f])[0], embed(evaluate(chainOf(rest), ctx(), [f])[0], cable, f), 1e-10);
});

test('two stacks in a parallel group, then plates, equal paralleled units', () => {
  const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };
  const c = chainOf([
    { id: 'pair', label: 'pair', type: 'parallel', chains: [[{ id: 'A', label: 'A', type: 'stack', unit: u, source: 'preset' }], [{ id: 'B', label: 'B', type: 'stack', unit: u, source: 'preset' }]] },
    shunt('pl', [{ id: 'plates', label: 'plates', type: 'plates', C: param(load.C), G_cube: param(load.G_cube), G_fix: param(load.G_fix) }]),
  ]);
  assertClose(evaluate(c, ctx(), [12e6])[0], inputImpedanceUnits([u, u], load, 12e6), 1e-10);
});

test('an empty shunt or an empty parallel arm is refused (review focus 2)', () => {
  assert.throws(() => compile(chainOf([cap('cs', 80), shunt('a', [])]), ctx()), ChainError);
  assert.throws(() => compile(chainOf([{ id: 'p', label: 'p', type: 'parallel', chains: [[res('r', 5)], []] }]), ctx()), ChainError);
});

test('an empty series bank opens the network: Z = OPEN and Γ = 1 (review focus 1)', () => {
  const z = evaluate(chainOf([cap('cs', 0), shunt('a', [res('r', 50)])]), ctx(), [13.56e6])[0];
  assertClose(z, OPEN, 0);
  assertClose(gammaFromZ(z), ONE, 0);
});

test('an open shunt changes nothing', () => {
  const f = 13.56e6;
  const withOpen = evaluate(chainOf([cap('cs', 80), shunt('o', [cap('cp', 0)]), shunt('a', [res('r', 50)])]), ctx(), [f])[0];
  const without = evaluate(chainOf([cap('cs', 80), shunt('a', [res('r', 50)])]), ctx(), [f])[0];
  assertClose(withOpen, without, 1e-12);
});

test('a port shorted to ground reads 0 Ω', () => {
  assertClose(evaluate(chainOf([shunt('s', [{ id: 'x', label: 'x', type: 'primitive', kind: 'short', value: param(0) }])]), ctx(), [1e6])[0], cx(0), 0);
});

test('a measured branch read outside its sweep clamps and is flagged (review focus 3)', () => {
  const s: Sweep = { id: 's', name: 's', f: [10e6, 15e6, 20e6], gamma: [cx(0.1, 0.2), cx(0.3, -0.1), cx(-0.2, 0.4)].map((g) => g) };
  const c = compile(chainOf([shunt('arm', [{ id: 'm', label: 'm', type: 'measuredBranch', sweepId: 's', kr: param(1), d: param(0), dLb: param(0), loop: false }])]), ctx({ s }));
  assert.equal(outOfRangeAt(c, 25e6), true);
  assert.equal(outOfRangeAt(c, 15e6), false);
  assertClose(zin(c, 25e6), zin(c, 20e6), 1e-12);
});

test('a measured branch whose sweep is not loaded is a named error', () => {
  const c = chainOf([shunt('arm', [{ id: 'm', label: 'm', type: 'measuredBranch', sweepId: 'missing', kr: param(1), d: param(0), dLb: param(0), loop: false }])]);
  assert.throws(() => compile(c, ctx()), /not loaded/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/chain/compile.test.ts`
Expected: FAIL with `Cannot find module` … `compile.ts`.

- [ ] **Step 3: Write the implementation**

`src/chain/compile.ts`:

```ts
import { type Complex, ZERO, add, inv, isFiniteC } from '../engine/complex.ts';
import { coaxY } from '../engine/coax.ts';
import { type Element, type Netlist, inputImpedance } from '../engine/mna.ts';
import { unitY } from '../engine/transformer.ts';
import type { Y2 } from '../engine/twoport.ts';
import { branchOutOfRange, buildBranchTable, twoTerminalZ } from './blockZ.ts';
import type { Block, BranchTable, Chain, Context, MeasuredBranchBlock, ZFn } from './types.ts';

export class ChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainError';
  }
}

export interface RunPart { blockId: string; z: ZFn }
/** A maximal run of series two-terminal blocks between nodes a and b, solved as one admittance 1/Σz. */
export interface Run { a: number; b: number; parts: RunPart[] }
export interface TwoPortRef { blockId: string; kind: 'coax' | 'stack'; a: number; b: number; y: (f: number) => Y2 }
export interface BranchRef { block: MeasuredBranchBlock; table: BranchTable }
export interface Compiled { net: Netlist; runs: Run[]; twoPorts: TwoPortRef[]; branches: BranchRef[] }

/** Admittance of a series run; any open part (non-finite z) makes the run carry no current. */
export function seriesY(parts: RunPart[], f: number): Complex {
  let z = ZERO;
  for (const p of parts) {
    const zp = p.z(f);
    if (!isFiniteC(zp)) return ZERO;
    z = add(z, zp);
  }
  return inv(z);
}

export function compile(chain: Chain, ctx: Context): Compiled {
  const parent: number[] = [0]; // union-find over node ids; 0 = ground and always its own root
  const alloc = (): number => {
    parent.push(parent.length);
    return parent.length - 1;
  };
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rb === 0) parent[ra] = 0;
    else parent[rb] = ra;
  };
  const cache = ctx.cache ?? new Map<string, BranchTable>();
  const tableFor = (sweepId: string): BranchTable => {
    const key = `${sweepId}|${ctx.variant.name}|${ctx.variant.cable.length}|${ctx.variant.Lj}`;
    let t = cache.get(key);
    if (!t) {
      const s = ctx.sweeps[sweepId];
      if (!s) throw new ChainError(`the measured branch needs sweep "${sweepId}", which is not loaded`);
      t = buildBranchTable(s, ctx.variant);
      cache.set(key, t);
    }
    return t;
  };
  const runs: Run[] = [];
  const twoPorts: TwoPortRef[] = [];
  const branches: BranchRef[] = [];
  const ideals: { p1: number; s1: number; n: number }[] = [];
  const cable = ctx.variant.cable;
  const port = alloc();

  const walk = (blocks: Block[], start: number): number => {
    let node = start;
    let pending: RunPart[] = [];
    let open = false;
    const flush = (): void => {
      if (open) node = alloc();
      else if (pending.length) {
        const e = alloc();
        runs.push({ a: node, b: e, parts: pending });
        node = e;
      }
      pending = [];
      open = false;
    };
    for (const b of blocks) {
      if (b.type === 'coax') {
        flush();
        const e = alloc();
        twoPorts.push({ blockId: b.id, kind: 'coax', a: node, b: e, y: (f) => coaxY(cable, f) });
        node = e;
      } else if (b.type === 'stack') {
        flush();
        const e = alloc();
        const u = b.unit;
        twoPorts.push({ blockId: b.id, kind: 'stack', a: node, b: e, y: (f) => unitY(u, f) });
        node = e;
      } else if (b.type === 'ideal') {
        flush();
        const e = alloc();
        ideals.push({ p1: node, s1: e, n: b.n });
        node = e;
      } else if (b.type === 'shunt') {
        flush();
        if (!b.chain.length) throw new ChainError(`shunt "${b.label}" is empty and would short its node to ground`);
        union(walk(b.chain, node), 0);
      } else if (b.type === 'parallel') {
        flush();
        if (!b.chains.length || b.chains.some((c) => !c.length)) throw new ChainError(`parallel group "${b.label}" has an empty arm, which would short it`);
        const ends = b.chains.map((c) => walk(c, node));
        for (const e of ends.slice(1)) union(ends[0], e);
        node = ends[0];
      } else {
        const imp = twoTerminalZ(b, tableFor);
        if (b.type === 'measuredBranch') branches.push({ block: b, table: tableFor(b.sweepId) });
        if (imp.kind === 'open') open = true;
        else if (imp.kind === 'z') pending.push({ blockId: b.id, z: imp.z });
      }
    }
    flush();
    return node;
  };
  walk(chain.blocks, port);

  // Keep only elements connected to the port (two-ports and ideal transformers also connect through ground).
  const edges: [number, number][] = [];
  for (const r of runs) edges.push([find(r.a), find(r.b)]);
  for (const t of twoPorts) edges.push([find(t.a), find(t.b)], [find(t.a), 0], [find(t.b), 0]);
  for (const i of ideals) edges.push([find(i.p1), 0], [find(i.s1), 0]);
  const reach = new Set<number>([find(port)]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [x, y] of edges) {
      if (reach.has(x) !== reach.has(y)) {
        reach.add(x);
        reach.add(y);
        grew = true;
      }
    }
  }
  const ids = new Map<number, number>([[0, 0]]);
  const idOf = (x: number): number => {
    const r = find(x);
    let k = ids.get(r);
    if (k === undefined) {
      k = ids.size;
      ids.set(r, k);
    }
    return k;
  };
  const live = (...xs: number[]): boolean => xs.every((x) => find(x) === 0 || reach.has(find(x)));
  const portId = idOf(port);
  const outRuns = runs.filter((r) => live(r.a, r.b)).map((r) => ({ ...r, a: idOf(r.a), b: idOf(r.b) }));
  const outTwo = twoPorts.filter((t) => live(t.a, t.b)).map((t) => ({ ...t, a: idOf(t.a), b: idOf(t.b) }));
  const outIdeal = ideals.filter((i) => live(i.p1, i.s1)).map((i) => ({ p1: idOf(i.p1), s1: idOf(i.s1), n: i.n }));
  const elements: Element[] = [
    ...outRuns.map((r): Element => ({ kind: 'y', a: r.a, b: r.b, y: (f) => seriesY(r.parts, f) })),
    ...outTwo.map((t): Element => ({ kind: 'y2', a: t.a, b: t.b, y: t.y })),
    ...outIdeal.map((i): Element => ({ kind: 'ideal', p1: i.p1, p2: 0, s1: i.s1, s2: 0, n: i.n })),
  ];
  return { net: { nodeCount: ids.size, port: portId, elements }, runs: outRuns, twoPorts: outTwo, branches };
}

export const zin = (c: Compiled, f: number): Complex => inputImpedance(c.net, f);

export function evaluate(chain: Chain, ctx: Context, freqs: number[]): Complex[] {
  const c = compile(chain, ctx);
  return freqs.map((f) => inputImpedance(c.net, f));
}

/** True when any measured branch is read outside its sweep's frequency range at f (spec §4). */
export const outOfRangeAt = (c: Compiled, f: number): boolean => c.branches.some((b) => branchOutOfRange(b.block, b.table, f));
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/chain/compile.test.ts && npm run typecheck`
Expected: 10 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/chain/compile.ts src/chain/compile.test.ts
git commit -m "feat(chain): compile block chains to netlists" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Sweep states, parameter references and presets

**Files:**
- Create: `src/chain/state.ts`, `src/fit/params.ts`, `src/chain/presets.ts`
- Test: `src/chain/state.test.ts`, `src/fit/params.test.ts`, `src/chain/presets.test.ts`

**Interfaces:**
- Consumes:
  - Task 9 (`counts`, `Counts`); Task 10 (types, `param`); Task 11 (`evaluate`);
  - `fixtures/python/o7_fit.json`, `cd_check.json` (Task 2); `loadFixtureSweep` (Task 8).
- Produces (`state.ts`):
  - `type StateOverrides = Record<string, Record<string, unknown>>`, `interface TaggedSweep { sweep; state; include }`
  - `mapBlocks(blocks, fn)`, `allBlocks(blocks)`, `findBlock(chain, id)`, `updateBlock(chain, id, patch)` (immutable; throws on an unknown id)
  - `applyState(chain, state)`, `duplicateIds(chain)`
- Produces (`params.ts`):
  - `type ParamKey = 'L' | 'k' | 'kr' | 'd' | 'dLb' | 'C' | 'G_cube' | 'G_fix' | 'value'`, `interface ParamRef { blockId; key }`
  - `FIT_UNIT`: fit variable = SI value / unit, so L is in nH, d in %, C in pF, G in µS
  - `getParam`, `withParamValue`, `toFitVars(chain, refs) → {x, lo, hi}`, `fromFitVars(chain, refs, x, badge = 'fit')`, `freeRefs(chain)`, `refName(ref)`
- Produces (`presets.ts`):
  - `AIT_WINDOW`, `DEFAULT_VARIANTS` (3 variants), `O7_FILES` (file names by role)
  - `o7Chain(capFreeSweepId)`, `o7State(series, shunt, loop)`, `O7_REFS` (Ls.L, Lb.L, ser.k, sh.k, branch.kr), `O7_LOOP_REF` (branch.d)
  - `CD_UNIT`, `CD_LOAD`, `cdChain()`

**Block ids in the O7 preset** (used by every later task): `coax`, `ser`, `Ls`, `shuntArm` → `sh`, `branchArm` → `Lb`, `branch`.

- [ ] **Step 1: Write the failing tests**

`src/chain/state.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { applyState, duplicateIds, findBlock, updateBlock } from './state.ts';
import { type Chain, param } from './types.ts';

const chain: Chain = { name: 't', blocks: [
  { id: 'ser', label: 'ser', type: 'capBank', counts: counts(0, 1, 1), customPf: 0, nSeries: 1, slots: 2, k: param(1), esr: 0, searchable: true },
  { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'sh', label: 'sh', type: 'capBank', counts: counts(1, 1, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true }] },
] };

test('finds nested blocks and updates them without touching the original', () => {
  const next = updateBlock(chain, 'sh', { counts: counts(2, 0, 0) });
  assert.deepEqual((findBlock(next, 'sh') as { counts: unknown }).counts, counts(2, 0, 0));
  assert.deepEqual((findBlock(chain, 'sh') as { counts: unknown }).counts, counts(1, 1, 1));
});

test('applyState applies every override; an unknown id throws', () => {
  const s = applyState(chain, { ser: { counts: counts(1, 0, 1) }, sh: { counts: counts(2, 0, 1) } });
  assert.deepEqual((findBlock(s, 'ser') as { counts: unknown }).counts, counts(1, 0, 1));
  assert.throws(() => updateBlock(chain, 'nope', {}), /no block "nope"/);
});

test('duplicate ids are reported', () => {
  assert.deepEqual(duplicateIds(chain), []);
  assert.deepEqual(duplicateIds({ ...chain, blocks: [...chain.blocks, chain.blocks[0]] }), ['ser']);
});
```

`src/fit/params.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { O7_REFS, o7Chain } from '../chain/presets.ts';
import { freeRefs, fromFitVars, getParam, toFitVars } from './params.ts';

test('fit variables use the Python recipe units and bounds', () => {
  const v = toFitVars(o7Chain('capfree'), O7_REFS);
  assert.deepEqual(v.x.map((x) => Math.round(x * 1e9) / 1e9), [300, 150, 1, 1, 1]);
  assert.deepEqual(v.lo.map((x) => Math.round(x * 1e9) / 1e9), [150, -100, 0.8, 0.8, 0.2]);
  assert.deepEqual(v.hi.map((x) => Math.round(x * 1e9) / 1e9), [700, 600, 1.5, 1.5, 3]);
});

test('fromFitVars writes SI values and marks them fitted', () => {
  const c = fromFitVars(o7Chain('capfree'), O7_REFS, [330, 92, 1.07, 1.2, 0.49]);
  const ls = getParam(c, { blockId: 'Ls', key: 'L' });
  assert.equal(ls.value, 330 * 1e-9);
  assert.equal(ls.badge, 'fit');
});

test('freeRefs lists the free parameters in chain order', () => {
  assert.deepEqual(freeRefs(o7Chain('capfree')).map((r) => `${r.blockId}.${r.key}`), ['ser.k', 'Ls.L', 'sh.k', 'Lb.L', 'branch.kr']);
});
```

`src/chain/presets.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { type Counts, counts } from '../blocks/ht50.ts';
import { fromFitVars } from '../fit/params.ts';
import { evaluate } from './compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, cdChain, o7Chain, o7State } from './presets.ts';
import { applyState, duplicateIds } from './state.ts';
import type { Context } from './types.ts';
import { assertClose, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface O7Variant { variant: string; length: number; fit2: { x: number[]; samples: { index: number; cs: number; cp: number; z: number[] }[] }; fit3: { x: number[] }; loop: { q: number; samples: { index: number; z: number[] }[] } }
const fx = readFixtureJson<{ variants: O7Variant[] }>('o7_fit.json');
const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
const PF: Record<number, Counts> = { 80: counts(0, 1, 1), 100: counts(1, 0, 0), 130: counts(1, 0, 1), 180: counts(1, 1, 1), 200: counts(2, 0, 0), 230: counts(2, 0, 1) };

test('the O7 preset has unique block ids', () => assert.deepEqual(duplicateIds(o7Chain('capfree')), []));

test('the O7 preset reproduces the o7_joint.py board impedance (fit2 parameters, 3 variants)', () => {
  fx.variants.forEach((v, i) => {
    assert.equal(DEFAULT_VARIANTS[i].cable.length, v.length);
    const ctx: Context = { variant: DEFAULT_VARIANTS[i], sweeps: { capfree: capFree } };
    const base = fromFitVars(o7Chain('capfree'), O7_REFS, v.fit2.x);
    for (const s of v.fit2.samples) {
      const c = applyState(base, o7State(PF[Math.round(s.cs * 1e12)], PF[Math.round(s.cp * 1e12)], false));
      assertClose(evaluate(c, ctx, [capFree.f[s.index]])[0], pair(s.z), 1e-9, `${v.variant} idx ${s.index}`);
    }
  });
});

test('the O7 preset reproduces the loop-state model (fit3 + frequency shift)', () => {
  fx.variants.forEach((v, i) => {
    const ctx: Context = { variant: DEFAULT_VARIANTS[i], sweeps: { capfree: capFree } };
    const c = applyState(fromFitVars(fromFitVars(o7Chain('capfree'), O7_REFS, v.fit3.x), [O7_LOOP_REF], [v.loop.q]), o7State(PF[80], PF[180], true));
    for (const s of v.loop.samples) assertClose(evaluate(c, ctx, [capFree.f[s.index]])[0], pair(s.z), 1e-9, `${v.variant} loop idx ${s.index}`);
  });
});

test('the C+D preset reproduces the Python C+D prediction', () => {
  const cd = readFixtureJson<{ f: number; pred: number[] }>('cd_check.json');
  const ctx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };
  assertClose(evaluate(cdChain(), ctx, [cd.f])[0], pair(cd.pred), 1e-9);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/chain/state.test.ts src/fit/params.test.ts src/chain/presets.test.ts`
Expected: FAIL with `Cannot find module` for `state.ts`, `params.ts` and `presets.ts`.

- [ ] **Step 3: Write the implementations**

`src/chain/state.ts`:

```ts
import type { Sweep } from '../io/sweep.ts';
import type { Block, Chain } from './types.ts';

/** Field overrides per block id, e.g. { ser: { counts: {...} }, branch: { loop: true } }. */
export type StateOverrides = Record<string, Record<string, unknown>>;

/** A loaded sweep, the circuit state it was taken in, and whether the fit uses it (spec §6). */
export interface TaggedSweep {
  sweep: Sweep;
  state: StateOverrides;
  include: boolean;
}

export function mapBlocks(blocks: Block[], fn: (b: Block) => Block): Block[] {
  return blocks.map((b) => {
    const m = fn(b);
    if (m.type === 'shunt') return { ...m, chain: mapBlocks(m.chain, fn) };
    if (m.type === 'parallel') return { ...m, chains: m.chains.map((c) => mapBlocks(c, fn)) };
    return m;
  });
}

export function allBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b) => {
    if (b.type === 'shunt') return [b, ...allBlocks(b.chain)];
    if (b.type === 'parallel') return [b, ...b.chains.flatMap(allBlocks)];
    return [b];
  });
}

export const findBlock = (chain: Chain, id: string): Block | undefined => allBlocks(chain.blocks).find((b) => b.id === id);

export function updateBlock(chain: Chain, id: string, patch: Record<string, unknown>): Chain {
  if (!findBlock(chain, id)) throw new Error(`no block "${id}" in chain "${chain.name}"`);
  return { ...chain, blocks: mapBlocks(chain.blocks, (b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) };
}

export const applyState = (chain: Chain, state: StateOverrides): Chain =>
  Object.entries(state).reduce((c, [id, patch]) => updateBlock(c, id, patch), chain);

export function duplicateIds(chain: Chain): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const b of allBlocks(chain.blocks)) {
    if (seen.has(b.id)) dup.add(b.id);
    seen.add(b.id);
  }
  return [...dup];
}
```

`src/fit/params.ts`:

```ts
import { allBlocks, findBlock, updateBlock } from '../chain/state.ts';
import type { Badge, Chain, Param } from '../chain/types.ts';

export type ParamKey = 'L' | 'k' | 'kr' | 'd' | 'dLb' | 'C' | 'G_cube' | 'G_fix' | 'value';
export interface ParamRef {
  blockId: string;
  key: ParamKey;
}

/** Fit variable = SI value / unit, so the optimiser works in nH, %, pF and µS, as the Python recipes do. */
export const FIT_UNIT: Readonly<Record<ParamKey, number>> = { L: 1e-9, k: 1, kr: 1, d: 0.01, dLb: 1e-9, C: 1e-12, G_cube: 1e-6, G_fix: 1e-6, value: 1 };
const KEYS = Object.keys(FIT_UNIT) as ParamKey[];

export function getParam(chain: Chain, ref: ParamRef): Param {
  const b = findBlock(chain, ref.blockId) as unknown as Record<string, unknown> | undefined;
  const p = b?.[ref.key] as Param | undefined;
  if (!p || typeof p.value !== 'number') throw new Error(`block "${ref.blockId}" has no parameter "${ref.key}"`);
  return p;
}

export function withParamValue(chain: Chain, ref: ParamRef, value: number, badge?: Badge): Chain {
  const p = getParam(chain, ref);
  return updateBlock(chain, ref.blockId, { [ref.key]: { ...p, value, badge: badge ?? p.badge } });
}

export function toFitVars(chain: Chain, refs: ParamRef[]): { x: number[]; lo: number[]; hi: number[] } {
  const ps = refs.map((r) => ({ p: getParam(chain, r), u: FIT_UNIT[r.key] }));
  return { x: ps.map(({ p, u }) => p.value / u), lo: ps.map(({ p, u }) => p.lo / u), hi: ps.map(({ p, u }) => p.hi / u) };
}

export const fromFitVars = (chain: Chain, refs: ParamRef[], x: number[], badge: Badge = 'fit'): Chain =>
  refs.reduce((c, r, i) => withParamValue(c, r, x[i] * FIT_UNIT[r.key], badge), chain);

/** Every parameter marked free, in chain order. */
export function freeRefs(chain: Chain): ParamRef[] {
  return allBlocks(chain.blocks).flatMap((b) => {
    const rec = b as unknown as Record<string, unknown>;
    return KEYS.filter((k) => (rec[k] as Param | undefined)?.free === true).map((k) => ({ blockId: b.id, key: k }));
  });
}

export const refName = (r: ParamRef): string => `${r.blockId}.${r.key}`;
```

`src/chain/presets.ts`:

```ts
import { type Counts, counts } from '../blocks/ht50.ts';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import type { ParamRef } from '../fit/params.ts';
import type { StateOverrides } from './state.ts';
import { type Chain, type Variant, type Window, param } from './types.ts';

/** AIT good window at the AIT-out plane (o7_joint.py WIN; the envelope of C+D's good states, not an AIT reach limit). */
export const AIT_WINDOW: Window = { rLo: 5, rHi: 17, xLo: 6, xHi: 48 };

/** Cable / jumper pairs the shorted-jumper sweeps cannot separate (SWEEP_NOTES.md L142, L353, L408). */
export const DEFAULT_VARIANTS: Variant[] = [
  { name: '1.245 m + 342 nH', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 342e-9 },
  { name: '1.2825 m + 329 nH', cable: { length: 1.2825, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 329e-9 },
  { name: '1.5094 m + 256 nH', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 256e-9, flag: 'poor fit to the shorted-jumper sweep' },
];

/** The 2026-10-13 sweeps in fixtures/sweeps, by role. */
export const O7_FILES = {
  capFree: 'noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_nanovna-sweep-1791927664566.s1p',
  s130_230: 'noAIT_130ser_230sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791930836256.s1p',
  s100_200: 'noAIT_100ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931275980.s1p',
  s80_200: 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p',
  s80_200_loop: 'noAIT_sense-loop_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791932761517.s1p',
  s80_180_loop: 'noAIT_sense-loop_80ser_180sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791933400391.s1p',
  shortNew: 'coax-jumpers-shorted_for_both_trans_nanovna-sweep-1791928236499.s1p',
  shortOld: 'coax-jumpers-shorted_nanovna-sweep-1791923630763.s1p',
  cdNet: '2026-10-01_NET_218_CD_100s_3x100+30p_10-18M_PRE-loop_nanovna-sweep-1790884838445.s1p',
} as const;

/** O7 parallel 3:15 as built 2026-10-14, measured-branch mode, with o7_joint.py's starting values and bounds (spec §5). */
export function o7Chain(capFreeSweepId: string): Chain {
  return {
    name: 'O7 parallel 3:15',
    blocks: [
      { id: 'coax', label: 'Cage coax', type: 'coax' },
      { id: 'ser', label: 'Series bank', type: 'capBank', counts: counts(0, 1, 1), customPf: 0, nSeries: 1, slots: 2, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true },
      { id: 'Ls', label: 'Series path L', type: 'inductor', L: param(300e-9, 'typed', true, 150e-9, 700e-9), R: 0 },
      { id: 'shuntArm', label: 'Shunt bank arm', type: 'shunt', chain: [
        { id: 'sh', label: 'Shunt bank', type: 'capBank', counts: counts(1, 1, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true },
      ] },
      { id: 'branchArm', label: 'Transformer arm', type: 'shunt', chain: [
        { id: 'Lb', label: 'Branch (shunt-loop) L', type: 'inductor', L: param(150e-9, 'typed', true, -100e-9, 600e-9), R: 0 },
        { id: 'branch', label: 'O7 pair (cap-free sweep)', type: 'measuredBranch', sweepId: capFreeSweepId,
          kr: param(1, 'typed', true, 0.2, 3), d: param(0, 'typed', false, -2, 4), dLb: param(0, 'typed', false, -200e-9, 400e-9), loop: true },
      ] },
    ],
  };
}

/** Sweep state for the O7 chain: series and shunt bank counts and whether the sense loop was on. */
export const o7State = (series: Counts, shunt: Counts, loop: boolean): StateOverrides => ({ ser: { counts: series }, sh: { counts: shunt }, branch: { loop } });

/** The stage-2 parameters of o7_joint.py in its order: Ls [nH], Lb [nH], Cs scale, Cp scale, branch-R scale. */
export const O7_REFS: ParamRef[] = [{ blockId: 'Ls', key: 'L' }, { blockId: 'Lb', key: 'L' }, { blockId: 'ser', key: 'k' }, { blockId: 'sh', key: 'k' }, { blockId: 'branch', key: 'kr' }];
/** The loop-state frequency shift of o7_loopstate.py [%]. */
export const O7_LOOP_REF: ParamRef = { blockId: 'branch', key: 'd' };

/** C+D 2:18 2-core T-model fitted to the 2026-09-30 cap-free sweep (model/builds_fit.json "CD_0930_load|0.0|0.0"). */
export const CD_UNIT: Unit = { n: 9, L_leak: 1.113208956146486e-6, f_pri: 0, L_m: 7.150601144264478e-7, G_core: 1.0715862049721974e-5, R1: 0.49175792144172387, R2: 17.071024987191276, C_w: 0, N_p: 2, N_c: 2 };
export const CD_LOAD: PlateLoad = { C: 2.870361730622903e-12, G_cube: 0, G_fix: 1.3245605682437853e-6 };

/** C+D in T-model mode as run on 2026-10-01: series 100 pF, shunt 3 × 100 + 30 pF, no fitted board inductance. */
export function cdChain(): Chain {
  return {
    name: 'C+D 2:18 2-core',
    blocks: [
      { id: 'coax', label: 'Cage coax', type: 'coax' },
      { id: 'ser', label: 'Series bank', type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 2, k: param(1), esr: 0, searchable: true },
      { id: 'Ls', label: 'Series path L', type: 'inductor', L: param(0), R: 0 },
      { id: 'shuntArm', label: 'Shunt bank arm', type: 'shunt', chain: [
        { id: 'sh', label: 'Shunt bank', type: 'capBank', counts: counts(3, 0, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true },
      ] },
      { id: 'Lb', label: 'Branch L', type: 'inductor', L: param(0), R: 0 },
      { id: 'stack', label: 'C+D stack', type: 'stack', unit: CD_UNIT, source: 'fit' },
      { id: 'platesArm', label: 'Plates arm', type: 'shunt', chain: [
        { id: 'plates', label: 'Plates + cube', type: 'plates', C: param(CD_LOAD.C, 'fit'), G_cube: param(CD_LOAD.G_cube, 'fit'), G_fix: param(CD_LOAD.G_fix, 'fit') },
      ] },
    ],
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/chain/state.test.ts src/fit/params.test.ts src/chain/presets.test.ts && npm run typecheck`
Expected: 10 tests pass; no type errors.

If the O7 preset test fails, compare the failing sample against the Python `make_zin` in `tools/capture_fixtures.py`: block order, which parameter scales what, and `d = q·0.01`. The model must match exactly.

- [ ] **Step 5: Commit**

```bash
git add src/chain/state.ts src/chain/state.test.ts src/fit/params.ts src/fit/params.test.ts src/chain/presets.ts src/chain/presets.test.ts
git commit -m "feat(chain): add sweep states, parameter refs and the O7 and C+D presets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Bounded Levenberg–Marquardt and parameter statistics

**Files:**
- Create: `src/fit/lm.ts`
- Modify: `src/testutil.ts` (add `mulberry32`, `gauss`)
- Test: `src/fit/lm.test.ts`

**Interfaces:**
- Consumes: `solveReal`, `SingularMatrixError` (Task 3).
- Produces:
  - `type Residual = (x: number[]) => number[]`
  - `interface LmOptions { lo?; hi?; maxIter?; ftol?; xtol?; relStep? }`
  - `interface LmResult { x; cost; residual; jac; iterations; converged }`, where cost = ½Σr², scipy's convention
  - `jacobian(res, x, lo, hi, relStep?, r0?)`
  - `levenbergMarquardt(res, x0, opt?)`
  - `interface ParamStats { stderr; corr }`, `paramStats(jac, residual)`
  - `illDetermined(corr, limit = 0.95): [number, number][]`
  - `src/testutil.ts`: `mulberry32(seed): () => number`, `gauss(rnd): number`

- [ ] **Step 1: Write the failing test**

Append to `src/testutil.ts`:

```ts
/** Deterministic uniform [0, 1) generator for reproducible synthetic noise. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample by Box–Muller. */
export const gauss = (rnd: () => number): number => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
```

`src/fit/lm.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { illDetermined, levenbergMarquardt, paramStats } from './lm.ts';
import { assertNear } from '../testutil.ts';

test('Rosenbrock least squares converges to (1, 1)', () => {
  const r = levenbergMarquardt((x) => [10 * (x[1] - x[0] ** 2), 1 - x[0]], [-1.2, 1]);
  assertNear(r.x[0], 1, 1e-6);
  assertNear(r.x[1], 1, 1e-6);
  assert.ok(r.cost < 1e-14);
});

test('box bounds are respected', () => {
  const r = levenbergMarquardt((x) => [x[0] - 5, x[1] + 2], [0, 0], { lo: [-10, -1], hi: [3, 10] });
  assertNear(r.x[0], 3, 1e-12);
  assertNear(r.x[1], -1, 1e-12);
});

test('recovers an exponential decay exactly', () => {
  const t = Array.from({ length: 40 }, (_, i) => i * 0.1);
  const y = t.map((v) => 2.5 * Math.exp(-1.3 * v));
  const r = levenbergMarquardt((x) => t.map((v, i) => x[0] * Math.exp(-x[1] * v) - y[i]), [1, 0.5]);
  assertNear(r.x[0], 2.5, 1e-7);
  assertNear(r.x[1], 1.3, 1e-7);
});

test('perfectly correlated parameters are flagged ill-determined', () => {
  const t = [0, 1, 2, 3];
  const r = levenbergMarquardt((x) => t.map(() => x[0] + x[1] - 1), [0.2, 0.3]);
  assert.deepEqual(illDetermined(paramStats(r.jac, r.residual).corr), [[0, 1]]);
});

test('standard errors of a straight-line fit match the textbook formula', () => {
  const t = [0, 1, 2, 3, 4];
  const y = [1.1, 2.9, 5.2, 6.8, 9.1];
  const r = levenbergMarquardt((x) => t.map((v, i) => x[0] + x[1] * v - y[i]), [0, 0]);
  const s = paramStats(r.jac, r.residual);
  const sxx = t.reduce((a, v) => a + (v - 2) ** 2, 0);
  const s2 = r.residual.reduce((a, v) => a + v * v, 0) / (t.length - 2);
  assertNear(s.stderr[1], Math.sqrt(s2 / sxx), 1e-6);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test src/fit/lm.test.ts`
Expected: FAIL with `Cannot find module` … `lm.ts`.

- [ ] **Step 3: Write the implementation**

`src/fit/lm.ts`:

```ts
import { SingularMatrixError, solveReal } from '../engine/linsolve.ts';

export type Residual = (x: number[]) => number[];

export interface LmOptions {
  lo?: number[];
  hi?: number[];
  maxIter?: number;
  ftol?: number;
  xtol?: number;
  relStep?: number;
}

export interface LmResult {
  x: number[];
  cost: number;
  residual: number[];
  jac: number[][];
  iterations: number;
  converged: boolean;
}

const clamp = (x: number[], lo: number[], hi: number[]): number[] => x.map((v, i) => Math.min(hi[i], Math.max(lo[i], v)));
const half2 = (r: number[]): number => 0.5 * r.reduce((a, v) => a + v * v, 0);
const normal = (J: number[][], n: number): number[][] =>
  Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => J.reduce((s, row) => s + row[a] * row[b], 0)));

/** Central-difference Jacobian (one-sided at a bound), m × n. */
export function jacobian(res: Residual, x: number[], lo: number[], hi: number[], relStep = 1e-6, r0?: number[]): number[][] {
  const base = r0 ?? res(x);
  const cols = x.map((xi, j) => {
    const h = relStep * Math.max(Math.abs(xi), 1);
    const up = Math.min(hi[j], xi + h);
    const dn = Math.max(lo[j], xi - h);
    const span = up - dn;
    if (span === 0) return base.map(() => 0);
    const xu = x.slice();
    xu[j] = up;
    const xd = x.slice();
    xd[j] = dn;
    const ru = up === xi ? base : res(xu);
    const rd = dn === xi ? base : res(xd);
    return ru.map((v, i) => (v - rd[i]) / span);
  });
  return base.map((_, i) => cols.map((c) => c[i]));
}

/** Projected Levenberg–Marquardt: minimises ½Σr² inside the box [lo, hi]. */
export function levenbergMarquardt(res: Residual, x0: number[], opt: LmOptions = {}): LmResult {
  const n = x0.length;
  const lo = opt.lo ?? x0.map(() => -Infinity);
  const hi = opt.hi ?? x0.map(() => Infinity);
  const maxIter = opt.maxIter ?? 200;
  const ftol = opt.ftol ?? 1e-12;
  const xtol = opt.xtol ?? 1e-10;
  const relStep = opt.relStep ?? 1e-6;
  let x = clamp(x0, lo, hi);
  let r = res(x);
  let cost = half2(r);
  let J = jacobian(res, x, lo, hi, relStep, r);
  let lambda = 1e-3;
  let converged = false;
  let it = 0;
  for (; it < maxIter && !converged; it += 1) {
    const A = normal(J, n);
    const g = Array.from({ length: n }, (_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
    const dmax = Math.max(...A.map((row, i) => row[i]), 1e-300);
    let accepted = false;
    for (let tries = 0; tries < 12 && !accepted; tries += 1) {
      const M = A.map((row, i) => row.map((v, j) => (i === j ? v + lambda * Math.max(v, 1e-12 * dmax) : v)));
      let step: number[];
      try {
        step = solveReal(M, g.map((v) => -v));
      } catch (e) {
        if (e instanceof SingularMatrixError) {
          lambda *= 10;
          continue;
        }
        throw e;
      }
      const xn = clamp(x.map((v, i) => v + step[i]), lo, hi);
      const rn = res(xn);
      const cn = half2(rn);
      if (Number.isFinite(cn) && cn < cost) {
        const dx = Math.hypot(...xn.map((v, i) => v - x[i]));
        converged = cost - cn <= ftol * cost || dx <= xtol * (Math.hypot(...x) + xtol);
        x = xn;
        r = rn;
        cost = cn;
        lambda = Math.max(lambda / 3, 1e-15);
        accepted = true;
      } else {
        lambda *= 4;
      }
    }
    if (!accepted) {
      converged = true; // no step improves the cost: at a (bounded) minimum
      break;
    }
    J = jacobian(res, x, lo, hi, relStep, r);
  }
  return { x, cost, residual: r, jac: J, iterations: it, converged };
}

export interface ParamStats {
  stderr: number[];
  corr: number[][];
}

/** Approximate standard errors and correlations from s²(JᵀJ)⁻¹ with s² = Σr²/(m − n). */
export function paramStats(J: number[][], residual: number[]): ParamStats {
  const m = residual.length;
  const n = J[0]?.length ?? 0;
  const A = normal(J, n);
  const s2 = residual.reduce((s, v) => s + v * v, 0) / Math.max(m - n, 1);
  let cov: number[][];
  try {
    cov = Array.from({ length: n }, (_, j) => solveReal(A, A.map((_, i) => (i === j ? 1 : 0)))); // columns of A⁻¹; A is symmetric
  } catch (e) {
    if (!(e instanceof SingularMatrixError)) throw e;
    return { stderr: Array(n).fill(Infinity), corr: A.map((row, i) => row.map((_, j) => (i === j ? 1 : Number.NaN))) };
  }
  const stderr = cov.map((row, i) => Math.sqrt(Math.max(row[i] * s2, 0)));
  const corr = cov.map((row, i) => row.map((v, j) => v / Math.sqrt(cov[i][i] * cov[j][j])));
  return { stderr, corr };
}

/** Parameter pairs with |correlation| > limit or an undefined correlation (spec §7: limit 0.95). */
export function illDetermined(corr: number[][], limit = 0.95): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < corr.length; i += 1) {
    for (let j = i + 1; j < corr.length; j += 1) {
      const c = corr[i][j];
      if (!Number.isFinite(c) || Math.abs(c) > limit) out.push([i, j]);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/fit/lm.test.ts && npm run typecheck`
Expected: 5 tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/fit/lm.ts src/fit/lm.test.ts src/testutil.ts
git commit -m "feat(fit): add bounded Levenberg-Marquardt and parameter statistics" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Network fit (stage 2 and loop shift) with real-data parity

**Files:**
- Create: `src/fit/network.ts`
- Test: `src/fit/network.test.ts`, `src/fit/o7.parity.test.ts`

**Interfaces:**
- Consumes:
  - Task 11 (`compile`, `evaluate`), Task 12 (`applyState`, `TaggedSweep`, `fromFitVars`, `toFitVars`, `refName`, presets), Task 13 (`levenbergMarquardt`, `paramStats`, `illDetermined`);
  - Task 8 (`bandIndices`, `gammaFromZ`); `fixtures/python/o7_fit.json`.
- Produces:
  - `FIT_BAND = [12.0e6, 14.6e6]`
  - `interface NetworkFitInput { chain; refs; sweeps: TaggedSweep[]; variant; allSweeps; band?; x0?; maxIter? }`
  - `interface NetworkFit { chain; x; cost; rms; rmsPerSweep; stderr; illDetermined: [string, string][]; converged; iterations }`
  - `networkResidual(input): (x) => number[]`: per included sweep, the real parts then the imaginary parts of Γ_model − Γ_meas over the band
  - `fitNetwork(input): NetworkFit`: rms = √(mean |ΔΓ|²), the `o7_joint.py` definition

- [ ] **Step 1: Write the failing unit tests**

`src/fit/network.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { counts } from '../blocks/ht50.ts';
import { evaluate } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { type StateOverrides, type TaggedSweep, applyState } from '../chain/state.ts';
import type { Context } from '../chain/types.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { fitNetwork, networkResidual } from './network.ts';
import { fromFitVars } from './params.ts';
import { assertNear, gauss, loadFixtureSweep, mulberry32 } from '../testutil.ts';

const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
const variant = DEFAULT_VARIANTS[0];
const all = { capfree: capFree };
const ctx: Context = { variant, sweeps: all };
const truth = [330, 92, 1.07, 1.2, 0.49];
const st130 = o7State(counts(1, 0, 1), counts(2, 0, 1), false);
const st100 = o7State(counts(1, 0, 0), counts(2, 0, 0), false);

function synth(id: string, state: StateOverrides, f: number[], noise = 0, seed = 1): Sweep {
  const rnd = mulberry32(seed);
  const z = evaluate(applyState(fromFitVars(o7Chain('capfree'), O7_REFS, truth), state), ctx, f);
  return { id, name: id, f, gamma: z.map((zz) => { const g = gammaFromZ(zz); return cx(g.re + noise * gauss(rnd), g.im + noise * gauss(rnd)); }) };
}
const tag = (sweep: Sweep, state: StateOverrides, include = true): TaggedSweep => ({ sweep, state, include });

test('recovers known parameters from noise-free synthetic sweeps', () => {
  const fit = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all,
    sweeps: [tag(synth('a', st130, capFree.f), st130), tag(synth('b', st100, capFree.f), st100)] });
  fit.x.forEach((v, i) => assertNear(v, truth[i], 1e-4, `param ${i}`));
  assert.ok(fit.rms < 1e-8, `rms ${fit.rms}`);
});

test('noisy synthetic sweeps (|ΔΓ| rms 0.01): every parameter within 3 standard errors', () => {
  const sigma = 0.01 / Math.SQRT2;
  const fit = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all,
    sweeps: [tag(synth('a', st130, capFree.f, sigma, 7), st130), tag(synth('b', st100, capFree.f, sigma, 11), st100)] });
  // If this fails with these seeds, report the z-scores; do not change the seeds to make it pass.
  fit.x.forEach((v, i) => assert.ok(Math.abs(v - truth[i]) <= 3 * fit.stderr[i], `param ${i}: ${v} vs ${truth[i]} ± ${fit.stderr[i]}`));
});

test('a sweep on a different grid is interpolated, not index-matched (review focus 4)', () => {
  const half = capFree.f.slice(0, -1).map((f, i) => (f + capFree.f[i + 1]) / 2);
  const res = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(synth('h', st130, half), st130)] });
  assert.ok(Math.max(...res(truth).map(Math.abs)) < 1e-12);
});

test('excluded sweeps do not enter the residual', () => {
  const a = synth('a', st130, capFree.f);
  const one = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(a, st130)] });
  const two = networkResidual({ chain: o7Chain('capfree'), refs: O7_REFS, variant, allSweeps: all, sweeps: [tag(a, st130), tag(synth('b', st100, capFree.f), st100, false)] });
  assert.deepEqual(two([300, 150, 1, 1, 1]), one([300, 150, 1, 1, 1]));
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `node --experimental-strip-types --test src/fit/network.test.ts`
Expected: FAIL with `Cannot find module` … `network.ts`.

- [ ] **Step 3: Write the implementation**

`src/fit/network.ts`:

```ts
import { sub } from '../engine/complex.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile } from '../chain/compile.ts';
import { type TaggedSweep, applyState } from '../chain/state.ts';
import type { BranchTable, Chain, Context, Variant } from '../chain/types.ts';
import { type Sweep, bandIndices, gammaFromZ } from '../io/sweep.ts';
import { illDetermined, levenbergMarquardt, paramStats } from './lm.ts';
import { type ParamRef, fromFitVars, refName, toFitVars } from './params.ts';

/** Fit band of o7_joint.py: 12.0 < f < 14.6 MHz. */
export const FIT_BAND: [number, number] = [12.0e6, 14.6e6];

export interface NetworkFitInput {
  chain: Chain;
  refs: ParamRef[];
  sweeps: TaggedSweep[];
  variant: Variant;
  allSweeps: Record<string, Sweep>;
  band?: [number, number];
  x0?: number[];
  maxIter?: number;
}

export interface NetworkFit {
  chain: Chain;
  x: number[];
  cost: number;
  rms: number;
  rmsPerSweep: number[];
  stderr: number[];
  illDetermined: [string, string][];
  converged: boolean;
  iterations: number;
}

/** Γ_model − Γ_meas over the band for every included sweep in its own state: real parts, then imaginary parts. */
export function networkResidual(input: NetworkFitInput): (x: number[]) => number[] {
  const band = input.band ?? FIT_BAND;
  const cache = new Map<string, BranchTable>();
  const used = input.sweeps.filter((s) => s.include);
  const idx = used.map((s) => bandIndices(s.sweep.f, band[0], band[1]));
  return (x) => {
    const chain = fromFitVars(input.chain, input.refs, x);
    const ctx: Context = { variant: input.variant, sweeps: input.allSweeps, cache };
    const out: number[] = [];
    used.forEach((t, k) => {
      const c = compile(applyState(chain, t.state), ctx);
      const re: number[] = [];
      const im: number[] = [];
      for (const i of idx[k]) {
        const d = sub(gammaFromZ(inputImpedance(c.net, t.sweep.f[i])), t.sweep.gamma[i]);
        re.push(d.re);
        im.push(d.im);
      }
      out.push(...re, ...im);
    });
    return out;
  };
}

/** √(mean |ΔΓ|²) over stacked real and imaginary residuals (o7_joint.py: sqrt(mean(fun²)·2)). */
const rmsOf = (r: number[]): number => Math.sqrt((2 * r.reduce((a, v) => a + v * v, 0)) / Math.max(r.length, 1));

export function fitNetwork(input: NetworkFitInput): NetworkFit {
  const res = networkResidual(input);
  const start = toFitVars(input.chain, input.refs);
  const r = levenbergMarquardt(res, input.x0 ?? start.x, { lo: start.lo, hi: start.hi, maxIter: input.maxIter ?? 200 });
  const stats = paramStats(r.jac, r.residual);
  const band = input.band ?? FIT_BAND;
  let off = 0;
  const rmsPerSweep = input.sweeps.filter((s) => s.include).map((s) => {
    const m = 2 * bandIndices(s.sweep.f, band[0], band[1]).length;
    const part = r.residual.slice(off, off + m);
    off += m;
    return rmsOf(part);
  });
  return {
    chain: fromFitVars(input.chain, input.refs, r.x, 'fit'),
    x: r.x,
    cost: r.cost,
    rms: rmsOf(r.residual),
    rmsPerSweep,
    stderr: stats.stderr,
    illDetermined: illDetermined(stats.corr).map(([a, b]): [string, string] => [refName(input.refs[a]), refName(input.refs[b])]),
    converged: r.converged,
    iterations: r.iterations,
  };
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --experimental-strip-types --test src/fit/network.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Write the real-data parity test (the spec §14 fit gate)**

`src/fit/o7.parity.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Complex } from '../engine/complex.ts';
import { type Counts, counts } from '../blocks/ht50.ts';
import { evaluate } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { type TaggedSweep, applyState } from '../chain/state.ts';
import type { Sweep } from '../io/sweep.ts';
import { fitNetwork } from './network.ts';
import { fmt, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface V { variant: string; length: number; fit2: { rms: number; pred_80_200: number[] }; loop: { pred_80_180_loop: number[] } }
const fx = readFixtureJson<{ k0: number; variants: V[] }>('o7_fit.json');
const S = {
  capfree: loadFixtureSweep('capfree', O7_FILES.capFree),
  s130: loadFixtureSweep('s130', O7_FILES.s130_230),
  s100: loadFixtureSweep('s100', O7_FILES.s100_200),
  s80: loadFixtureSweep('s80', O7_FILES.s80_200),
  s80L: loadFixtureSweep('s80L', O7_FILES.s80_200_loop),
};
const all = { capfree: S.capfree };
const tag = (sweep: Sweep, series: Counts, shunt: Counts, loop: boolean): TaggedSweep => ({ sweep, state: o7State(series, shunt, loop), include: true });
const within = (a: Complex, b: Complex, ohm: number, msg: string): void =>
  assert.ok(Math.abs(a.re - b.re) <= ohm && Math.abs(a.im - b.im) <= ohm, `${msg}: TypeScript ${fmt(a)} vs Python ${fmt(b)}`);

fx.variants.forEach((v, i) => {
  test(`fit parity vs o7_joint.py / o7_loopstate.py: ${v.variant} m`, () => {
    const variant = DEFAULT_VARIANTS[i];
    assert.equal(variant.cable.length, v.length);
    const f0 = [S.capfree.f[fx.k0]];
    const two = [tag(S.s130, counts(1, 0, 1), counts(2, 0, 1), false), tag(S.s100, counts(1, 0, 0), counts(2, 0, 0), false)];
    const f2 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: two, variant, allSweeps: all });
    const p80 = evaluate(applyState(f2.chain, o7State(counts(0, 1, 1), counts(2, 0, 0), false)), { variant, sweeps: all }, f0)[0];
    within(p80, pair(v.fit2.pred_80_200), 0.5, '80/200 from the 2-sweep fit');
    assert.ok(Math.abs(f2.rms - v.fit2.rms) <= 0.05 * v.fit2.rms, `rms ${f2.rms} vs Python ${v.fit2.rms}`);

    const three = [...two, tag(S.s80, counts(0, 1, 1), counts(2, 0, 0), false)];
    const f3 = fitNetwork({ chain: o7Chain('capfree'), refs: O7_REFS, sweeps: three, variant, allSweeps: all });
    const loop = fitNetwork({ chain: f3.chain, refs: [O7_LOOP_REF], sweeps: [tag(S.s80L, counts(0, 1, 1), counts(2, 0, 0), true)], variant, allSweeps: all, x0: [20] });
    const p180 = evaluate(applyState(loop.chain, o7State(counts(0, 1, 1), counts(1, 1, 1), true)), { variant, sweeps: all }, f0)[0];
    within(p180, pair(v.loop.pred_80_180_loop), 0.5, '80/180 + loop from the 3-sweep fit + loop shift');
  });
});
```

- [ ] **Step 6: Run the parity test**

Run: `node --experimental-strip-types --test src/fit/o7.parity.test.ts`
Expected: 3 tests pass. This takes up to about a minute, since each test runs three fits on 547-point bands.

If a landing misses by more than 0.5 Ω:
1. Print `f2.x` next to the fixture's `fit2.x`.
2. If they differ, the optimiser stopped in a different place. Check that `x0` and the bounds match the fixture's `x0` / `bounds` before touching anything else.
3. **Do not widen the 0.5 Ω gate.**

- [ ] **Step 7: Run everything and commit**

Run: `npm test && npm run typecheck`
Expected: all tests pass; no type errors.

```bash
git add src/fit/network.ts src/fit/network.test.ts src/fit/o7.parity.test.ts
git commit -m "feat(fit): add the stage-2 network fit with real-data parity against o7_joint.py" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Stress: drive at power, block reports, flux range

**Files:**
- Create: `src/stress/drive.ts`, `src/stress/flux.ts`
- Test: `src/stress/drive.test.ts`, `src/stress/flux.test.ts`

**Interfaces:**
- Consumes:
  - Tasks 1, 3, 5, 6, 9;
  - Task 10 (`groupPf`, `capBankFarads`); Task 11 (`compile`, `seriesY`, `Compiled`); Task 12 (`findBlock`, `mapBlocks`, presets);
  - `fixtures/python/rfchain_cases.json`, `tmodel_short.json`, `o7_fit.json`.
- Produces (`drive.ts`):
  - `class DriveError extends Error`
  - `interface Drive { f; watts; zin; iIn; v; compiled }`, `drive(chain, ctx, f, watts): Drive`
    - The port is the cage coax at the AIT output; the input current is real.
    - Throws `DriveError` when the port is open, Re(Z_in) ≤ 0, or Z_in is non-finite.
  - `interface PartStress { pf; count; vRms; iRms; pctV; pctI; pct }` (the `pct*` fields are `null` for custom values)
  - `interface BlockReport { blockId; type; v; i; powerW; vCapRms?; parts?; unit?; v2?; pCube?; pFix? }`
  - `reports(chain, d): Map<string, BlockReport>`, `maxCapStressPct(reps): number | null`
- Produces (`flux.ts`):
  - `interface FluxPoint { fPri; bPk_mT; vLoopRms }`, `interface FluxRange { blockId; points; bMin; bMax; vMin; vMax }`, `linspace(a, b, n)`
  - `fluxRangeStacks(chain, ctx, f, watts, fPriMax = 0.5, steps = 6)`
  - `branchVoltage(d, branchId)`
  - `fluxRangeBranch(d, branchId, tUnit, tLoad, fPriMax = 0.5, steps = 6)`
  - `solveFPri(loopV: (fPri) => number, measured): {fPri} | {error}`

- [ ] **Step 1: Write the failing tests**

`src/stress/drive.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Cable } from '../engine/coax.ts';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { cdChain } from '../chain/presets.ts';
import { type Block, type CapBankBlock, type Chain, type Context, type StackBlock, param } from '../chain/types.ts';
import { DriveError, drive, maxCapStressPct, reports } from './drive.ts';
import { assertClose, assertNear, pair, readFixtureJson } from '../testutil.ts';

interface Net { c_series: number; c_shunt: number; esr_series: number; esr_shunt: number; l_series: number; r_lseries: number }
interface UnitRow { i1: number[]; vm: number[]; i_r2: number[]; p_r1: number; p_core: number; p_r2: number; b_pk_mT: number; v_loop_rms: number }
interface ChainRow { z_ait: number[]; i_series: number[]; v_series_cap: number; i_shunt: number[]; v_node: number[]; i_branch: number[]; p_esr_series: number; p_esr_shunt: number; p_lseries: number; p_cable: number; v1: number[]; v2: number[]; p_cube: number; p_fix: number; units: UnitRow[] }
interface Case { name: string; units: Unit[]; load: PlateLoad; net: Net; cable: Cable; rows: { f: number; chain: ChainRow }[] }
const { cases } = readFixtureJson<{ cases: Case[] }>('rfchain_cases.json');

const custom = (id: string, pf: number, esr: number): CapBankBlock => ({ id, label: id, type: 'capBank', counts: counts(), customPf: pf, nSeries: 1, slots: 1, k: param(1), esr, searchable: false });

/** The rfchain.solve_chain topology as a chain: coax → series C → shunt C → series L → unit(s) → plates. */
function caseChain(c: Case): Chain {
  const n = c.net;
  const stacks = c.units.map((u, k): StackBlock => ({ id: `stack${k}`, label: `stack ${k}`, type: 'stack', unit: u, source: 'preset' }));
  const transformer: Block = stacks.length === 1 ? stacks[0] : { id: 'pair', label: 'pair', type: 'parallel', chains: stacks.map((s) => [s]) };
  return { name: c.name, blocks: [
    { id: 'coax', label: 'coax', type: 'coax' },
    custom('ser', n.c_series * 1e12, n.esr_series),
    { id: 'shuntArm', label: 'shunt', type: 'shunt', chain: [custom('sh', n.c_shunt * 1e12, n.esr_shunt)] },
    { id: 'lser', label: 'series L', type: 'inductor', L: param(n.l_series), R: n.r_lseries },
    transformer,
    { id: 'platesArm', label: 'plates', type: 'shunt', chain: [{ id: 'plates', label: 'plates', type: 'plates', C: param(c.load.C), G_cube: param(c.load.G_cube), G_fix: param(c.load.G_fix) }] },
  ] };
}

for (const c of cases) {
  test(`solve_chain parity at 100 W: ${c.name}`, () => {
    const chain = caseChain(c);
    const ctx: Context = { variant: { name: c.name, cable: c.cable, Lj: 0 }, sweeps: {} };
    for (const { f, chain: want } of c.rows) {
      const d = drive(chain, ctx, f, 100);
      const rep = reports(chain, d);
      const get = (id: string) => rep.get(id) ?? assert.fail(`no report for ${id}`);
      assertClose(d.zin, pair(want.z_ait), 1e-9, `z_ait @${f}`);
      assertClose(get('ser').i, pair(want.i_series), 1e-9, `i_series @${f}`);
      assertNear(get('ser').vCapRms ?? NaN, want.v_series_cap, 1e-9, `v_series_cap @${f}`);
      assertNear(get('ser').powerW, want.p_esr_series, 1e-9, `p_esr_series @${f}`);
      assertClose(get('sh').i, pair(want.i_shunt), 1e-9, `i_shunt @${f}`);
      assertClose(get('sh').v, pair(want.v_node), 1e-9, `v_node @${f}`);
      assertNear(get('sh').powerW, want.p_esr_shunt, 1e-9, `p_esr_shunt @${f}`);
      assertClose(get('lser').i, pair(want.i_branch), 1e-9, `i_branch @${f}`);
      assertNear(get('lser').powerW, want.p_lseries, 1e-9, `p_lseries @${f}`);
      assertNear(get('coax').powerW, want.p_cable, 1e-9, `p_cable @${f}`);
      assertNear(get('plates').pCube ?? NaN, want.p_cube, 1e-9, `p_cube @${f}`);
      assertNear(get('plates').pFix ?? NaN, want.p_fix, 1e-9, `p_fix @${f}`);
      c.units.forEach((_, k) => {
        const s = get(`stack${k}`);
        assertClose(s.v, pair(want.v1), 1e-9, `v1 @${f}`);
        assertClose(s.v2 ?? pair([NaN, NaN]), pair(want.v2), 1e-9, `v2 @${f}`);
        const u = s.unit ?? assert.fail('no unit state');
        const w = want.units[k];
        assertClose(u.i1, pair(w.i1), 1e-9, `i1 @${f}`);
        assertClose(u.vm, pair(w.vm), 1e-9, `vm @${f}`);
        assertClose(u.i_r2, pair(w.i_r2), 1e-9, `i_r2 @${f}`);
        for (const key of ['p_r1', 'p_core', 'p_r2', 'b_pk_mT', 'v_loop_rms'] as const) assertNear(u[key], w[key], 1e-9, `${key} @${f}`);
      });
    }
  });
}

const cdCtx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };

test('every watt is accounted for: block powers sum to the drive power', () => {
  const d = drive(cdChain(), cdCtx, 13.56e6, 100);
  const total = [...reports(cdChain(), d).values()].reduce((a, r) => a + r.powerW, 0);
  assertNear(total, 100, 1e-9);
});

test('cap parts share current by capacitance; a series pair halves the voltage per part', () => {
  const one: Chain = { name: 't', blocks: [{ id: 'b', label: 'b', type: 'capBank', counts: counts(2, 1, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0.01, searchable: false },
    { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(10) }] }] };
  const r1 = reports(one, drive(one, cdCtx, 13.56e6, 50)).get('b') ?? assert.fail('no bank');
  const [p100, p50] = r1.parts ?? [];
  assertNear(p100.iRms / p50.iRms, 2, 1e-12);
  assert.equal(p100.count, 2);
  const two: Chain = { ...one, blocks: [{ ...(one.blocks[0] as CapBankBlock), nSeries: 2 }, one.blocks[1]] };
  const r2 = reports(two, drive(two, cdCtx, 13.56e6, 50)).get('b') ?? assert.fail('no bank');
  assertNear((r2.parts ?? [])[0].vRms, (r2.vCapRms ?? NaN) / 2, 1e-12);
  assert.equal((r2.parts ?? [])[0].count, 4);
  assert.ok((maxCapStressPct(reports(one, drive(one, cdCtx, 13.56e6, 50))) ?? 0) > 0);
});

test('an open port or a lossless network is a DriveError, not NaN (review focus 5)', () => {
  const open: Chain = { name: 'o', blocks: [{ id: 'c', label: 'c', type: 'capBank', counts: counts(), customPf: 0, nSeries: 1, slots: 1, k: param(1), esr: 0, searchable: false },
    { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(50) }] }] };
  assert.throws(() => drive(open, cdCtx, 13.56e6, 100), DriveError);
  const lossless: Chain = { name: 'l', blocks: [{ id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: param(100e-12) }] }] };
  assert.throws(() => drive(lossless, cdCtx, 13.56e6, 100), DriveError);
});
```

`src/stress/flux.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_REFS, cdChain, o7Chain, o7State } from '../chain/presets.ts';
import { applyState } from '../chain/state.ts';
import type { Context } from '../chain/types.ts';
import { fromFitVars } from '../fit/params.ts';
import { drive, reports } from './drive.ts';
import { fluxRangeBranch, fluxRangeStacks, solveFPri } from './flux.ts';
import { nearestIndex } from '../io/sweep.ts';
import { assertNear, loadFixtureSweep, readFixtureJson } from '../testutil.ts';

const cdCtx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };

test('T-model flux range: 6 points from f_pri 0 to 0.5; the f_pri = 0 point equals a plain drive', () => {
  const [range] = fluxRangeStacks(cdChain(), cdCtx, 13.56e6, 100);
  assert.equal(range.points.length, 6);
  assert.equal(range.points[5].fPri, 0.5);
  const plain = reports(cdChain(), drive(cdChain(), cdCtx, 13.56e6, 100)).get('stack')?.unit;
  assertNear(range.points[0].bPk_mT, plain?.b_pk_mT ?? NaN, 1e-12);
  assert.ok(range.bMin <= range.bMax);
});

test('measured-branch flux comes from the stage-1 T-model driven by the branch voltage', () => {
  const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const fx = readFixtureJson<{ variants: { fit2: { x: number[] } }[] }>('o7_fit.json');
  const tm = readFixtureJson<{ tmodel: { unit: Unit; load: PlateLoad } }>('tmodel_short.json').tmodel;
  const chain = applyState(fromFitVars(o7Chain('capfree'), O7_REFS, fx.variants[0].fit2.x), o7State(counts(0, 1, 1), counts(1, 1, 1), false));
  const ctx: Context = { variant: DEFAULT_VARIANTS[0], sweeps: { capfree: capFree } };
  const r = fluxRangeBranch(drive(chain, ctx, capFree.f[nearestIndex(capFree.f, 13.56e6)], 100), 'branch', tm.unit, tm.load);
  assert.equal(r.points.length, 6);
  assert.ok(r.points.every((p) => Number.isFinite(p.bPk_mT) && p.bPk_mT > 0));
});

test('solveFPri inverts a monotone loop-voltage curve and reports an unreachable reading', () => {
  const r = solveFPri((x) => 10 - 4 * x, 8.6);
  assert.ok('fPri' in r && Math.abs(r.fPri - 0.35) < 1e-9);
  const bad = solveFPri((x) => 10 - 4 * x, 20);
  assert.ok('error' in bad && /model structure/.test(bad.error));
});

test('solveFPri on the real C+D path returns a split that reproduces the reading', () => {
  const loopAt = (fp: number): number => fluxRangeStacks(cdChain(), cdCtx, 13.56e6, 100, fp, 2)[0].points[1].vLoopRms;
  const target = loopAt(0.33);
  const r = solveFPri(loopAt, target);
  assert.ok('fPri' in r, JSON.stringify(r));
  if ('fPri' in r) assertNear(loopAt(r.fPri), target, 1e-6);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/stress/drive.test.ts src/stress/flux.test.ts`
Expected: FAIL with `Cannot find module` for `drive.ts` and `flux.ts`.

- [ ] **Step 3: Write the implementations**

`src/stress/drive.ts`:

```ts
import { type Complex, abs, add, conj, isFiniteC, mul, scale, sub } from '../engine/complex.ts';
import { SingularMatrixError } from '../engine/linsolve.ts';
import { solveNetlist } from '../engine/mna.ts';
import { type UnitState, unitState } from '../engine/transformer.ts';
import { type CapValue, CAP_VALUES, HT50 } from '../blocks/ht50.ts';
import { capBankFarads, groupPf } from '../chain/blockZ.ts';
import { type Compiled, compile, seriesY } from '../chain/compile.ts';
import { findBlock } from '../chain/state.ts';
import type { Block, Chain, Context } from '../chain/types.ts';

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

/** Node voltages scaled so that `watts` enters the port (the cage coax at the AIT output); input current real. */
export interface Drive {
  f: number;
  watts: number;
  zin: Complex;
  iIn: number;
  v: Complex[];
  compiled: Compiled;
}

export function drive(chain: Chain, ctx: Context, f: number, watts: number): Drive {
  const compiled = compile(chain, ctx);
  let v: Complex[];
  try {
    v = solveNetlist(compiled.net, f).v;
  } catch (e) {
    if (e instanceof SingularMatrixError) throw new DriveError('the network is open at the port, so no power can enter');
    throw e;
  }
  const zin = v[compiled.net.port];
  if (!isFiniteC(zin) || !(zin.re > 0)) {
    throw new DriveError(`Re(Z_in) = ${zin.re.toFixed(3)} Ω at ${(f / 1e6).toFixed(4)} MHz, so no real power can enter`);
  }
  const k = Math.sqrt(watts / zin.re);
  return { f, watts, zin, iIn: k, v: v.map((x) => scale(x, k)), compiled };
}

export interface PartStress {
  pf: number;
  count: number;
  vRms: number;
  iRms: number;
  pctV: number | null;
  pctI: number | null;
  pct: number | null;
}

export interface BlockReport {
  blockId: string;
  type: Block['type'];
  /** Voltage across the block (two-terminal) or at its port-1 node (two-port). */
  v: Complex;
  /** Current through the block (two-terminal) or into port 1 (two-port). */
  i: Complex;
  /** Real power absorbed by the block. */
  powerW: number;
  vCapRms?: number;
  parts?: PartStress[];
  unit?: UnitState;
  v2?: Complex;
  pCube?: number;
  pFix?: number;
}

function partStress(pf: number, count: number, vRms: number, iRms: number, rated: boolean): PartStress {
  if (!rated) return { pf, count, vRms, iRms, pctV: null, pctI: null, pct: null };
  const r = HT50[pf as CapValue];
  const pctV = (100 * vRms) / r.vRms;
  const pctI = (100 * iRms) / r.iRms;
  return { pf, count, vRms, iRms, pctV, pctI, pct: Math.max(pctV, pctI) };
}

/** Voltage, current and power for every block that carries current in the drive (spec §10). */
export function reports(chain: Chain, d: Drive): Map<string, BlockReport> {
  const out = new Map<string, BlockReport>();
  const { f, v, compiled } = d;
  const w = 2 * Math.PI * f;
  for (const run of compiled.runs) {
    const i = mul(sub(v[run.a], v[run.b]), seriesY(run.parts, f));
    for (const p of run.parts) {
      const vb = mul(i, p.z(f));
      const block = findBlock(chain, p.blockId) as Block;
      const r: BlockReport = { blockId: p.blockId, type: block.type, v: vb, i, powerW: mul(vb, conj(i)).re };
      if (block.type === 'capBank') {
        const gpf = groupPf(block);
        const iA = abs(i);
        r.vCapRms = iA / (w * capBankFarads(block));
        const vPart = iA / (w * gpf * 1e-12 * block.k.value); // voltage across one parallel group
        r.parts = [
          ...CAP_VALUES.filter((c) => block.counts[c] > 0).map((c) => partStress(c, block.counts[c] * block.nSeries, vPart, (iA * c) / gpf, true)),
          ...(block.customPf > 0 ? [partStress(block.customPf, block.nSeries, vPart, (iA * block.customPf) / gpf, false)] : []),
        ];
      }
      if (block.type === 'plates') {
        const va = abs(vb);
        r.pCube = va ** 2 * block.G_cube.value;
        r.pFix = va ** 2 * block.G_fix.value;
      }
      out.set(p.blockId, r);
    }
  }
  for (const t of compiled.twoPorts) {
    const y = t.y(f);
    const va = v[t.a];
    const vb = v[t.b];
    const ia = add(mul(y[0], va), mul(y[1], vb));
    const ib = add(mul(y[2], va), mul(y[3], vb));
    const block = findBlock(chain, t.blockId) as Block;
    const r: BlockReport = { blockId: t.blockId, type: block.type, v: va, i: ia, v2: vb, powerW: mul(va, conj(ia)).re + mul(vb, conj(ib)).re };
    if (block.type === 'stack') r.unit = unitState(block.unit, y, f, va, vb);
    out.set(t.blockId, r);
  }
  return out;
}

/** Highest % of rating over every rated cap part, or null when no rated part carries current. */
export function maxCapStressPct(reps: Map<string, BlockReport>): number | null {
  let m: number | null = null;
  for (const r of reps.values()) for (const p of r.parts ?? []) if (p.pct !== null) m = m === null ? p.pct : Math.max(m, p.pct);
  return m;
}
```

`src/stress/flux.ts`:

```ts
import { type Complex, mul, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, solveTransformer } from '../engine/transformer.ts';
import { seriesY } from '../chain/compile.ts';
import { mapBlocks } from '../chain/state.ts';
import type { Chain, Context } from '../chain/types.ts';
import { type Drive, drive, reports } from './drive.ts';

export interface FluxPoint { fPri: number; bPk_mT: number; vLoopRms: number }
export interface FluxRange { blockId: string; points: FluxPoint[]; bMin: number; bMax: number; vMin: number; vMax: number }

export const linspace = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

function summarize(blockId: string, points: FluxPoint[]): FluxRange {
  const b = points.map((p) => p.bPk_mT);
  const v = points.map((p) => p.vLoopRms);
  return { blockId, points, bMin: Math.min(...b), bMax: Math.max(...b), vMin: Math.min(...v), vMax: Math.max(...v) };
}

/** T-model mode: re-drive at each leakage split f_pri in [0, fPriMax] (all stacks together) and read each stack (spec §10). */
export function fluxRangeStacks(chain: Chain, ctx: Context, f: number, watts: number, fPriMax = 0.5, steps = 6): FluxRange[] {
  const per = new Map<string, FluxPoint[]>();
  for (const fp of linspace(0, fPriMax, steps)) {
    const c: Chain = { ...chain, blocks: mapBlocks(chain.blocks, (b) => (b.type === 'stack' ? { ...b, unit: { ...b.unit, f_pri: fp } } : b)) };
    for (const r of reports(c, drive(c, ctx, f, watts)).values()) {
      if (!r.unit) continue;
      const list = per.get(r.blockId) ?? [];
      list.push({ fPri: fp, bPk_mT: r.unit.b_pk_mT, vLoopRms: r.unit.v_loop_rms });
      per.set(r.blockId, list);
    }
  }
  return [...per.entries()].map(([id, pts]) => summarize(id, pts));
}

/** Voltage across a measured branch block in a drive. */
export function branchVoltage(d: Drive, branchId: string): Complex {
  const run = d.compiled.runs.find((r) => r.parts.some((p) => p.blockId === branchId));
  if (!run) throw new Error(`measured branch "${branchId}" carries no current in this drive`);
  const i = mul(sub(d.v[run.a], d.v[run.b]), seriesY(run.parts, d.f));
  const part = run.parts.find((p) => p.blockId === branchId);
  if (!part) throw new Error(`measured branch "${branchId}" is not in its run`);
  return mul(i, part.z(d.f));
}

/** Measured-branch mode: the stage-1 T-model of the same cap-free sweep driven with the branch voltage (spec §10). */
export function fluxRangeBranch(d: Drive, branchId: string, tUnit: Unit, tLoad: PlateLoad, fPriMax = 0.5, steps = 6): FluxRange {
  const v1 = branchVoltage(d, branchId);
  const points = linspace(0, fPriMax, steps).map((fp) => {
    const s = solveTransformer([{ ...tUnit, f_pri: fp }], tLoad, d.f, v1).units[0];
    return { fPri: fp, bPk_mT: s.b_pk_mT, vLoopRms: s.v_loop_rms };
  });
  return summarize(branchId, points);
}

/** Leakage split that reproduces a measured loop voltage: scan [0, 1] in 20 steps, then bisect the first bracket. */
export function solveFPri(loopV: (fPri: number) => number, measured: number): { fPri: number } | { error: string } {
  const xs = linspace(0, 1, 21);
  const g = xs.map((x) => loopV(x) - measured);
  const exact = g.findIndex((v) => v === 0);
  if (exact >= 0) return { fPri: xs[exact] };
  for (let k = 0; k + 1 < xs.length; k += 1) {
    if (g[k] * g[k + 1] < 0) {
      let a = xs[k];
      let b = xs[k + 1];
      let ga = g[k];
      for (let it = 0; it < 60; it += 1) {
        const m = (a + b) / 2;
        const gm = loopV(m) - measured;
        if (gm === 0) return { fPri: m };
        if (ga * gm < 0) b = m;
        else {
          a = m;
          ga = gm;
        }
      }
      return { fPri: (a + b) / 2 };
    }
  }
  return { error: `no leakage split in [0, 1] gives ${measured} V on the loop; the model structure, not the split, is off` };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/stress/drive.test.ts src/stress/flux.test.ts && npm run typecheck`
Expected: 15 tests pass (12 parity cases + 3 drive tests, then 4 flux tests). No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/stress
git commit -m "feat(stress): drive at power with per-part HT50 stress, solve_chain parity and flux range" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 16: Stage-1 T-model fit and stage-0 shorted-jumper fit

**Files:**
- Create: `src/fit/tmodel.ts`, `src/fit/short.ts`
- Test: `src/fit/tmodel.test.ts`, `src/fit/short.test.ts`

**Interfaces:**
- Consumes:
  - `unitInputZ`, `Unit`, `PlateLoad` (Task 5); `deembed`, `Cable` (Task 4);
  - `levenbergMarquardt` (Task 13); `buildBranchTable` (Task 10); `Sweep`, `zFromGamma`, `nearestIndex` (Task 8);
  - `fixtures/python/tmodel_short.json`.
- Produces:
  - `interface TModelOptions { n; fPri; nP; nC; k1?; fLo?; fHi? }`, `interface TModelFit { unit; load; rmsRel; cost; nRes }`
  - `TMODEL_STARTS` (the 8 starts of `calib.fit_one_port`), `fitTModel(f, z, opts): TModelFit`
  - `interface ShortOptions { length; fitLength; vf?; z0?; band? }`, `interface ShortFit { length; L; rms }`
  - `fitShort(sweep, opts)`, `variantFromShort(name, fit, vf?)`

- [ ] **Step 1: Write the failing tests**

`src/fit/tmodel.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { abs, cx, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, unitInputZ } from '../engine/transformer.ts';
import { buildBranchTable } from '../chain/blockZ.ts';
import { DEFAULT_VARIANTS, O7_FILES } from '../chain/presets.ts';
import { nearestIndex } from '../io/sweep.ts';
import { fitTModel } from './tmodel.ts';
import { loadFixtureSweep, readFixtureJson } from '../testutil.ts';

const tm = readFixtureJson<{ tmodel: { unit: Unit; load: PlateLoad; cost: number; n_res: number } }>('tmodel_short.json').tmodel;
const rel = (a: number, b: number): number => Math.abs(a / b - 1);

test('recovers a known T-model from synthetic data', () => {
  const rs = 1.3;
  const truth: Unit = { n: 5, L_leak: 1.1e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.7 * rs, R2: 0.3 * rs * 25, C_w: 0, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0, G_fix: 0 };
  const f = Array.from({ length: 231 }, (_, i) => 2e6 + i * 0.1e6);
  const fit = fitTModel(f, f.map((x) => unitInputZ(truth, load, x)), { n: 5, fPri: 0, nP: 3, nC: 4 });
  assert.ok(fit.rmsRel < 1e-6, `rms_rel ${fit.rmsRel}`);
  for (const k of ['L_leak', 'L_m', 'G_core', 'R1', 'R2'] as const) assert.ok(rel(fit.unit[k], truth[k]) < 1e-4, `${k} ${fit.unit[k]} vs ${truth[k]}`);
  assert.ok(rel(fit.load.C, load.C) < 1e-4);
});

test('matches calib.fit_one_port on the real O7 cap-free sweep (cost within 2 %)', () => {
  const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
  const t = buildBranchTable(capFree, DEFAULT_VARIANTS[0]);
  const fit = fitTModel(capFree.f, t.re.map((re, i) => cx(re, t.im[i])), { n: 5, fPri: 0, nP: 3, nC: 4 });
  assert.equal(fit.nRes, tm.n_res);
  assert.ok(fit.cost <= tm.cost * 1.02, `cost ${fit.cost} vs Python ${tm.cost}`);
  const k = nearestIndex(capFree.f, 13.56e6);
  const zTs = unitInputZ(fit.unit, fit.load, capFree.f[k]);
  const zPy = unitInputZ(tm.unit, tm.load, capFree.f[k]);
  assert.ok(abs(sub(zTs, zPy)) <= 0.02 * abs(zPy), `Z(13.56) ${zTs.re}+${zTs.im}j vs ${zPy.re}+${zPy.im}j`);
});
```

`src/fit/short.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { fitShort, variantFromShort } from './short.ts';
import { loadFixtureSweep, readFixtureJson } from '../testutil.ts';

interface Fx { shorts: { file: string; fixed: { length: number; L_nH: number; rms: number }[]; free: { length: number; L_nH: number } }[] }
const fx = readFixtureJson<Fx>('tmodel_short.json');

for (const s of fx.shorts) {
  test(`shorted-jumper fit matches the Python recipe: ${s.file}`, () => {
    const sweep = loadFixtureSweep('short', s.file);
    for (const want of s.fixed) {
      const r = fitShort(sweep, { length: want.length, fitLength: false });
      assert.ok(Math.abs(r.L * 1e9 - want.L_nH) < 1, `${want.length} m: ${r.L * 1e9} nH vs ${want.L_nH}`);
      assert.ok(Math.abs(r.rms / want.rms - 1) < 0.02, `rms ${r.rms} vs ${want.rms}`);
    }
    const free = fitShort(sweep, { length: 1.3, fitLength: true });
    assert.ok(Math.abs(free.length - s.free.length) < 1e-3, `length ${free.length} vs ${s.free.length}`);
    assert.ok(Math.abs(free.L * 1e9 - s.free.L_nH) < 2, `L ${free.L * 1e9} vs ${s.free.L_nH}`);
  });
}

test('variantFromShort builds a cable/jumper variant', () => {
  const v = variantFromShort('new jumpers @ 1.245 m', { length: 1.245, L: 344e-9, rms: 0.7 });
  assert.deepEqual(v, { name: 'new jumpers @ 1.245 m', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 344e-9 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --experimental-strip-types --test src/fit/tmodel.test.ts src/fit/short.test.ts`
Expected: FAIL with `Cannot find module` for `tmodel.ts` and `short.ts`.

- [ ] **Step 3: Write the implementations**

`src/fit/tmodel.ts`:

```ts
import { type Complex, abs, sub } from '../engine/complex.ts';
import { type PlateLoad, type Unit, unitInputZ } from '../engine/transformer.ts';
import { levenbergMarquardt } from './lm.ts';

export interface TModelOptions {
  n: number;
  fPri: number;
  nP: number;
  nC: number;
  k1?: number;
  fLo?: number;
  fHi?: number;
}

export interface TModelFit {
  unit: Unit;
  load: PlateLoad;
  rmsRel: number;
  cost: number;
  nRes: number;
}

/** Starting points of calib.fit_one_port: (L_leak, L_m, C, Rs, G_core). */
export const TMODEL_STARTS: number[][] = [
  [0.4e-6, 0.3e-6, 19e-12, 0.5, 1e-3], [1.0e-6, 1.2e-6, 20e-12, 1.5, 5e-4], [0.2e-6, 0.15e-6, 25e-12, 0.3, 2e-3],
  [0.4e-6, 0.2e-6, 15e-12, 0.5, 1e-3], [0.6e-6, 0.5e-6, 19e-12, 1.0, 1e-3], [1.1e-6, 0.7e-6, 3e-12, 1.0, 5e-4],
  [2.0e-6, 2.0e-6, 5e-12, 1.0, 3e-4], [0.6e-6, 0.4e-6, 6e-12, 0.8, 5e-4],
];

function build(x: number[], o: TModelOptions): { unit: Unit; load: PlateLoad } {
  const [ll, lm, c, rs, g] = x.map(Math.exp);
  const k1 = o.k1 ?? 0.7;
  return {
    unit: { n: o.n, L_leak: ll, f_pri: o.fPri, L_m: lm, G_core: g, R1: k1 * rs, R2: (1 - k1) * rs * o.n ** 2, C_w: 0, N_p: o.nP, N_c: o.nC },
    load: { C: c, G_cube: 0, G_fix: 0 },
  };
}

/** T-model fit to cap-free one-port data at a fixed leakage split (calib.fit_one_port without fit_g_sec). */
export function fitTModel(f: number[], z: Complex[], o: TModelOptions): TModelFit {
  const lo = o.fLo ?? 2e6;
  const hi = o.fHi ?? 25e6;
  const idx = f.map((_, i) => i).filter((i) => f[i] >= lo && f[i] <= hi);
  const wts = idx.map((i) => 1 / Math.sqrt(abs(z[i]) ** 2 + 1));
  const res = (x: number[]): number[] => {
    const { unit, load } = build(x, o);
    const re: number[] = [];
    const im: number[] = [];
    idx.forEach((i, k) => {
      const e = sub(unitInputZ(unit, load, f[i]), z[i]);
      re.push(e.re * wts[k]);
      im.push(e.im * wts[k]);
    });
    return [...re, ...im];
  };
  let best: { x: number[]; cost: number } | null = null;
  for (const s of TMODEL_STARTS) {
    const r = levenbergMarquardt(res, s.map(Math.log), { maxIter: 300 });
    if (best === null || r.cost < best.cost) best = { x: r.x, cost: r.cost };
  }
  const b = best as { x: number[]; cost: number };
  const nRes = 2 * idx.length;
  return { ...build(b.x, o), cost: b.cost, nRes, rmsRel: Math.sqrt((2 * b.cost) / nRes) };
}
```

`src/fit/short.ts`:

```ts
import { cx, sub } from '../engine/complex.ts';
import { type Cable, deembed } from '../engine/coax.ts';
import type { Variant } from '../chain/types.ts';
import { type Sweep, zFromGamma } from '../io/sweep.ts';
import { levenbergMarquardt } from './lm.ts';

export interface ShortOptions {
  length: number;
  fitLength: boolean;
  vf?: number;
  z0?: number;
  band?: [number, number];
}

export interface ShortFit {
  length: number;
  L: number;
  rms: number;
}

/** Jumper inductance (and optionally cable length) from a sweep with the coax jumpers shorted at the board (spec §7 stage 0). */
export function fitShort(s: Sweep, o: ShortOptions): ShortFit {
  const [lo, hi] = o.band ?? [2e6, 25e6];
  const idx = s.f.map((_, i) => i).filter((i) => s.f[i] >= lo && s.f[i] <= hi);
  const z = idx.map((i) => zFromGamma(s.gamma[i]));
  const cable = (len: number): Cable => ({ length: len, vf: o.vf ?? 0.7, z0: o.z0 ?? 50, alpha13: 0 });
  const res = (len: number, lnH: number): number[] => {
    const re: number[] = [];
    const im: number[] = [];
    idx.forEach((i, k) => {
      const f = s.f[i];
      const e = sub(deembed(z[k], cable(len), f), cx(0, 2 * Math.PI * f * lnH * 1e-9));
      re.push(e.re);
      im.push(e.im);
    });
    return [...re, ...im];
  };
  const r = o.fitLength
    ? levenbergMarquardt((x) => res(x[0], x[1]), [1.3, 300], { lo: [0.5, 0], hi: [3, 2000] })
    : levenbergMarquardt((x) => res(o.length, x[0]), [300], { lo: [0], hi: [2000] });
  const length = o.fitLength ? r.x[0] : o.length;
  const lnH = o.fitLength ? r.x[1] : r.x[0];
  return { length, L: lnH * 1e-9, rms: Math.sqrt((2 * r.cost) / r.residual.length) };
}

export const variantFromShort = (name: string, fit: ShortFit, vf = 0.7): Variant => ({ name, cable: { length: fit.length, vf, z0: 50, alpha13: 0 }, Lj: fit.L });
```

- [ ] **Step 4: Run the tests**

Run: `node --experimental-strip-types --test src/fit/tmodel.test.ts src/fit/short.test.ts && npm run typecheck`
Expected: 5 tests pass; no type errors. The real-data T-model test runs 8 multi-start fits on ~4,840 points and may take up to a minute.

If the free-length short fit lands on a different local minimum, report both solutions; do not change the start point.

- [ ] **Step 5: Commit**

```bash
git add src/fit/tmodel.ts src/fit/tmodel.test.ts src/fit/short.ts src/fit/short.test.ts
git commit -m "feat(fit): add the stage-1 T-model fit and the stage-0 shorted-jumper fit" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Recommend: enumerate, land, rank

**Files:**
- Create: `src/recommend/enumerate.ts`, `src/recommend/landing.ts`, `src/recommend/rank.ts`, `src/recommend/recommend.ts`
- Test: `src/recommend/enumerate.test.ts`, `src/recommend/landing.test.ts`, `src/recommend/rank.test.ts`, `src/recommend/recommend.parity.test.ts`

**Interfaces:**
- Consumes:
  - Task 9 (`counts`, `physicalParts`, `sumCounts`, `CAP_VALUES`, `DEFAULT_STOCK`); Task 11 (`compile`); Task 6 (`inputImpedance`);
  - Task 12 (`allBlocks`, `applyState`, `findBlock`, presets, `fromFitVars`); Task 15 (`drive`, `reports`, `maxCapStressPct`, `DriveError`);
  - `fixtures/python/o7_fit.json` (`recommend`).
- Produces:
  - `bankCombos(slots): Counts[]` (the `o7_joint.py` `combos()` order)
  - `type Pick = BankParts`, `interface Candidate { picks: Record<string, Pick> }`, `interface BankSpec { id; slots }`
  - `candidates(banks, stock, reserved, allowSeriesPairs?)`, `moveCount(current, pick)`, `describeMoves(labels, current, pick): string[]`
  - `F0`, `NOT_IN_WINDOW = −99`, `ROOM_SEG = [12.5e6, 14.6e6]`, `inWindow(z, w)`, `interface Landing { z; f; inWindow; roomUp; roomDown }`, `landing(f, z, w, seg?)`
  - `ROOM_CAP = 2.5`, `lowerMedian(xs)`, `interface Scored<C> { candidate; landings; inCount; roomScore; moves }`, `rank(scored, nVariants)`
  - `interface FittedVariant { variant; chain }`, `interface RecommendInput { fitted; sweeps; grid; window; stock; searchIds?; allowSeriesPairs?; stressWatts? }`
  - `interface Recommendation extends Scored<Candidate> { maxStressPct; movesText }`, `interface RecommendOutput { ranked; all; current }`
  - `applyPicks(chain, picks)`, `recommend(input): RecommendOutput`

- [ ] **Step 1: Write the failing unit tests**

`src/recommend/enumerate.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { bankCombos, candidates, describeMoves, moveCount } from './enumerate.ts';

test('bank combos follow o7_joint.py combos() order and size', () => {
  assert.deepEqual(bankCombos(2), [counts(0, 0, 1), counts(0, 0, 2), counts(0, 1, 0), counts(0, 1, 1), counts(0, 2, 0), counts(1, 0, 0), counts(1, 0, 1), counts(1, 1, 0), counts(2, 0, 0)]);
  assert.equal(bankCombos(4).length, 34);
});

test('series (2 slots) × shunt (4 slots) within the stock is 209 candidates', () => {
  assert.equal(candidates([{ id: 'ser', slots: 2 }, { id: 'sh', slots: 4 }], DEFAULT_STOCK, counts()).length, 209);
});

test('parts reserved by unsearched banks are not available', () => {
  const free = candidates([{ id: 'ser', slots: 2 }], counts(1, 0, 0), counts());
  const reserved = candidates([{ id: 'ser', slots: 2 }], counts(1, 0, 0), counts(1, 0, 0));
  assert.equal(free.length, 1);
  assert.equal(reserved.length, 0);
});

test('two-groups-in-series picks use twice the parts', () => {
  const all = candidates([{ id: 'b', slots: 2 }], counts(2, 0, 0), counts(), true);
  assert.ok(all.some((c) => c.picks.b.nSeries === 2 && c.picks.b.counts[100] === 1));
  assert.ok(!all.some((c) => c.picks.b.nSeries === 2 && c.picks.b.counts[100] === 2));
});

test('moves count parts removed and added; the description names them', () => {
  const current = { ser: { counts: counts(0, 1, 1), nSeries: 1 as const }, sh: { counts: counts(2, 0, 0), nSeries: 1 as const } };
  const pick = { ser: { counts: counts(0, 1, 1), nSeries: 1 as const }, sh: { counts: counts(1, 1, 1), nSeries: 1 as const } };
  assert.equal(moveCount(current, pick), 3);
  assert.deepEqual(describeMoves({ ser: 'Series bank', sh: 'Shunt bank' }, current, pick), ['Series bank: no change', 'Shunt bank: remove 1×100; add 1×50 + 1×30']);
});
```

`src/recommend/landing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { NOT_IN_WINDOW, landing } from './landing.ts';
import { assertNear } from '../testutil.ts';

const f = [13.0e6, 13.3e6, 13.56e6, 13.8e6, 14.0e6, 14.3e6];

test('contiguous in-window band around 13.56 MHz gives the drift room', () => {
  const z = [cx(4, 2), cx(6, 10), cx(8, 20), cx(10, 30), cx(30, 60), cx(12, 40)];
  const l = landing(f, z, AIT_WINDOW);
  assert.equal(l.inWindow, true);
  assertNear(l.roomUp, ((13.8e6 - 13.56e6) / 13.56e6) * 100, 1e-12); // stops at 14.0 (out), ignores 14.3 (back in)
  assertNear(l.roomDown, ((13.56e6 - 13.3e6) / 13.56e6) * 100, 1e-12);
});

test('out of the window at 13.56 MHz reports the sentinel', () => {
  const l = landing(f, f.map(() => cx(3, 3)), AIT_WINDOW);
  assert.equal(l.inWindow, false);
  assert.equal(l.roomUp, NOT_IN_WINDOW);
});
```

`src/recommend/rank.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerMedian, rank } from './rank.ts';

const s = (name: string, inCount: number, roomScore: number, moves: number) => ({ candidate: name, landings: [], inCount, roomScore, moves });

test('lower median: the middle of three, the lower middle of four', () => {
  assert.equal(lowerMedian([3, -99, 1]), 1);
  assert.equal(lowerMedian([4, 1, 3, 2]), 2);
});

test('majority filter, then variants in window, capped room, then fewer moves (stable)', () => {
  const out = rank([s('minority', 1, 9, 0), s('room1', 3, 1.0, 1), s('room3moves4', 3, 3.0, 4), s('room4moves2', 3, 4.0, 2), s('two', 2, 9, 0)], 3);
  assert.deepEqual(out.map((x) => x.candidate), ['room4moves2', 'room3moves4', 'room1', 'two']);
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `node --experimental-strip-types --test src/recommend/enumerate.test.ts src/recommend/landing.test.ts src/recommend/rank.test.ts`
Expected: FAIL with `Cannot find module` for each recommend module.

- [ ] **Step 3: Write the implementations**

`src/recommend/enumerate.ts`:

```ts
import { type BankParts, type Counts, CAP_VALUES, counts, physicalParts, sumCounts } from '../blocks/ht50.ts';

/** Every non-empty parallel group of at most `slots` parts, in o7_joint.py combos() order (100 pF outermost). */
export function bankCombos(slots: number): Counts[] {
  const out: Counts[] = [];
  for (let a = 0; a <= slots; a += 1) {
    for (let b = 0; b <= slots; b += 1) {
      for (let c = 0; c <= slots; c += 1) {
        const n = a + b + c;
        if (n > 0 && n <= slots) out.push(counts(a, b, c));
      }
    }
  }
  return out;
}

export type Pick = BankParts;
export interface Candidate { picks: Record<string, Pick> }
export interface BankSpec { id: string; slots: number }

/** Cartesian product over the searched banks (first bank outermost) within the stock left after the reserved parts. */
export function candidates(banks: BankSpec[], stock: Counts, reserved: Counts, allowSeriesPairs = false): Candidate[] {
  const options = banks.map((b) => [
    ...bankCombos(b.slots).map((c): Pick => ({ counts: c, nSeries: 1 })),
    ...(allowSeriesPairs ? bankCombos(Math.floor(b.slots / 2)).map((c): Pick => ({ counts: c, nSeries: 2 })) : []),
  ]);
  const out: Candidate[] = [];
  const rec = (k: number, acc: Record<string, Pick>): void => {
    if (k === banks.length) {
      const used = sumCounts([reserved, ...Object.values(acc).map(physicalParts)]);
      if (CAP_VALUES.every((v) => used[v] <= stock[v])) out.push({ picks: { ...acc } });
      return;
    }
    for (const p of options[k]) rec(k + 1, { ...acc, [banks[k].id]: p });
  };
  rec(0, {});
  return out;
}

/** Parts removed plus parts added, summed over the picked banks (o7_joint.py "moves"). */
export function moveCount(current: Record<string, Pick>, pick: Record<string, Pick>): number {
  return Object.keys(pick).reduce((sum, id) => {
    const a = physicalParts(pick[id]);
    const b = physicalParts(current[id]);
    return sum + CAP_VALUES.reduce((s, v) => s + Math.abs(a[v] - b[v]), 0);
  }, 0);
}

/** Plain-language moves per bank, e.g. "Shunt bank: remove 1×100; add 1×50 + 1×30" (spec §9). */
export function describeMoves(labels: Record<string, string>, current: Record<string, Pick>, pick: Record<string, Pick>): string[] {
  return Object.keys(pick).map((id) => {
    const a = physicalParts(pick[id]);
    const b = physicalParts(current[id]);
    const rm = CAP_VALUES.filter((v) => b[v] > a[v]).map((v) => `${b[v] - a[v]}×${v}`);
    const ad = CAP_VALUES.filter((v) => a[v] > b[v]).map((v) => `${a[v] - b[v]}×${v}`);
    const rewire = pick[id].nSeries !== current[id].nSeries ? `; rewire as ${pick[id].nSeries === 2 ? 'two groups in series' : 'one group'}` : '';
    const name = labels[id] ?? id;
    if (!rm.length && !ad.length && !rewire) return `${name}: no change`;
    const parts = [rm.length ? `remove ${rm.join(' + ')}` : '', ad.length ? `add ${ad.join(' + ')}` : ''].filter(Boolean).join('; ');
    return `${name}: ${parts}${rewire}`;
  });
}
```

`src/recommend/landing.ts`:

```ts
import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { nearestIndex } from '../io/sweep.ts';

export const F0 = 13.56e6;
export const NOT_IN_WINDOW = -99;
/** Drift-room search segment (o7_joint.py `seg`: 12.5 < f < 14.6 MHz). */
export const ROOM_SEG: [number, number] = [12.5e6, 14.6e6];

export const inWindow = (z: Complex, w: Window): boolean => z.re >= w.rLo && z.re <= w.rHi && z.im >= w.xLo && z.im <= w.xHi;

export interface Landing {
  z: Complex;
  f: number;
  inWindow: boolean;
  roomUp: number;
  roomDown: number;
}

/** Landing at the grid point nearest 13.56 MHz and the contiguous in-window band around it, in % of 13.56 MHz (spec §9). */
export function landing(f: number[], z: Complex[], w: Window, seg: [number, number] = ROOM_SEG): Landing {
  const k0 = nearestIndex(f, F0);
  const inSeg = (i: number): boolean => f[i] > seg[0] && f[i] < seg[1];
  if (!(inSeg(k0) && inWindow(z[k0], w))) return { z: z[k0], f: f[k0], inWindow: false, roomUp: NOT_IN_WINDOW, roomDown: NOT_IN_WINDOW };
  let hi = k0;
  while (hi + 1 < f.length && inSeg(hi + 1) && inWindow(z[hi + 1], w)) hi += 1;
  let lo = k0;
  while (lo - 1 >= 0 && inSeg(lo - 1) && inWindow(z[lo - 1], w)) lo -= 1;
  return { z: z[k0], f: f[k0], inWindow: true, roomUp: ((f[hi] - F0) / F0) * 100, roomDown: ((F0 - f[lo]) / F0) * 100 };
}
```

`src/recommend/rank.ts`:

```ts
import type { Landing } from './landing.ts';

/** Drift room beyond which more room no longer outranks fewer part moves (spec §9). */
export const ROOM_CAP = 2.5;

export const lowerMedian = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)];

export interface Scored<C> {
  candidate: C;
  landings: Landing[];
  inCount: number;
  roomScore: number;
  moves: number;
}

/** Keep picks a majority of variants put in the window; sort by variants in window, capped median room-up, then moves. Stable. */
export function rank<C, S extends Scored<C>>(scored: S[], nVariants: number): S[] {
  return scored
    .filter((s) => s.inCount * 2 > nVariants)
    .sort((a, b) => b.inCount - a.inCount || Math.min(b.roomScore, ROOM_CAP) - Math.min(a.roomScore, ROOM_CAP) || a.moves - b.moves);
}
```

`src/recommend/recommend.ts`:

```ts
import { type Counts, physicalParts, sumCounts } from '../blocks/ht50.ts';
import { inputImpedance } from '../engine/mna.ts';
import { compile } from '../chain/compile.ts';
import { allBlocks, applyState, findBlock } from '../chain/state.ts';
import type { BranchTable, CapBankBlock, Chain, Variant, Window } from '../chain/types.ts';
import { type Sweep, nearestIndex } from '../io/sweep.ts';
import { DriveError, drive, maxCapStressPct, reports } from '../stress/drive.ts';
import { type Candidate, type Pick, candidates, describeMoves, moveCount } from './enumerate.ts';
import { F0, ROOM_SEG, landing } from './landing.ts';
import { type Scored, lowerMedian, rank } from './rank.ts';

export interface FittedVariant { variant: Variant; chain: Chain }

export interface RecommendInput {
  fitted: FittedVariant[];
  sweeps: Record<string, Sweep>;
  grid: number[];
  window: Window;
  stock: Counts;
  searchIds?: string[];
  allowSeriesPairs?: boolean;
  stressWatts?: number;
}

export interface Recommendation extends Scored<Candidate> {
  maxStressPct: number | null;
  movesText: string[];
}

export interface RecommendOutput {
  ranked: Recommendation[];
  all: Recommendation[];
  current: Record<string, Pick>;
}

const capBanks = (chain: Chain): CapBankBlock[] => allBlocks(chain.blocks).filter((b): b is CapBankBlock => b.type === 'capBank');

export const applyPicks = (chain: Chain, picks: Record<string, Pick>): Chain =>
  applyState(chain, Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { counts: p.counts, nSeries: p.nSeries }])));

/** Every buildable pick for the searched banks, landed per fitted variant and ranked (spec §9). */
export function recommend(input: RecommendInput): RecommendOutput {
  const base = input.fitted[0].chain;
  const banks = capBanks(base);
  const searchIds = input.searchIds ?? banks.filter((b) => b.searchable).map((b) => b.id);
  const searched = searchIds.map((id) => {
    const b = findBlock(base, id);
    if (!b || b.type !== 'capBank') throw new Error(`"${id}" is not a cap bank`);
    return b;
  });
  const reserved = sumCounts(banks.filter((b) => !searchIds.includes(b.id)).map((b) => physicalParts(b)));
  const current: Record<string, Pick> = Object.fromEntries(searched.map((b) => [b.id, { counts: b.counts, nSeries: b.nSeries }]));
  const labels = Object.fromEntries(searched.map((b) => [b.id, b.label]));
  const fSeg = input.grid.filter((f) => f > ROOM_SEG[0] && f < ROOM_SEG[1]);
  const f0 = input.grid[nearestIndex(input.grid, F0)];
  const caches = input.fitted.map(() => new Map<string, BranchTable>());
  const all = candidates(searched.map((b) => ({ id: b.id, slots: b.slots })), input.stock, reserved, input.allowSeriesPairs).map((cand): Recommendation => {
    let maxStressPct: number | null = null;
    const landings = input.fitted.map((fv, k) => {
      const chain = applyPicks(fv.chain, cand.picks);
      const ctx = { variant: fv.variant, sweeps: input.sweeps, cache: caches[k] };
      const c = compile(chain, ctx);
      const l = landing(fSeg, fSeg.map((f) => inputImpedance(c.net, f)), input.window);
      if (input.stressWatts !== undefined) {
        try {
          const m = maxCapStressPct(reports(chain, drive(chain, ctx, f0, input.stressWatts)));
          if (m !== null) maxStressPct = Math.max(maxStressPct ?? 0, m);
        } catch (e) {
          if (!(e instanceof DriveError)) throw e;
        }
      }
      return l;
    });
    return {
      candidate: cand,
      landings,
      inCount: landings.filter((l) => l.inWindow).length,
      roomScore: lowerMedian(landings.map((l) => l.roomUp)),
      moves: moveCount(current, cand.picks),
      maxStressPct,
      movesText: describeMoves(labels, current, cand.picks),
    };
  });
  return { ranked: rank<Candidate, Recommendation>(all, input.fitted.length), all, current };
}
```

- [ ] **Step 4: Run the unit tests**

Run: `node --experimental-strip-types --test src/recommend/enumerate.test.ts src/recommend/landing.test.ts src/recommend/rank.test.ts && npm run typecheck`
Expected: 9 tests pass; no type errors.

- [ ] **Step 5: Write the parity test against the captured Python ranking**

`src/recommend/recommend.parity.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, counts } from '../blocks/ht50.ts';
import { AIT_WINDOW, DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, o7Chain, o7State } from '../chain/presets.ts';
import { applyState } from '../chain/state.ts';
import { fromFitVars } from '../fit/params.ts';
import { recommend } from './recommend.ts';
import { assertClose, assertNear, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface Cand { series: number[]; shunt: number[]; landings: number[][]; room_up: number[]; room_down: number[]; n_in: number; moves: number }
interface Fx { variants: { fit3: { x: number[] }; loop: { q: number } }[]; recommend: { count: number; candidates: Cand[]; top12: number[][][] } }
const fx = readFixtureJson<Fx>('o7_fit.json');
const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
// Python's own fitted loop-state models (3-sweep fit + shift), current build 80/200, so this checks recommend alone.
const fitted = fx.variants.map((v, i) => ({
  variant: DEFAULT_VARIANTS[i],
  chain: applyState(fromFitVars(fromFitVars(o7Chain('capfree'), O7_REFS, v.fit3.x), [O7_LOOP_REF], [v.loop.q]), o7State(counts(0, 1, 1), counts(2, 0, 0), true)),
}));
const out = recommend({ fitted, sweeps: { capfree: capFree }, grid: capFree.f, window: AIT_WINDOW, stock: DEFAULT_STOCK, searchIds: ['ser', 'sh'] });
const triple = (c: Record<number, number>): number[] => [c[100], c[50], c[30]];

test('enumerates the same candidates in the same order as the Python', () => {
  assert.equal(out.all.length, fx.recommend.count);
  out.all.forEach((r, k) => {
    assert.deepEqual(triple(r.candidate.picks.ser.counts), fx.recommend.candidates[k].series);
    assert.deepEqual(triple(r.candidate.picks.sh.counts), fx.recommend.candidates[k].shunt);
  });
});

test('landings, drift room, variants in window and moves match per candidate', () => {
  out.all.forEach((r, k) => {
    const want = fx.recommend.candidates[k];
    r.landings.forEach((l, v) => {
      assertClose(l.z, pair(want.landings[v]), 1e-9, `cand ${k} variant ${v}`);
      assertNear(l.roomUp, want.room_up[v], 1e-12, `room up cand ${k} variant ${v}`);
      assertNear(l.roomDown, want.room_down[v], 1e-12, `room down cand ${k} variant ${v}`);
    });
    assert.equal(r.inCount, want.n_in);
    assert.equal(r.moves, want.moves);
  });
});

test('the ranked top 12 equals the Python ranking', () => {
  assert.deepEqual(out.ranked.slice(0, 12).map((r) => [triple(r.candidate.picks.ser.counts), triple(r.candidate.picks.sh.counts)]), fx.recommend.top12);
});

test('80/180 is in the window for the two good cable variants (the 10-13 re-pick)', () => {
  const r = out.all.find((x) => triple(x.candidate.picks.ser.counts).join() === '0,1,1' && triple(x.candidate.picks.sh.counts).join() === '1,1,1');
  assert.ok(r);
  assert.deepEqual(r.landings.map((l) => l.inWindow), [true, true, false]);
});
```

- [ ] **Step 6: Run the parity test**

Run: `node --experimental-strip-types --test src/recommend/recommend.parity.test.ts`
Expected: 4 tests pass.

The last test encodes the probe: 7.24 + j18.00 and 6.83 + j16.89 are inside the window, while 4.98 + j11.52 has R < 5. If the fixture says otherwise, follow the fixture and report the difference.

- [ ] **Step 7: Run everything and commit**

Run: `npm test && npm run typecheck`
Expected: all tests pass; no type errors.

```bash
git add src/recommend
git commit -m "feat(recommend): rank stock picks by variants in window, drift room and moves (parity with o7_joint.py)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Blind-replay validation CLI and report

**Files:**
- Create: `tools/replay.ts`, `tools/validate.ts`
- Modify: `package.json` (the `test` script also runs `tools/**/*.test.ts`)
- Test: `tools/replay.test.ts`
- Produces: `docs/validation/YYYY-MM-DD-validation.md`

**Interfaces:**
- Consumes: Tasks 8, 11, 12, 14 and 16 (`parseS1p`, `zFromGamma`, `nearestIndex`, `evaluate`, presets, `applyState`, `fitNetwork`, `fitShort`); the fixtures.
- Produces:
  - `interface ReplayRow { variant; step; ts; python; measured }`, `interface ShortRow { length; tsNh; pythonNh; recordedNh }`
  - `interface ReplayResult { tolOhm; rows; cd: { ts; python; measured; f }; shorts }`
  - `gateOk(row, tol)`, `replayPasses(result)`, `runReplay(root, tolOhm = 0.5)`, `renderReport(result, date): string`

- [ ] **Step 1: Write the failing test**

`tools/replay.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../src/engine/complex.ts';
import { type ReplayResult, type ReplayRow, gateOk, renderReport, replayPasses } from './replay.ts';

const row = (ts: [number, number], py: [number, number]): ReplayRow => ({ variant: '1.245 m + 342 nH', step: '80/200 predicted from 130/230 + 100/200', ts: cx(...ts), python: cx(...py), measured: cx(5.03, 4.3) });

test('the gate allows ±0.5 Ω in both R and X and nothing more', () => {
  assert.equal(gateOk(row([6.6, 12.6], [6.64, 12.59]), 0.5), true);
  assert.equal(gateOk(row([7.2, 12.6], [6.6, 12.6]), 0.5), false);
  assert.equal(gateOk(row([6.6, 13.2], [6.6, 12.6]), 0.5), false);
});

test('the report states the gate result and labels what is reported, not gated', () => {
  const r: ReplayResult = {
    tolOhm: 0.5,
    rows: [row([6.6, 12.6], [6.64, 12.59]), row([7.2, 12.6], [6.6, 12.6])],
    cd: { ts: cx(10, 20), python: cx(10, 20), measured: cx(12, 25), f: 13.5622e6 },
    shorts: [{ length: 1.245, tsNh: 344, pythonNh: 344, recordedNh: 342 }],
  };
  assert.equal(replayPasses(r), false);
  const md = renderReport(r, '2026-10-14');
  assert.match(md, /Result: \*\*FAIL\*\*/);
  assert.match(md, /\| PASS \|/);
  assert.match(md, /\| FAIL \|/);
  assert.match(md, /reported, not gated/i);
  assert.match(md, /2026-10-14/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --experimental-strip-types --test tools/replay.test.ts`
Expected: FAIL with `Cannot find module` … `replay.ts`.

- [ ] **Step 3: Write the implementations**

`tools/replay.ts`:

```ts
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
```

`tools/validate.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderReport, replayPasses, runReplay } from './replay.ts';

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const root = new URL('../', import.meta.url);
const result = runReplay(root);
const md = renderReport(result, date);
mkdirSync(new URL('docs/validation/', root), { recursive: true });
const out = new URL(`docs/validation/${date}-validation.md`, root);
writeFileSync(out, md);
console.log(md);
console.log(`wrote ${out.pathname}`);
process.exit(replayPasses(result) ? 0 : 1);
```

In `package.json`, change the `test` script to:

```json
"test": "node --experimental-strip-types --test 'src/**/*.test.ts' 'tools/**/*.test.ts'",
```

- [ ] **Step 4: Run the unit test**

Run: `node --experimental-strip-types --test tools/replay.test.ts && npm run typecheck`
Expected: 2 tests pass; no type errors.

- [ ] **Step 5: Run the real-data validation (the v1 acceptance gate for this plan)**

Run: `npm run validate -- 2026-10-14`
Expected:
- exit code 0;
- the report prints `Result: **PASS** (6 of 6 rows)`;
- `wrote …/docs/validation/2026-10-14-validation.md`.

Section 2 should show the 2-sweep predictions of 80/200 near 6.4–6.6 + j12.6 against the measured 5.03 + j4.30, and the loop-state predictions of 80/180 near 6.8–7.2 + j16.9–18.0 against the measured 7.81 + j27.89.

- [ ] **Step 6: Read the report yourself**

Open `docs/validation/2026-10-14-validation.md` and read every section. Confirm in your own words:
1. Every Section 1 row is PASS.
2. The Section 2 errors are the honest model error: the X under-prediction on 80/180 + loop is about 10 Ω.
3. The Section 4 TypeScript and Python values agree within 1 nH.

If any number looks wrong, investigate before committing. A PASS from the script is not enough.

- [ ] **Step 7: Run everything once more and commit**

Run: `npm test && npm run typecheck`
Expected: all tests pass; no type errors.

```bash
git add package.json tools/replay.ts tools/replay.test.ts tools/validate.ts docs/validation/2026-10-14-validation.md
git commit -m "feat(validate): blind replay of the 10-13 history with a markdown report" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## What Plan 2 (interface) will cover

Plan 2 is written after this plan lands, against the finished API above. Its scope, from the spec, so nothing is lost:

- **App shell (spec §12):** Vite + React 19.2.6 + Vite 8, with NanoVNA web design tokens copied from `nanovna-web/src/styles.css`. The 3-column layout: project, sweeps, stock and power on the left; inspector, Fit, Recommend and Stress in the middle; circuit strip and 2×2 plot panes on the right. Light/dark toggle.
- **Chain editor:** block cards with physical and symbol views, the ⇄ toggle, add / remove / reorder blocks, and the inspector with source badges and lock / fit toggles.
- **Reference plane choice:** AIT-out keeps the coax block; network input drops it.
- **Plot panes:** canvas Smith chart with the shaded AIT window and per-variant landings; |S11| dB; R and X; stress bars; markers; resizable panes. Measured sweeps dashed, predictions solid.
- **Evaluation grid (spec §4):** the sweep grid when a measured branch exists, otherwise 1–30 MHz × 2,000 points plus exactly 13.56 MHz.
- **Sweep loading and state tagging UI:** Fit, Recommend (top 12, moves list, Apply) and Stress panels.
- **Flux and measurements:** the flux range with the measured point drawn beside it, and the scope-reading → f_pri tool.
- **Trust chip (spec §11):** "validated" vs "extrapolating", plus ill-determined flags.
- **Remaining spec §5 / §7 details:** the generic complex-impedance (Z) and explicit open primitives, and the measured-vs-model table at 12.9 / 13.1 / 13.3 / 13.45 / 13.56 MHz (computed from `evaluate`).
- **Persistence (spec §13):** project file `*.rfnm.json` (`schema: "rfnm/1"`) save / open, and the `localStorage` autosave wrapped in try/catch.
- **Browser walkthrough (spec §14):** O7 preset → 5 sweeps → Fit → Recommend → Stress at 500 W → light/dark, with screenshots viewed before any claim.

**Not in either plan (spec §16, or no data to support it):**
- the AIT internal-loss resistance r_a;
- AIT reflection vs drift with a frozen tuner;
- heating;
- a live NanoVNA link;
- a free-form canvas;
- applicator geometry.

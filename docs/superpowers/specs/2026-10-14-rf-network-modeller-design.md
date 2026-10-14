# RF Network Modeller: Design Spec

- **Date:** 2026-10-14
- **Status:** draft for Matt's review
- **Repo:** `~/code/put_github_repos_here/rf-network-modeller` (local; private GitHub repo only after Matt's OK)

## 1. Purpose

A browser tool for designing and tuning the RFAM matching network.

Today the loop is: Matt collects VNA sweeps, sends them to Claude, and Claude recommends the next build. The tool lets Matt run that loop himself, and lets someone without RF training use it too.

Matt asked for (2026-10-14):
- Build and edit a network visually, with standard parts (R, L, C, transformer, coax) or physical ones (HT50 cap bank, Fair-Rite stack with turns, jumper wire, plates + powder load).
- See the predicted VNA output: Smith chart, |S11|, impedance vs frequency.
- Keep the design language of the NanoVNA web tool.
- Make it useful to Matt himself: fit to his sweeps and recommend the next build.

Success means:
- Matt loads his sweeps.
- He gets a fitted model that reproduces them.
- He gets a ranked list of stock-cap picks with the moves to make.
- He reads each cap's stress at the power he plans to run.
- All without asking Claude.

## 2. Decisions made during brainstorming

| Decision | Choice | Reason |
|---|---|---|
| Editor style | Chain builder on a general nodal solver | Every build since 2026-08 is a chain; a general solver lets a free-form canvas come later without a rewrite |
| Location | New private repo | The reference repos (`nanovna-web`, `flir-research-interface`) are public; rig presets and sweeps ship with this tool |
| Look | NanoVNA web tool (light instrument panel, its light/dark toggle) | The tool is "the VNA, but predicted"; its Smith/plot code and `.s1p` reader carry over (MIT, Matt's code) |
| v1 scope | Build + predicted plots; overlay + fit; recommend; stress + flux | All four chosen by Matt |
| Implementation | All TypeScript in the browser, proven against the Python by captured fixtures | No server; instant updates; same stack as `nanovna-web` |

## 3. Architecture

```
rf-network-modeller/
  src/engine/     complex math, nodal solver, coax 2-port, ideal transformer      (no UI)
  src/blocks/     block types → primitive parts; presets; HT50 table; stock
  src/chain/      chain data model, sweep states, chain → netlist compiler
  src/fit/        Levenberg–Marquardt with bounds, fit recipes, model variants
  src/recommend/  stock enumeration, landing, drift room, ranking, move lists
  src/stress/     drive at power P, per-part V/I vs rating, flux and loop-V range
  src/io/         .s1p parse (from nanovna-web), project file save/load
  src/ui/         app shell, chain editor, inspector, panels, plot panes
  tools/          capture_fixtures.py (runs the real Python), validate.ts
  fixtures/       real .s1p sweeps + Python-captured reference outputs (JSON)
  docs/           this spec, plan, validation reports
```

Data flow: the chain plus the selected model variant is compiled to a netlist. The netlist is solved at each frequency to give Z_in at the port. Z_in feeds Γ for the plots, Fit and Recommend. A drive at power P gives every node voltage and branch current for Stress.

Modules talk through plain typed data (`Chain`, `Netlist`, `Sweep`, `Variant`, `FitResult`). The engine, blocks, chain, fit, recommend and stress modules have no React imports and are tested headless with `node --test`. Files stay at or under ~400 lines.

Stack, pinned to match `nanovna-web`:
- Node >= 22.13, React 19.2.6, Vite 8, TypeScript 5.9;
- no runtime dependencies besides React;
- tests via `node --experimental-strip-types --test`.

## 4. Engine

**Conventions**
- rms phasors with e^{jωt}; Z₀ = 50 Ω.
- Units: SI internally; pF, nH, MHz and kV appear only in the UI.

**Solver: complex modified nodal analysis, one solve per frequency.** Unknowns are the node voltages (node 0 = ground) plus one current per ideal transformer and per source. Stamps:

| Part | Stamp |
|---|---|
| R, L, C, generic Z(f) | admittance between two nodes |
| Ideal transformer 1:n | V₂ = n·V₁ and I₁ = −n·I₂ via one extra unknown |
| Transmission line (coax) | 2-port Y: Y₁₁ = Y₂₂ = coth(γl)/Z₀, Y₁₂ = Y₂₁ = −csch(γl)/Z₀, with γl = α₁₃·√(f/13.56 MHz) + jβl, matching `rfchain._gl` |
| Port | 1 A current source → V = Z_in |

- **Linear algebra:** dense complex LU with partial pivoting; the matrices are under ~30×30.
- **Scaling:** rows are scaled before factorisation, because values run from pF to kV.

**Transformer T-model.** Expanded exactly as `rfchain.unit_abcd`:
1. series R1 + jω·f_pri·L_leak;
2. shunt G_core ∥ L_m;
3. ideal 1:n;
4. series R2 + jω(1−f_pri)·L_leak·n²;
5. shunt C_w across the secondary.

Paralleled units share both terminal pairs.

**Measured impedance Z(f).** A table taken from a de-embedded sweep, with linear interpolation of the real and imaginary parts. Outside the table, values clamp at the edges, as `np.interp` does, so parity holds. The UI flags any evaluation outside the table range.

**Frequency grid.**
- When a measured-impedance block exists, the evaluation grid is that sweep's own grid (the 2026-10-13 sweeps: 5,050 points, 1–25 MHz). Parity with the Python, which evaluates on `f` from the file, therefore holds point for point.
- Otherwise the grid is 1–30 MHz, 2,000 points linear, plus 13.56 MHz exactly.

## 5. Blocks

Every block has a **physical view** (mechanical inputs) and a **symbol view** (the primitive parts it expands to). Every numeric parameter carries:
- a **source badge**: `fit` (fitted to sweeps), `est` (estimated from geometry), or `typed`;
- a lock / fit toggle;
- fit bounds.

| Block | Inputs | Expands to | Defaults and source |
|---|---|---|---|
| Port | reference plane: AIT-out (default) or network input; AIT window | 50 Ω port | Window R 5–17 Ω, X +6..+48 Ω (`o7_joint.py` `WIN`; the envelope of C+D's good states, not an AIT reach limit) |
| Coax | length, VF, Z₀, α₁₃ | transmission line | Set by the active model variant (§8) |
| Cap bank | counts of HT50 100 / 50 / 30 pF parts or a custom value; 1 group or 2 identical groups in series; slots (Dual = 2, Quad = 4); scale factor k; ESR | C·k (+ ESR) | HT50 ratings at 13.56 MHz: 100 pF 1.08 kV / 9.2 A, 50 pF 1.53 kV / 6.5 A, 30 pF 1.98 kV / 5.1 A (`model/match.py` `HT50`) |
| Wire / jumper | length mm, AWG, strands; or a lumped L | L + R | `est`: high-frequency straight-wire L = (μ₀/2π)·l·[ln(2l/r) − 1], with strands as one conductor of radius √N·r_strand; R from skin depth (copper, δ ≈ 17.7 µm at 13.56 MHz), N strands in parallel. A fitted lumped L replaces the estimate |
| Measured branch | a cap-free sweep at the AIT-out plane; kr (branch-R scale); d (frequency shift, sense-loop state) | Z(f) = kr·Re z_p + j·Im z_p, evaluated at f·(1+d) | z_p = deembed(z_sweep, variant cable) − jω·L_j(variant) (`o7_joint.py`, `o7_loopstate.py` `shifted`) |
| Transformer stack | cores (Material 67), N_p, N_s, wire or strap; source: preset, estimate from turns, or fitted | T-model unit | Estimate: `design.make_unit` constants (AL13 72 nH/turn²/core, leakage law, C_w law). Presets: C+D 2:18 2-core (`builds_fit.json` `CD_0930_load`). An O7 T-model is produced by the stage-1 fit (§7) |
| Plates + load | plate C, G_cube, G_fix | C ∥ (G_cube + G_fix) on the secondary | From the T-model fit (`calib.fit_one_port` stores C and G_fix) |
| Shunt branch | structure only | sub-chain from the current node to ground | n/a |
| Parallel group | structure only | sub-chains sharing both end nodes | n/a |
| Primitives | value | R, L, C, Z, ideal transformer, open, short | typed |

**Two branch modes for the transformer side.**
- **Measured-branch mode** (default for O7): one measured-branch block stands for both stacks plus the plates. It is the best predictor on record (`SWEEP_NOTES.md` §10-13 fits).
- **T-model mode:** stack blocks in a parallel group plus a plates block. Only this mode supports the power split and flux (§10).

**Presets shipped in v1**
- **O7 parallel 3:15 (as built 2026-10-14):** port → coax → series bank 50 + 30 (Dual) → series path L (L_s, fit) → node. From the node: a shunt bank 100 + 50 + 30 (Quad) to ground, and branch L (L_b, fit) → measured branch from `noAIT_trans1_3pri_15sec_trans2_3pri_15sec_direct_LOAD-ATTACHED_...s1p`, sense loop on.
- **C+D 2:18 2-core:** the same chain, with the T-model from `builds_fit.json`.

**Stock.** One counter per HT50 value; the default is 10 × 100, 3 × 50, 2 × 30 (`stock_net.py` `STOCK`). It decrements live as banks change and turns red when overdrawn.

## 6. Chain model and sweep states

- **`Chain`:** an ordered list of blocks from the port to the end. A `ShuntBranch` holds a sub-chain to ground; a `ParallelGroup` holds sub-chains between the same two nodes.
- **Compiler:** `compile(chain, variant) → Netlist` assigns nodes. It is pure, deterministic and unit-tested.
- **`Sweep`:** filename, points (f, Γ), include flag, and a **state**.
  - A state is a set of overrides on the base chain, e.g. `{seriesBank: [1×50, 1×30], shuntBank: [2×100], branch.d: "loop on"}`.
  - Loading a sweep snapshots the current chain as its state, which Matt can edit.
  - The Fit uses each sweep's own state.
- **Reference plane:** the 2026-10-13 sweeps were taken at the AIT-out plane with the VNA calibrated at its port (`SWEEP_NOTES.md` L110). The window applies at that plane directly, with no correction.

## 7. Fit

**Stage 0: variants from a shorted-jumper sweep.**
- For a chosen cable length, fit the jumper L to a sweep taken with the cage coax and jumpers shorted at the board. Optionally fit the length too.
- Defaults are the three recorded variants, used by every downstream fit and prediction (`SWEEP_NOTES.md` L142, L353, L408):

| Cable length | Jumper L | Note |
|---|---|---|
| 1.245 m (VF 0.70) | 342 nH | free fit |
| 1.2825 m | 329 nH | |
| 1.5094 m | 256 nH | flagged "poor fit to the short" |

**Stage 1: cap-free sweep → branch.**
- Build the measured-branch block from the cap-free sweep for each variant.
- Optionally fit the T-model to the same de-embedded data: `calib.fit_one_port` recipe, f_pri fixed at 0, k1 = 0.7, 2–25 MHz, |Z|-weighted residual, the same 8 starting points, log parameters, best of all starts.

**Stage 2: caps-in sweeps → network (`o7_joint.py` / `o7_loopstate.py` recipe).**
- **Free parameters:** L_s, L_b, k_s, k_p, kr.
  - Start [300 nH, 150 nH, 1, 1, 1].
  - Bounds L_s 150–700 nH, L_b −100–600 nH, k_s and k_p 0.8–1.5, kr 0.2–3.
- **Residual:** Γ_model − Γ_meas (real and imaginary stacked) over 12.0 < f < 14.6 MHz, concatenated over every included sweep, each in its own state.
- **Run once per variant.**
- **Loop state:** with the main parameters fixed, fit d (frequency shift, %) or ΔL_b to the loop-on sweep. Bounds as in `o7_loopstate.py`: q in [−200, 400], where q is % for d (d = q/100) or nH for ΔL_b.

**Optimiser.**
- Levenberg–Marquardt with box bounds by projection, numeric Jacobian (central differences, relative step 1e-6) and multi-start support.
- It is not scipy's TRF, so parity is judged on the solution (§14), not on the path taken.

**Outputs, per variant:**
- parameters with approximate standard errors from (JᵀJ)⁻¹;
- rms |ΔΓ| per sweep;
- a measured-vs-model table at 12.9 / 13.1 / 13.3 / 13.45 / 13.56 MHz;
- any parameter pair with |correlation| > 0.95, shown as **ill-determined**, not as a confident value.

## 8. Model variants

A variant is the set of parameters the data cannot separate: {cable length, VF, Z₀, α₁₃, de-embed jumper L_j}. A variant enters the model twice:
1. de-embedding the cap-free sweep into the measured branch;
2. re-embedding every prediction through the cable.

Both uses must take the same variant. Mixing them caused the `o7_caps.py` error (`SWEEP_NOTES.md` L419). Every plotted prediction shows one dot per variant at 13.56 MHz.

## 9. Recommend

**Candidates**
- Every buildable count vector for each bank marked searchable (default: the series and shunt banks).
- Each candidate must fit the bank's slots, and its parts across all searched banks must fit within stock after the parts of banks not searched are reserved.
- Optionally 2-groups-in-series banks (`stock_net.banks`).

**Evaluated per candidate and per variant (fitted parameters held fixed):**

| Quantity | Definition |
|---|---|
| Landing | Z at 13.56 MHz at the AIT-out plane |
| In window | the landing inside the window |
| Drift room up / down (%) | the contiguous in-window frequency band containing 13.56 MHz, searched within 12.5–14.6 MHz: up = (f_hi − 13.56)/13.56·100, down = (13.56 − f_lo)/13.56·100. Upward room matters because heating raises the plate C and moves features down |
| Max cap stress | at the Stress power P (§10) |

`o7_joint.py` takes min/max over all in-window points in the band. For one contiguous band, which is the normal case, this is identical.

**Ranking** (generalises `o7_joint.py`):
1. variants in the window, descending;
2. min(median room-up across variants, 2.5 %), descending;
3. part moves from the current build, ascending.

Part moves = Σ|Δcount| per value per bank. The 2.5 % cap means that once there is enough room, fewer moves wins.

**Display**
- Top 12 rows. Any part over 100 % of rating is red; 80–100 % is amber.
- Clicking a row overlays its curve and per-variant landings on the Smith chart and lists the moves, e.g. "series: remove 1×100; add 1×50 + 1×30".
- **Apply** sets the chain to the pick.

## 10. Stress and flux

**Drive.** P is the power entering the cage coax at the AIT output, as in `rfchain.solve_chain` (`p_ait_out`). The AIT's internal loss is not modelled; an optional series r_a can be added (`rfchain.ait_efficiency`).

**Per cap part**
- The bank current divides in proportion to C within a parallel group.
- Each of 2 groups in series sees half the bank voltage.
- Actual C = k × nominal.
- % of rating = max(V/V_rated, I/I_rated) against the HT50 table. Above 80 % is amber; above 100 % is red.

**Also shown:**
- jumper currents;
- primary current;
- plate voltage (kV rms);
- wire I²R, marked `est`, only where the wire R is an estimate.

**Power split** (cable, cap ESR, R1, core, R2, plate fixture, cube): **T-model mode only.** In measured-branch mode the tool shows the total branch power and says the split cannot be identified from that data.

**Flux and loop voltage** (T-model required):
- B_pk per core [mT] = √2·|V_m| / (ω·N_p·N_c·A_e) × 10³, with A_e = 1.58 × 10⁻⁴ m² (Fair-Rite 5967003801, `rfchain.A_E`).
- Predicted sense-loop V rms = |V_m| / (N_p·N_c) for a 1-turn loop on one core (`rfchain.UnitState.v_loop_rms`). This answers "what scope range do I need" before powering up.
- V_m depends on the leakage split f_pri, which one-port sweeps cannot identify. Flux and loop V are therefore shown as a **range over f_pri ∈ [0, 0.5]**: 0 = all leakage on the secondary (the fits' assumption), 0.5 = equal split. The range is editable.
- In measured-branch mode, the stage-1 T-model of the same cap-free sweep is driven with the branch voltage from the measured-branch solution.
- Measured points from the rig are drawn beside the range, not folded in. Example: ≈0.7 mT at 280 W, from the 10-13 sense loop using B[mT] = 0.105 × V_loop,rms.

**Leakage split from a scope reading.** Matt enters a measured loop V at power P, and the tool solves f_pri in [0, 1] by bisection. If no f_pri in [0, 1] reproduces the reading, it says so: that means the model structure, not the split, is wrong. This directly tests the open "flux reads low" hypothesis (primary-side leakage, secondary near its own resonance).

## 11. Trust cues

- Source badges on every number (§5).
- Variant clusters on every prediction (§8).
- Ill-determined parameter flags (§7).
- A header chip:
  - **"validated"** while every block runs on `fit` values and every bank state is within the cap values that were fitted;
  - **"extrapolating"** as soon as any block uses `est` or `typed` values, or a bank leaves the fitted range.

## 12. Interface

Layout follows `nanovna-web`: a window title bar, then a 3-column grid.

| Column | Contents |
|---|---|
| Left (~250 px) | Project (save, open, recent); Sweeps (list, include ticks, state editor); Stock; Power |
| Middle (~330 px) | Inspector for the selected block (physical / symbol fields, badges, lock / fit toggles); Fit, Recommend and Stress panels as collapsible fieldsets |
| Right (flexible) | Circuit strip on top (chain of block cards, + add, ✕ remove, drag to reorder, ⇄ physical / symbol view); 2×2 resizable plot panes below |

- **Default panes:**
  1. Smith chart with the AIT window shaded and per-variant landings;
  2. |S11| dB;
  3. R and X vs f;
  4. Stress bars.
- Each pane can switch to |Z|, phase, VSWR or reflected-power %.
- Measured sweeps are dashed; predictions are solid.
- **Block cards:** a small drawing in physical view (cap bank as a row of pucks with counts, stack as toroids with N_p:N_s, wire, coax, two plates with a cube); standard symbols in symbol view.
- **Design tokens** are copied from `nanovna-web/src/styles.css`:
  - Avenir Next / Helvetica Neue;
  - grey gradient surfaces `#cfcfcd` / `#e9e9e7` / `#f5f5f3`;
  - edge `#b9b9b6`;
  - accent `#f1d51c`;
  - uppercase 10 px fieldset legends;
  - white plot panes;
  - plus its light/dark toggle.
- Plot drawing (canvas Smith, rectangular plots, markers, resize bars) is adapted from `nanovna-web/src/App.tsx` and `components/`.

## 13. Persistence

- **Project file (`*.rfnm.json`, `schema: "rfnm/1"`):** chain, presets used, stock, window, variants, sweeps (filename + points + state + include), fit results, power, and UI pane choices.
- **Autosave:** the last project goes to `localStorage`; every read and write is wrapped in try/catch, and the app works without it.
- **Import:** `.s1p` via the `nanovna-web` parser. Real files carry `! NanoVNA Web complex sweep` and `# Hz S RI R 50`.

## 14. Testing and validation

Red-green TDD for all non-UI logic. Each layer gates the next.

1. **Engine on circuits with known answers:**
   - series RLC resonance and Q;
   - an ideal transformer scales impedance by n²;
   - a quarter-wave line inverts impedance;
   - embed ∘ deembed = identity;
   - the L-network from `match.l_network` matches to 50 Ω.
2. **Python parity, using fixtures captured from the real code.**
   - `tools/capture_fixtures.py`, run with `uv run --no-project --python 3.12 --with numpy --with scipy`, imports `rfchain.py`, `design.py`, `calib.py` and `stock_net.py` from `MANUAL_MATCHING_NETWORK/2026-10-10_DESIGN_SPACE/`.
   - It writes JSON stamped with each source file's SHA-256.
   - TypeScript must match `input_impedance`, `network_input`, `embed`, `deembed`, `solve_chain` (all currents, voltages, losses, B and loop V) and `design.make_unit` to 1e-9 relative.
   - Fixtures are never hand-written.
3. **Fitter:**
   - synthetic recovery: parameters within 1 % at zero noise and within 3σ at |ΔΓ| noise 0.01;
   - the T-model stage-1 fit on the O7 cap-free sweep reaches `calib.fit_one_port`'s cost within 2 %.
4. **Recommend and Stress:**
   - the candidate count equals the Python enumeration for the same stock and slots;
   - the ranking on the captured fitted models equals the Python ranking (all 209 candidates, top 12 in the same order). 80/180 lands in the window for the two well-fitting cable variants. Where it ranks is reported, not gated: `o7_loopstate.py` scored a fixed candidate list, not the full enumeration;
   - drift room for 80/180 matches the recorded +1.3–1.4 % up / +0.6–0.8 % down (`SWEEP_NOTES.md` L523);
   - Stress matches `solve_chain` per part.
5. **Blind replay on real data (`npm run validate`), the v1 acceptance gate.** It replays the history with the TypeScript tool:

| Step | Fit on | Predict | Recorded Python prediction | Measured |
|---|---|---|---|---|
| 1 | 130/230 + 100/200 | 80/200 | 6.4–6.6 + j12.6 (1.245 / 1.2825 m); 4.8 + j8.0 (1.5094 m) (`SWEEP_NOTES.md` L490) | 5.03 + j4.30 |
| 2 | 130/230 + 100/200 + 80/200, loop d from 80/200 + loop | 80/180 + loop | 6.7–7.2 + j16.9–18.1; 4.9–5.0 + j11.4 (L522) | 7.81 + j27.89 |

   - **Gate:** the TypeScript predictions match the recorded Python predictions within 0.5 Ω in R and in X, for each variant.
   - **Reported, not gated:** the error against the measured values, which states the model's real accuracy.
   - **Also reported, ungated:** C+D, predicting the 2026-10-01 `NET_218_CD_100s_3x100+30p_10-18M_PRE-loop` state from the 2026-09-30 cap-free fit.
   - The run writes `docs/validation/YYYY-MM-DD-validation.md`, which must be read before v1 is called done.

All five 10-13 landings were re-read from the files for this spec (Z at 13.5622 MHz):

| State | Z (Ω) |
|---|---|
| 130/230 | 715.80 + j184.68 |
| 100/200 | 11.47 + j46.47 |
| 80/200 | 5.03 + j4.30 |
| 80/200 + loop | 17.80 + j54.92 |
| 80/180 + loop | 7.81 + j27.89 |

**UI.** Pure logic is extracted and TDD'd: compile, sweep states, stock, ranking, formatting, parsing. The screen gets a scripted walkthrough in the built-in browser:
1. O7 preset;
2. load the 5 sweeps;
3. Fit;
4. Recommend;
5. Stress at 500 W;
6. light and dark.

Each step has a screenshot that Claude views before claiming it works.

**v1 done** = all tests pass, gates 2 and 5 pass, the validation report has been read, and the walkthrough screenshots are clean.

## 15. Data contract (external inputs and their evidence)

| Input | Evidence |
|---|---|
| `.s1p` format | real file header `! NanoVNA Web complex sweep` / `# Hz S RI R 50`; 5,050 points, 1–25 MHz (`2026-10-13_.../single-transformer/noAIT_80ser_200sh_...s1p`) |
| Reference plane = AIT-out | `SWEEP_NOTES.md` L110 |
| Window R 5–17, X +6..+48 | `o7_joint.py` `WIN` |
| HT50 ratings, stock | `model/match.py` `HT50`; `pass5/stock/stock_net.py` `STOCK` |
| Fit recipe, bounds, band | `analysis/o7_joint.py`, `analysis/o7_loopstate.py` |
| Variants | `SWEEP_NOTES.md` L142, L353, L408 |
| T-model, flux, loop V, A_e | `model/rfchain.py` |
| Stack estimate laws | `model/design.py` `Consts`, `make_unit` |
| T-model fit recipe | `model/calib.py` `fit_one_port` |
| C+D T-model preset | `model/builds_fit.json` `CD_0930_load` |
| Loop-state model | `o7_loopstate.py` `shifted`; `SWEEP_NOTES.md` L491–494 |
| Measured flux point | 10-13 sense-loop runs, B = 0.105 × V_loop (`SWEEP_NOTES.md`, power-test entries) |

**Not yet evidenced, so labelled in the UI rather than built on:**
- the f_pri range bound 0.5;
- the wire-inductance estimate for these jumpers;
- the AIT's internal loss.

## 16. Not in v1

- AIT reflection vs drift with the tuner frozen.
- Joint, cube and core heating.
- A live NanoVNA link.
- A free-form schematic canvas.
- Plates computed from applicator geometry (`model/applicator.py`).
- Materials other than Fair-Rite 67.

Each can be added without changing the engine's interfaces.

## 17. Risks

| Risk | Mitigation |
|---|---|
| LM and TRF find different minima | Same start and bounds as the Python; multi-start; parity judged on predictions |
| A frequency shift d pushes f·(1+d) past the sweep edge | Clamp like `np.interp`; flag in the UI |
| The 1.5094 m variant fits the short poorly | Keep it as a variant, flagged; ranking uses the median across variants |
| Matrix conditioning across pF–kV scales | Row scaling and pivoted LU; known-answer tests at real component values |
| Matt reads a prediction for an unbuilt topology as validated | The "extrapolating" chip and `est` badges |
| Accidental public exposure of rig data | Private repo; GitHub repo created only after Matt's OK |

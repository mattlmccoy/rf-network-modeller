# SDD ledger — plan: docs/superpowers/plans/2026-10-14-rf-network-modeller-ui-2a.md

Spec: docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md (read). Plan 1 ledger: docs/superpowers/plans/2026-10-14-rf-network-modeller-core-ledger.md.
Setup: Ruling: briefs applied with the workspace extract.py (verbatim code-block copy, now also matching "`path` (note):" labels); TDD order kept — cost if wrong: none.

## Pre-flight (producer → consumer)
- T2 grid/plotmath/units → T3 (evaluate uses evalGrid? no: example.test uses evalGrid), T4 (PlotPane uses smithXY/windowOutline/s11dB/vswr/rxExtent/spanIndices; LandingStrip uses fmtZ), T6 (blockSummary), T7 (displayUnit/toDisplay/blockSummary), T8 (tagSummary) → consistent.
- T3 state (AppState, Action, reducer, emptyState, variantChain, snapshotState, uniqueSweepId), chainEdit edit ops, evaluate (evaluateVariants, VariantResult), example (exampleState, loadExample, ExampleManifest) → T4 App, T6 CircuitStrip, T7 Inspector, T8 panels → consistent.
- T5 newBlock/PALETTE/NewBlockKind + StackBlock.design → T6 CircuitStrip, T7 Inspector (design) → consistent.
- T4 App placeholders (Circuit, Block, SWEEPS, STOCK lines) → replaced verbatim in T6/T7/T8 → consistent.
- T7 DraftNumberInput → T8 StockPanel → consistent.
- Core (Plan 1) APIs used: compile/outOfRangeAt, inputImpedance, landing/ROOM_SEG/F0, fromFitVars/getParam/withParamValue, applyState/findBlock/updateBlock/mapBlocks/allBlocks, presets incl. O7_FILES — all exist on main → consistent.
Task 1: Ruling: keep one Vite dev server running across the UI tasks (stopped after Task 9) instead of start/stop per task — HMR serves each task's changes; fewer moving parts — cost if wrong: none; .gitignore already had dist/ so it is unchanged
Task 1: browser check — light and dark screenshots viewed: title 'RF NETWORK MODELLER', theme toggle, 3 columns
Task 1: complete (commits 56b4670..b4d41f6, tests: npm test → ℹ duration_ms 5479.091916)
Task 2: complete (commits b4d41f6..771a684, tests: npm test → ℹ duration_ms 5393.4915)
Task 3: Ruling: test compared 250e-9 to the computed 250 * 1e-9 (= 2.5000000000000004e-7); the test now compares to the same product — plan test bug — cost if wrong: none
Task 3: Ruling: patchBlock now prunes fits for removed blocks and variantChain skips fitted values whose block is gone (new test "fitted values for blocks that no longer exist are ignored…") — found by the plan's own review-focus-1 test: emptying the shunt arm left fits pointing at "sh", so the error read "block sh has no parameter k" instead of the real "shunt is empty" — cost if wrong: a stale fit silently stops applying after its block is removed, which is the intended meaning
Task 3: complete (commits 771a684..1ce1d66, tests: npm test → ℹ duration_ms 5221.401416)
Task 4: browser check — landing strip text read: 7.24 + j18.00 in (+1.35/+0.83 %), 6.83 + j16.89 in (+1.42/+0.68 %), 4.98 + j11.52 out, measured 7.81 + j27.89, "2 of 3"; 2×2 panes at 1440×900; variant 1.5094 → green primary, R/X follows; full span 1–25 MHz; dark theme; console: no errors. Screenshots viewed.
Task 4: Ruling: plot legends list the chosen variant first — found in the browser: the legend clipped its last entry, which was the primary (drawn last so it sits on top) — cost if wrong: none (draw order unchanged)
Task 4: observation for Matt: |S11| dB at the AIT-out plane sits near 0 dB (|Γ| ≈ 0.75), so the fixed −40..0 dB axis shows only a small dip; consider auto-ranging in 2b
Task 4: complete (commits 1ce1d66..85fcd87, tests: npm test → ℹ duration_ms 5513.218916)
Task 5: complete (commits 85fcd87..f43a52a, tests: npm test → ℹ duration_ms 6110.639583)
Task 6: browser check — strip order coax / series bank (pucks, 80 pF) / series L / shunt arm group / transformer arm group / open end; symbol view; move L left then right; remove shunt bank → arm pruned, new landing (≈0.31 − j35.3 Ω), no error; reload; add shunt at end → new selected group, "Add inside" offered; console clean. Screenshots viewed.
Task 6: Ruling: card summaries use 4 significant figures (new failing-first test in units.test.ts) — the browser showed fitted values as "586.84826 nH"; the inspector keeps 8 figures for editing — cost if wrong: none
Task 6: Ruling: the plan expected the landing to change when the series L moves before the series bank; it correctly does not — series elements in one run commute (same Σz) — the plan's expectation was wrong, the app is right — cost if wrong: none
Task 6: complete (commits f43a52a..5f085f4, tests: npm test → ℹ duration_ms 6413.335833)
Task 7: browser check — shunt bank inspector: counts 1/1/1, k 1.2343684 FIT; 50 pF → 0 gave card "1×100 + 1×30 = 130 pF" and landing 1.69 − j10.05 / 1.57 − j10.73 / 1.03 − j13.25 Ω = the Step 4 command output exactly; cleared field + Escape reverted to 1 (RF4); series L 586.84843 nH (1.245 m) → 536.15128 nH (1.2825 m), typed 500 → TYPED badge and 500 nH for both variants (RF2); measured branch: capfree.s1p, loop ticked, kr 0.4949 FIT, d 3.3078753 % FIT, ΔL 0 TYPED; console clean. Screenshots viewed.
Task 7: complete (commits 5f085f4..16cdf40, tests: npm test → ℹ duration_ms 5584.99025)
Task 8: browser check — five example sweeps listed with tags ("Series bank 130 pF · Shunt bank 230 pF · loop off"), 80/180 + loop active; Set circuit on 130/230 → cards 130/230 pF, loop off, predictions 327–567 Ω vs measured 715.80 + j184.68 (near the parallel resonance); my-80-200.s1p loaded via DataTransfer → new active row tagged with the current circuit; bad.s1p (75 Ω) → "bad.s1p: Only 50 Ω reference impedance is supported; this file declares 75 Ω.", no row (RF3); stock: circuit 3/0/2 at 130/230, 30 pF on hand 1 → Left −1 red + warning; console clean. Screenshots viewed. (The plan's "1/2/2 in circuit" assumed the as-built state; the check ran after Set circuit 130/230, which uses 3/0/2 — consistent.)
Task 8: complete (commits 16cdf40..e726371, tests: npm test → ℹ duration_ms 4958.182)
Task 9: walkthrough — (1) opening landing 7.24 + j18.00 in / 6.83 + j16.89 in / 4.98 + j11.52 out / measured 7.81 + j27.89; (2) variant 1.5094 → green primary; (3) shunt edit verified in Task 7 (exact match to the computed values); (4) remove series L → 3.18 − j18.43 / 3.16 − j16.35 / 3.52 − j1.63, no error; (5) symbol view; (6) walk-80-200.s1p loaded, measured 5.03 + j4.30; (7) light theme repeat of 1 and 5; (8) console: no errors. Gates: 182/182 tests, tsc clean, build OK, validate exit 0 with docs/validation unchanged.
Task 9: Ruling: leave the Vite dev server running at the end so Matt can try the app in the browser pane straight away (the plan said stop it) — cost if wrong: one idle local process on port 5181 until stopped
Task 9: complete (commits e726371..42594e5, tests: npm test → ℹ duration_ms 5155.707916)
Final review: fresh reviewer (general-purpose, model opus) on 56b4670..42594e5 — verdict "With fixes": 1 Critical, 5 Important, 15 Minor.
Final: fixed C1 focus/blur retypes a fitted value for every variant — test "a commit equal to the displayed value is skipped…" RED→GREEN, suite 187/187; browser: click + Tab on series L keeps FIT and all three landings
Final: fixed I1 decimal entry blocked (ESR, R, custom pF, n, wire length) — DOM attribute, not unit-testable; browser gate: ESR 0.05 accepted (valid=true), landing 7.24 → 7.30 Ω
Final: fixed I2 measured landing from a sweep that never reaches 13.56 MHz — test "the measured landing is null when the sweep has no point near 13.56 MHz" RED→GREEN, suite 187/187; browser: 1–10 MHz sweep reads "no point near 13.56 MHz in this sweep"
Final: fixed I3 open circuit drawn as X = 0 Ω and VSWR 10 — test "rectangular panes gap an open or invalid Z…" RED→GREEN, suite 187/187; browser: open network shows no predicted R/X/VSWR lines, legend "open: no finite R or X", |S11| at the true 0 dB
Final: fixed I4 reused block id rewrites an old sweep tag — test "new block ids never reuse an id that a sweep tag or a fit still refers to" RED→GREEN, suite 187/187
Final: fixed I5 clamped branch data drawn as normal predictions — test "points where a measured branch is read outside its sweep are marked per frequency" RED→GREEN, suite 187/187; browser: d = 50 % → note "outside its sweep from 16.67 to 25.00 MHz", traces faint/dashed above 16.7 MHz
Final: Ruling: I5 fixed now rather than deferred to 2b — spec §4 requires the flag and the fix was small — cost if wrong: none
Final: Ruling: M7 and M15 added to the plan's 2b list rather than fixed — they are 2b trust-chip and layout items — cost if wrong: none (recorded in the plan)
Final: Ruling: declined-to-judge items stand as set aside (2b scope; core data-model and parity choices; verbatim nanovna files; |S11| axis already logged; measured-branch picker; crosshair cursor from the verbatim CSS; prediction-vs-other-state labels; d FIT badge with toggle off; cosmetics; data files) — cost if wrong: each is 2b or documentation
Final: minor (deferred): M1 wire inspector shows "L ≈ NaN nH" at 0 mm and negative L below ~1 mm — show "invalid"
Final: minor (deferred): M2 a missing example file gets Vite's index.html (HTTP 200), so the error lacks the file name — wrap sweepOf parse errors with the file name
Final: minor (deferred): M3 "Reload O7 example" discards edits without asking; in-flight loads are not cancelled
Final: minor (deferred): M4 accessibility — inputs not associated with their labels; group headers not keyboard-focusable
Final: minor (deferred): M5 ideal-transformer n typed as 0 shows 0 while the model keeps the old n
Final: minor (deferred): M6 measured-branch select shows the first option when the branch's sweep id is not loaded
Final: minor (deferred): M7 fits stay FIT after their basis changes (sweep swapped, primitive kind changed) — added to the 2b trust-chip list
Final: minor (deferred): M8 label-only edits re-evaluate 3 × 5,050 points (~40 ms)
Final: minor (deferred): M9 canvas narrower than 60 px throws (no error boundary); no redraw on devicePixelRatio change
Final: minor (deferred): M10 legend overflow check runs after drawing, so long names run off the canvas
Final: minor (deferred): M11 landing-strip measured swatch colour now follows the theme (fixed in passing with I2); dark-mode trace and swatch match
Final: minor (deferred): M12 "N of 3 in the window" counts errored variants as "not inside"
Final: minor (deferred): M13 a custom-pF-only bank shows "empty" art and "empty + 47 pF = 47 pF"
Final: minor (deferred): M14 R/X beyond ±500 Ω and VSWR above 10 are pinned to the axis edge rather than clipped
Final: minor (deferred): M15 spec items missing from both plans — added to the 2b list

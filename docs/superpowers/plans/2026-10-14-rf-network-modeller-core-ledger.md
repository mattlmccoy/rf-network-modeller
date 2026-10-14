# SDD ledger — plan: docs/superpowers/plans/2026-10-14-rf-network-modeller-core.md

Spec: docs/superpowers/specs/2026-10-14-rf-network-modeller-design.md (read).
Setup: Ruling: work on branch feat/core-engine in the new local repo (no worktree) — repo is brand new, local-only, no other sessions touch it; a branch keeps main clean — cost if wrong: none (branch can be renamed/rebased).

## Pre-flight (producer → consumer: what is produced vs consumed; finding)
- T1→all: Complex/cx/ONE/ZERO/OPEN/ops + testutil assertClose/assertNear/pair/fmt → used with same names in T3–T18; consistent.
- T3→T6,T13: solveLinear/solveReal/SingularMatrixError → mna catches SingularMatrixError; lm uses solveReal; consistent.
- T4→T5,T6,T11: M2/Y2/abcdToY/addY/zinTerminated, Cable/coaxY/embed/deembed → consistent.
- T5→T6,T7,T11,T15,T16: Unit/PlateLoad/unitY/unitState(u,y,f,v1,v2)/solveTransformer/unitInputZ → drive passes y as Y2 tuple; consistent.
- T6→T11,T14,T15,T17: Netlist/Element/inputImpedance/solveNetlist → consistent.
- T7 adds ROOT/readFixtureJson to testutil; T8 adds loadFixtureSweep (needs readFileSync import already moved to top in T7) → consistent.
- T8→T10,T11,T14,T16–18: Sweep/zFromGamma/gammaFromZ/nearestIndex/interpClamp/bandIndices/parseS1p → consistent.
- T9→T10,T15,T17: Counts/counts/countsPf/HT50/CAP_VALUES/physicalParts/sumCounts/DEFAULT_STOCK/estimateWire → consistent.
- T10→T11,T12,T15: types + twoTerminalZ/buildBranchTable/branchOutOfRange/groupPf/capBankFarads → consistent.
- T11→T12,T14,T15,T17,T18: compile/evaluate/seriesY/Compiled.runs/twoPorts/branches → consistent.
- T12→T14–T18: state (applyState/findBlock/mapBlocks/allBlocks), params (fromFitVars/toFitVars/refName/ParamRef), presets (o7Chain/o7State/O7_REFS/O7_LOOP_REF/DEFAULT_VARIANTS/O7_FILES incl. shortNew/cdNet/AIT_WINDOW/cdChain) → consistent.
- T13→T14,T16: levenbergMarquardt/paramStats/illDetermined; testutil mulberry32/gauss → consistent.
- T15→T17: drive/reports/maxCapStressPct/DriveError → consistent.
- T16→T18: fitShort → consistent.
- Package test script: T1 runs src only; T18 widens to tools → consistent with plan patch.
Task 1: Ruling: briefs applied with .superpowers/.../extract.py (verbatim code-block copy into labelled paths) — removes hand-transcription errors; TDD order kept (tests written+run red before impl) — cost if wrong: none, files are the brief's text
Task 1: complete (commits a881fb3..d99e98d, tests: npm test → ℹ duration_ms 124.977084)
Task 2: complete (commits d99e98d..e40ce02, tests: npm test → ℹ duration_ms 150.62775)
Task 3: complete (commits e40ce02..88f3957, tests: npm test → ℹ duration_ms 147.99125)
Task 4: complete (commits 88f3957..87f2d54, tests: npm test → ℹ duration_ms 193.908166)
Task 5: complete (commits 87f2d54..f935b3e, tests: npm test → ℹ duration_ms 196.976334)
Task 6: Ruling: assertClose now passes on identical values before computing |a-b| — Infinity−Infinity is NaN, so OPEN could never equal OPEN (plan defect in the T1 helper; the solver output was right) — cost if wrong: none, identical values are equal
Task 6: complete (commits f935b3e..daf2ddf, tests: npm test → ℹ duration_ms 189.073292)
Task 7: complete (commits daf2ddf..0e1711d, tests: npm test → ℹ duration_ms 215.222916)
Task 8: Ruling: real-export test asserts last f = 24997897 Hz (captured from the file) instead of 25e6 — the plan's 25 MHz was a rounded display value; data-contract rule says fixtures come from reality — cost if wrong: none
Task 8: complete (commits 0e1711d..8f7a77b, tests: npm test → ℹ duration_ms 286.033459)
Task 9: complete (commits 8f7a77b..f44ce29, tests: npm test → ℹ duration_ms 379.536209)
Task 10: complete (commits f44ce29..cf8795b, tests: npm test → ℹ duration_ms 420.669)
Task 11: complete (commits cf8795b..f0eebe0, tests: npm test → ℹ duration_ms 437.653417)
Task 12: complete (commits f0eebe0..7195023, tests: npm test → ℹ duration_ms 554.825041)
Task 13: complete (commits 7195023..f40b124, tests: npm test → ℹ duration_ms 630.924917)
Task 14: Ruling: added active-set handling to levenbergMarquardt (Task 13 code) with a new failing-first test — the plan's plain projected LM stalled at 200 iterations when Ls sat on its 150 nH bound (1.5094 m variant: ΔX 0.69 Ω > gate); with the active set it reaches Python's exact solution in 10 iterations — cost if wrong: none observed; all LM tests and parity pass
Task 14: complete (commits f40b124..1c660ba, tests: npm test → ℹ duration_ms 3398.321375)
Task 15: complete (commits 1c660ba..a3259b6, tests: npm test → ℹ duration_ms 3552.462792)
Task 16: complete (commits a3259b6..487d82e, tests: npm test → ℹ duration_ms 5479.580708)
Task 17: complete (commits 487d82e..5b8f63d, tests: npm test → ℹ duration_ms 5806.391541)
Task 18: complete (commits 5b8f63d..822971b, tests: npm test → ℹ duration_ms 5851.2395)
Final review: fresh reviewer (general-purpose, model opus) on a881fb3..822971b — verdict "With fixes": 0 Critical, 6 Important, 13 Minor.
Final: fixed I1 sub-chain with no element silently shorts its node — test "a sub-chain with no series element is refused…" RED→GREEN, suite 151/151
Final: fixed I2 degenerate stamps read as OPEN (zero-length coax/wire, exact cancellation, dangling ideal behind an open, NaN values) — 4 compile tests + 1 drive test RED→GREEN, suite 151/151
Final: fixed I3 duplicate block ids corrupt stress (25% shown vs 199% real) — test "duplicate block ids are refused" RED→GREEN, suite 151/151
Final: fixed I4 primitive L/C fit units — test "fitting a primitive C or L…" RED→GREEN, suite 151/151. Re-graded on evidence: real but milder than filed — with correct synthetic data the old SI units gave C 99.99981 pF (2e-6 rel) and L 300 nH after 83 iterations (vs 5); the reviewer's 160.1 pF repro was a test-construction artifact (array.map(gammaFromZ) passes the index as z0), which I also hit and fixed in the test.
Final: fixed I5 fit with no usable residual reports a perfect fit — tests in lm.test.ts and network.test.ts RED→GREEN (FitError), suite 151/151
Final: fixed I6 branch cache key omits vf/z0/alpha and sweep identity — test "a shared branch cache never mixes variants or sweeps" RED→GREEN, suite 151/151
Final: Ruling: I2 runtime exact-zero run at a single frequency uses a 1e9 S stand-in (identically-zero runs are merged at compile time instead) — exact one-frequency cancellation is measure-zero in floating point; a 1e12 stand-in lost precision (49.95 vs 50 Ω) — cost if wrong: ~1e-9 relative error at that one point
Final: Ruling: I5 badge policy — completed fits keep the 'fit' badge with `converged` exposed, rather than badging only converged fits — no-data fits now throw, which removes the false-green the reviewer found; an unconverged-but-improved fit is still a fit — cost if wrong: Plan 2's trust chip must read `converged` too
Final: Ruling: spec §9 now states the majority filter and "fewer than 12 rows" — matches o7_joint.py and the shipped code — cost if wrong: none (documentation)
Final: Ruling: spec §14.2 now says the capture reproduces the o7_joint/o7_loopstate/stock_net recipes (guarded by the recorded predictions) — matches the code; adding their hashes is deferred as a minor — cost if wrong: drift in those scripts would go unnoticed until the recorded-prediction check fails
Final: Ruling: declined-to-judge items stand as set aside — UI/Plan 2 items (trust chip, measured-vs-model table, project file, grid builder, Z/open primitives, flux UI); positional Touchstone option parsing inherited from nanovna-web per spec §13; recommend run time (~1 s, no target); wire-L / f_pri 0.5 / AIT loss already labelled not evidenced (spec §15); model accuracy vs measurement is reported, not gated (spec §14); Γ = 1 sweep points (speculative); pivot floor only for ≥1e14× impedances (effectively open); LM λ floor (reviewer could not reproduce); calib.fit_one_port internals (external) — cost if wrong: each is a Plan 2 or documentation item, not a wrong number today
Final: minor (deferred): LM `converged = true` when no step is accepted even at iteration 0; add a reason field; fitTModel/fitShort expose no convergence flag
Final: minor (deferred): at-bound parameters get a ± value (e.g. Ls = 150.0000 nH ±17.9 nH on the 1.5094 m fit) with no at-bound flag
Final: minor (deferred): recommend swallows DriveError, so maxStressPct null means "drive failed" or "no rated part"
Final: minor (deferred): drive() with watts ≤ 0 or NaN returns NaN voltages instead of a DriveError
Final: minor (deferred): outOfRangeAt reports disconnected branches, and compile demands their sweep be loaded
Final: minor (deferred): variantFromShort hard-codes z0 = 50 regardless of fitShort's z0
Final: minor (deferred): solveFPri returns the first bracket without flagging other solutions; linspace(a, b, 1) returns NaN
Final: minor (deferred): straightWireL goes negative for very short, many-strand jumpers (l < e·√N·r/2); clamp or flag
Final: minor (deferred): reports(chain, d) takes the chain separately from d.compiled; Drive could carry the chain
Final: minor (deferred): replayPasses returns a vacuous PASS on 0 rows
Final: minor (deferred): spec §14.1 test gaps — RLC Q, L-network vs match.l_network matching to 50 Ω, measured-branch flux checks only finiteness
Final: minor (deferred): capture_fixtures.py should also hash o7_joint.py / o7_loopstate.py / stock_net.py in _sources
Final: minor (deferred): gammaFromZ's optional z0 makes `array.map(gammaFromZ)` silently use the index as Z0 (bit the reviewer's probe and my I4 test); consider a two-function API before Plan 2's UI code

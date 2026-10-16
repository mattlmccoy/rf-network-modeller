# SDD ledger — plan: docs/superpowers/plans/2026-10-15-rf-network-modeller-tutorial.md
Spec: docs/superpowers/specs/2026-10-15-rf-network-modeller-tutorial-design.md
Authority: Matt approved the design in chat and said 'write the spec, then build when done' (spec + plan approval and execution method delegated; native).
Pre-flight: T2 consumes T1 TOURS/stepsFor (match); T3 consumes T1 toursFor/tourById/stepsFor/stepDone/StepCtx/TourId and T2 anchors (match).
Ruling (plan writing): the no-number text check forbids model results (Ω, kHz, nH), not part sizes (100 pF) or thresholds (100 %) — cost if wrong: a stricter regex.
Task 1: Ruling: four 'Open the task' texts got one more sentence each — the plain-text check (>20 chars) caught 'Click “Rig history”.' as too thin; content fixed, test kept — cost if wrong: none.
Task 1: complete (commits 33cf816..c709bf7, tests: npm test → ℹ duration_ms 7303.472417)
Task 2: Ruling: the part editor's anchor is 'editor', not 'part-editor' — the guard reads 'part-' as a drawing-part anchor; the guard found the clash — cost if wrong: none.
Task 2: complete (commits c709bf7..512aaf5, tests: npm test → ℹ duration_ms 7087.535875)
Task 3: Ruling: endTour reloads the remembered project itself instead of calling openExample/openProject — those read the practice flag from a stale closure and would have kept autosave off — cost if wrong: none.
Task 3: Ruling: moveTour reads state/level/tour through a ref so a click step's next step starts from the state after the click handler ran (the click listener closure is registered per step) — cost if wrong: none.
Task 3: Ruling (gate finding): startTour clears any notice ("Tutorial finished" carried into the next tour) — cost if wrong: none.
Task 3: Ruling (gate finding): while touring on a phone the page gets 60vh bottom padding so a target near the end scrolls above the bottom card (Safe-power capacitor line was hidden under it) — cost if wrong: extra blank space during a tour on phones.
Task 3: Ruling (gate finding): the Engineer 'Read the result' step spotlights the first plot pane (PlotPane tour prop), not the whole four-plot grid, which is taller than the window — cost if wrong: one prop.
Task 3: browser gate: banner shows on a fresh library and stays dismissed; every tour walked to the end at Beginner (5), Builder (5) and Engineer (6, incl. rig history) with a spotlight on every step; finish/exit restores MY PROJECT with the notice; library unchanged after every tour (incl. new-network template and rig-history copy); level change mid-tour clamps (5/5 → 3/3); phone: card at the bottom and target above it; opening a file mid-tour ends practice and the file project autosaves; no console errors; screenshots read (tile, use-sweep, Smith chart, phone).
Task 3: complete (commits 512aaf5..3d8cc56, tests: npm test → ℹ duration_ms 7307.049291)
Final review: Opus, 0 Critical, 3 Important (Escape in a number field exits the tour; 'Change it' completes on a no-op blur; anchor guard passes for deleted anchors), 7 Minor. All three Important fixed; minors 4 (Back onto open), 5 (level switch), 6 (stale Saved ✓), 7 (unused anchors, Tour.task) fixed.
Final: fixed I2 no-op blur completes 'Change it' — test 'a blur that commits the same value is not a change…' RED→GREEN, suite 321/321; DraftNumberInput skips an unchanged commit (also stops the guide's false 'Changed'), browser-verified
Final: fixed M4 Back onto 'Open the task' bounced — same test (atTask) RED→GREEN
Final: fixed I3 anchor guard false-pass — stricter line rule; mutation check: deleting data-tour="transformer" now fails the guard; guard then caught the indirect 'predict' anchor, made explicit
Final: fixed I1 Escape exits the tour from a number field — !e.defaultPrevented; browser-verified (tour stays on Planned power)
Final: fixed M5/M6/M7 — rig-history tour ends on leaving Engineer (browser-verified), save status idle in practice, unused anchors exit-tour/tour-banner/learn and Tour.task removed
Final: minor (deferred): practice and tour are separate states that always change together (returnTo could live in tour)
Final: minor (deferred): the overlay re-measures every 200 ms even when nothing moves

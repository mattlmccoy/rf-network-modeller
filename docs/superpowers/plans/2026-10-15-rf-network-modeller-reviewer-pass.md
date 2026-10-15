# Reviewer pass on the live modeller (2026-10-15)

Matt asked for reviewers to go through the app in his place: "do what you think is best… take some reviewers through it."

Base: main 8cda773, live. Branch: `fix/reviewer-pass`.

## Who reviewed

Four independent reviewers ran in parallel. Each UI reviewer had its own browser origin, so their saved projects could not collide.

| Reviewer | Played | Where | Focus |
|---|---|---|---|
| Beginner | First-year ME grad student, new to RF | Live site, Beginner | Can a newcomer answer "can the tuner match it, what next, safe at 500 W?" |
| Builder | The rig owner (ME PhD, not RF) | Dev server, Builder | The whole sweep → next build loop |
| Engineer | RF/EE engineer | Production build, Engineer | Whether numbers, plots and verdicts can be trusted |
| Data auditor | — | Manifest vs the notes in `MANUAL_MATCHING_NETWORK` (read-only) | Rig-history readings, including the four flagged for Matt |

## Data audit

**No sweep kind or capacitor value was wrong.** Nothing contradicted the notes.

**The four flagged readings:**
- **10-01 "PRE-loop" has the loop on: confirmed.** REC L1453 and L1242; the record's own "PRE" means before power.
- **"electrodes_load" = cube: confirmed.** REC L603-604 and L577.
- **09-30 POST-100W went through the tuner: confirmed.** REC L727.
- **10-13 "LOAD ATTACHED": partly supported.** L28 covers only the plates. The two cold-start sweeps are the cube run (L624-625, L650).

**The real problem was the `load` field.** Its terms were undefined and used three ways. Definitions adopted:
- **cube:** powder and cube between connected plates;
- **electrodes:** plates connected, contents not recorded;
- **none:** nothing between the plates.

52 cited edits were applied (`acf7d58`):
- 10-13 cold start → cube;
- 09-30 secondary leads off or removed → none;
- 10-08 empty plates → none;
- 09-29 nocube → unknown;
- the undated 8020LOAD caps sweeps → other, because tuner presence is not recorded;
- caveat notes added; agent working notes removed.

## Fixed

| Finding (reviewer) | Fix |
|---|---|
| Unfitted or known-miss model gives confident verdicts and safe power (Engineer C1) | Unfitted cable assumptions leave the vote and the stress worst case when any is fitted. With none fitted, verdicts and stress are labelled "Estimate (not fitted to a sweep of this circuit)" and shown grey. |
| "The tuner can't match this" is contradicted by the tuner-matched history (Engineer C2) | The window now reads "where the tuner has matched well", per the `AIT_WINDOW` comment ("not an AIT reach limit"). Room is also given in kHz. |
| Headline "It works" while a capacitor is over its rating at 500 W (Beginner, Builder) | The capacitor check at the planned power sits under every verdict. The card says "in range, but a capacitor goes over its rating at 500 W". |
| Measured vs model verdicts disagree across screens (all three UI reviewers) | Every verdict is labelled (your sweep / model / estimate). A measured verdict shows the model's beside it. Suggestions and Try a change are labelled as model results. |
| "Use this" / tried changes leave "Confirmed" on an unbuilt circuit (Builder B1) | "Confirmed" belongs to the confirmed circuit; any change asks again. A loaded sweep tagged with another build is flagged, not offered. |
| Leaving Try a change without Keep keeps the change (Beginner) | Leaving the task puts the circuit back. The guide says so. |
| Measured-only project is a dead end (Beginner B1) | Buttons to the O7 example and a new network. Steps that need a model are hidden. |
| "What to change" offers only worse options and no path to a safe build (Beginner, Builder) | Rows no better than keeping the build on every count are dropped. When stock can't fix it, the guide names the limiting part, the power to run at, and the part to buy. |
| Refit from one build silently replaced the fit (Engineer M3) | A warning for single-build refits. The previous fit can be put back. |
| Imported O7 fits graded their own sweeps as blind (Engineer M5) | The fits record their sweeps (capture_fixtures.py st3 + S80L). 80/180 + loop stays blind. |
| "Rough" agreement called "close enough to rank changes" (Engineer M4) | Reworded: treat the ranking as a direction. Thresholds are unchanged (spec §15.2). |
| Measured landing not shown on plots; room cell empty (Engineer M1) | Measured dot on every pane; room filled. |
| Readout can be one grid step from 13.56 MHz (Engineer M2) | The readout names the nearest point's frequency when it is more than 5 kHz away. |
| Flux range with no limit (Builder M5) | Called a range to compare with core data, not a safe/unsafe call. |
| "O7 as built" drops your refit (Builder) | New template: "A copy of this project's circuit". |
| Beginner sees Engineer plots and fit table (Beginner M5) | Beginner offers only Verdict and Target box. |
| Edited cable assumption keeps a stale default name (Engineer) | Default-named assumptions are renamed with their values. |
| History fetch returning a web page gives a parse error (Engineer) | Named: "the server sent a web page". |
| "variant cable", "loop on", unreadable Past-builds names, wrapping badges, step numbers in the verdict card | Reworded or fixed. |

## Review of the fixes

A fresh reviewer checked the fix branch.

**Critical: the Try-a-change revert could overwrite a just-opened project.** That happened when "Open project" ran mid-trial. Fixed: the revert goes through `revertTrial`, which applies only while the circuit is still the trial's, and only for the project the trial began in. Browser-checked by opening a file mid-trial.

**Important, all fixed:**
- **Autosave kept un-kept trials.** Autosave now writes the circuit from before the trial (`savedState`). Browser-checked: during a trial the saved project holds the pre-trial circuit; after "Keep" it holds the trial.
- **Unfitted assumptions still drove suggestions and the model dot.** The recommender, the agreement check and the target-box point now use only the voting assumptions.
- **The dominated-row filter ignored the ranking.** Rows ranked above the current build are always kept. Below it, a row is kept only with at least 1 percentage point less stress. The filter runs before the 5-row cut.

**Minor, fixed:**
- a retitle that collides with an existing name keeps the old name, so the edit still goes through;
- leftover "can match" wording;
- estimate labels on the model lines;
- the "none" load legend now reads "no load: plates bare or nothing connected to them";
- stale guide state;
- a manifest typo.

## Deferred (not fixed in this pass)

- **Builder:**
  - planned and installed builds as separate saved states (the confirmation reset and the trial revert cover the risk);
  - the drawing preview still shows old values;
  - a refit doesn't list what changed below Engineer level;
  - cable assumptions are unexplained at Builder;
  - guide progress is lost when jumping to Safe at full power;
  - Parts on hand shows no ratings;
  - the page jumps on Undo or Refit;
  - keyboard access to drawing parts.
- **Beginner:**
  - remaining jargon ("Wiring inductance", "Power into the cage", "HT50", "C+D 2:18", "tuner out" in rig labels);
  - one part has three names (Electrode plates / Plates + part / Plates + load);
  - the Home tile promises flux, but the Beginner safe page has none;
  - phone: the part editor opens below the fold;
  - no delete for library projects.
- **Engineer:**
  - a separate "already 50 Ω, no tuner needed" state;
  - interpolating to 13.56 MHz instead of naming the nearest point;
  - stress as a range across assumptions;
  - the schematic says "measured" for a kr/d-scaled branch;
  - agreement thresholds scaled to the window;
  - plot clipping is unmarked;
  - "≥" for room capped at 14.6 MHz;
  - Engineer verdicts omit "depends on the cable assumption";
  - measured-only projects still show the coax and cable-assumption selector;
  - "(poor fit)" is unclear.
- **Data:**
  - 10-06 / 10-07 / 10-08 could carry the C+D preset (judgement; left null);
  - C+D's recorded validation miss is not shown in-app (the estimate label covers it).

## Decisions made for Matt

Each is cheap to reverse.
1. **Window wording.** Was "what the tuner can match"; now "where the tuner has matched well". This changes spec §11's wording because the code's own data contract says the window is not a reach limit. *If wrong:* one line in `words.ts` plus the verdict strings.
2. **Unfitted assumptions don't vote.** They don't count in the stress worst case either, when any assumption is fitted. All-unfitted is an estimate. *If wrong:* a reach-back to the old majority over all three.
3. **Load terms.** As defined above. *If wrong:* the 15 09-30/10-01 "none" entries flip instead of the 3 10-08 ones.
4. **Try a change reverts on leaving,** rather than asking. *If wrong:* a confirm dialog.
5. **Dominated suggestion rows are dropped.** *If wrong:* trade-offs that look worse disappear. Rows with lower stress are kept.
6. **Agreement thresholds kept (3 / 12 Ω); wording softened.** *If wrong:* thresholds scaled to the window.
7. **Refit warning at single-build sweeps,** not "fewer sweeps than free values", which would warn on the canonical 5-sweep O7 refit. *If wrong:* a stricter warning.

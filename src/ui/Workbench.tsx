import { type Dispatch, useEffect, useMemo, useRef, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { applyPicks } from '../recommend/recommend.ts';
import { zFromGamma } from '../io/sweep.ts';
import { type VariantResult, evaluateVariants, measuredLanding } from '../app/evaluate.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { plainRX } from '../app/units.ts';
import { hasModel, trust, trustText } from '../present/circuit.ts';
import { capStress, powerText, powerTone } from '../present/power.ts';
import { fittedVariants, modelVerdict, shownResult } from '../present/show.ts';
import { DRAWING_LABEL, type DrawingKind, type Level, PROFILES, RESULT_LABEL, type ResultKind } from '../present/level.ts';
import { UNKNOWN, landingNearF0, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { Drawing } from './drawing/Drawing.tsx';
import { EngineerPanel } from './EngineerPanel.tsx';
import type { Task, WorkTask } from './Home.tsx';
import { NewNetworkGuide } from './NewNetworkGuide.tsx';
import { NewSweepGuide } from './NewSweepGuide.tsx';
import { SafePowerGuide } from './SafePowerGuide.tsx';
import { type Baseline, TryChangeGuide } from './TryChangeGuide.tsx';
import { PartEditor } from './PartEditor.tsx';
import { TargetBox } from './TargetBox.tsx';
import { NEXT, VerdictCard } from './VerdictCard.tsx';

export interface WorkbenchProps { task: WorkTask; onTask: (t: Task) => void; onNewProject: (s: AppState, next: Task) => void; onOpenExample: () => void; projectId: string | null; onTrial: (b: Baseline | null) => void; state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

const DRAWINGS: readonly DrawingKind[] = ['flow', 'hardware', 'schematic'];
const RESULTS: readonly ResultKind[] = ['verdict', 'target', 'plots'];
/** Beginner gets no Engineer plots (cable-assumption names, fit table). */
const resultsFor = (level: Level): readonly ResultKind[] => (level === 'beginner' ? RESULTS.slice(0, 2) : RESULTS);

export function Workbench({ task, onTask, onNewProject, onOpenExample, projectId, onTrial, state, dispatch, level, grid, results, caches, theme }: WorkbenchProps) {
  const [drawing, setDrawing] = useState<DrawingKind | null>(null);
  const [result, setResult] = useState<ResultKind | null>(null);
  useEffect(() => {
    setDrawing(null);
    setResult(null);
  }, [level]);
  const [preview, setPreview] = useState<Record<string, Pick> | null>(null);
  useEffect(() => {
    setPreview(null);
  }, [state.chain]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const baseRef = useRef(baseline);
  baseRef.current = baseline;
  const pidRef = useRef(projectId);
  pidRef.current = projectId;
  // A change tried here is a trial: leaving the task without "Keep this change" puts the circuit back (reviewer pass). The
  // revert is guarded twice so it can never land on another project: only for the project the trial began in, and only
  // while the circuit is still the trial's (revertTrial; fix review C1).
  useEffect(() => {
    if (task !== 'tryChange') return undefined;
    const started = projectId;
    setBaseline({ chain: latest.current.chain, fits: latest.current.fits });
    return () => {
      const b = baseRef.current;
      const s = latest.current;
      if (b && started === pidRef.current && s.chain !== b.chain) dispatch({ type: 'revertTrial', trial: s.chain, chain: b.chain, fits: b.fits });
      setBaseline(null);
      onTrial(null);
    };
  }, [task, projectId]);
  useEffect(() => {
    onTrial(baseline);
  }, [baseline]);
  const baseResults = useMemo(
    () => (baseline && (baseline.chain !== state.chain || baseline.fits !== state.fits) ? evaluateVariants({ ...state, chain: baseline.chain, fits: baseline.fits }, grid) : null),
    [baseline, state.chain, state.fits, grid],
  );
  const before = baseResults?.[state.primary]?.landing?.z ?? null;
  const beforeVerdict = baseResults && baseline ? modelVerdict(baseResults, state.window, state.primary, fittedVariants({ variants: state.variants, fits: baseline.fits })) : null;
  const ghost = useMemo(() => (preview ? evaluateVariants({ ...state, chain: applyPicks(state.chain, preview) }, grid)[state.primary]?.landing?.z ?? null : null), [preview, state, grid]);
  const highlight = preview
    ? Object.keys(preview).filter((id) => {
      const b = findBlock(state.chain, id);
      return b?.type === 'capBank' && JSON.stringify(b.counts) !== JSON.stringify(preview[id].counts);
    })
    : [];
  const view = useMemo(() => variantChain(state, state.primary), [state]);
  const verdicts = useMemo(() => results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, state.window))), [results, state.window]);
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const measuredV = useMemo(() => (active ? verdictOf(landingNearF0(active.f, active.gamma.map((g) => zFromGamma(g)), state.window), state.window) : null), [active, state.window]);
  const shown = shownResult(state, verdicts, measuredV);
  const model = hasModel(state.chain);
  const t = trust(state.chain, state.tagged);
  const note = model ? trustText(t, 'builder') : null;
  const modelError = results.find((r) => r.error)?.error ?? null;
  const clamped = results.some((r) => r.outOfRange);
  const dKind = drawing ?? PROFILES[level].drawing;
  const rKind = result ?? PROFILES[level].result;
  const tone = shown.estimate ? 'unknown' : toneOf(shown.v.state);
  const lvl = level === 'beginner' ? 'builder' : level;
  const source = shown.source === 'measured' ? 'Your sweep' : shown.estimate ? 'Estimate (not fitted to a sweep of this circuit)' : 'Model';
  const line = `${source}: ${verdictText(shown.v, lvl, shown.c)}`;
  const modelNow = useMemo(() => (model ? modelVerdict(results, state.window, state.primary, fittedVariants(state)) : null), [model, results, state.window, state.primary, state.variants, state.fits]);
  const power = useMemo(() => (model ? capStress(state, grid, state.powerW, caches) : null), [model, state.chain, state.fits, state.variants, state.sweeps, state.powerW, grid]);
  const over = power !== null && power.worstPct !== null && power.worstPct >= 100;
  const matched = shown.v.state === 'little' || shown.v.state === 'some' || shown.v.state === 'plenty';
  const next = !model
    ? (Object.keys(state.sweeps).length ? 'Measurements only: open the O7 example or start a new network to get predictions and suggestions.' : 'Add parts in “Start a new network” to get a prediction.')
    : over && matched ? `In the tuner's good range, but a capacitor ${power?.estimate ? 'may go' : 'goes'} over its rating at ${state.powerW} W: see “Safe at full power?”.` : NEXT[shown.v.state];
  const m = active ? measuredLanding(active) : null;
  // the model point drawn is the voting verdict's, so an unfitted chosen assumption never draws a different answer (fix review I2)
  const modelZ = (shown.source === 'predicted' ? shown.v.z : modelNow?.v.z) ?? null;
  const nearest = m && Math.abs(m.f - 13.56e6) > 5e3 ? ` (nearest point, ${(m.f / 1e6).toFixed(3)} MHz)` : '';
  const tag = state.tagged.find((x) => x.sweepId === state.activeSweep);

  return (
    <main className="workbench">
      <div className="wb-main">
        <section className="panel">
          <header className="panel-head">
            <h3>Your circuit{dKind === 'flow' ? '' : ': click any part to change it'}</h3>
            <label className="override">Drawing <select value={dKind} onChange={(e) => setDrawing(e.target.value as DrawingKind)}>{DRAWINGS.map((k) => <option key={k} value={k}>{DRAWING_LABEL[k]}</option>)}</select></label>
          </header>
          <Drawing kind={dKind} chain={view} selected={state.selected} highlight={highlight} onSelect={(id) => dispatch({ type: 'select', id })} cableM={state.variants[state.primary].cable.length} tuner={{ text: verdictText(shown.v, 'beginner'), tone }} />
        </section>
        <section className="panel">
          <header className="panel-head">
            <h3>{shown.source === 'measured' ? 'Your sweep: where' : model ? 'Predicted: where' : 'Where'} the tuner lands at 13.56 MHz</h3>
            <label className="override">Result <select value={rKind} onChange={(e) => setResult(e.target.value as ResultKind)}>{resultsFor(level).map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}</select></label>
          </header>
          {modelError ? <p className="bad">The model can't evaluate this circuit: {modelError}</p> : null}
          {model ? null : (
            <>
              <p>{Object.keys(state.sweeps).length ? 'This project holds measured sweeps only; there is no circuit model to predict from.' : 'This project has no circuit model yet: add parts to get a prediction.'}</p>
              <div className="row"><button onClick={onOpenExample}>Open the O7 example</button><button onClick={() => onTask('newNetwork')}>Start a new network</button></div>
            </>
          )}
          {rKind === 'verdict' && (model || shown.source === 'measured') ? (
            <VerdictCard text={verdictText(shown.v, 'beginner')} tone={tone} next={next} trustNote={model && shown.source !== 'measured' ? trustText(t, 'beginner') : null}
              label={shown.source === 'measured' ? 'From your sweep' : shown.estimate ? 'Estimate: this circuit is not fitted to any of its sweeps' : 'Predicted by the model'} />
          ) : null}
          {rKind === 'target' ? <TargetBox window={state.window} measured={m?.z ?? null} measuredLabel={tag?.label ?? active?.name ?? ''} predicted={modelZ} ghost={task === 'tryChange' ? before : ghost} ghostLabel={task === 'tryChange' ? 'before the change' : 'with the change'} /> : null}
          {rKind !== 'verdict' ? <p className={`verdict-line ${tone}`}>{line}</p> : null}
          {rKind !== 'verdict' && shown.source === 'measured' && modelNow ? <small>{fittedVariants(state).some(Boolean) ? 'Model' : 'Estimate'} for this build: {verdictText(modelNow.v, lvl, modelNow.c)}</small> : null}
          {power ? <p className={`verdict-line ${powerTone(power)}`}>{powerText(power, level)}</p> : null}
          {rKind === 'target' ? <p className="rx-readout">At the tuner, 13.56 MHz. {active ? `Your sweep${nearest}: ${plainRX(m?.z ?? null)}. ` : ''}{model ? `${shown.estimate ? 'Estimate' : 'Model'}: ${plainRX(modelZ)}.` : ''}</p> : null}
          {rKind === 'plots' ? <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} /> : null}
          {rKind !== 'verdict' && note ? <small>{note}</small> : null}
          {rKind !== 'verdict' && clamped ? <small className="warn-text"> The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side">
        {state.selected ? <PartEditor state={state} dispatch={dispatch} level={level} /> : null}
        {task === 'newSweep' ? <NewSweepGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} verdict={shown.v.state} preview={preview} onPreview={setPreview} onSafePower={() => onTask('safePower')} power={power} /> : null}
        {task === 'tryChange' && baseline ? <TryChangeGuide state={state} dispatch={dispatch} level={level} baseline={baseline} onKeep={() => setBaseline({ chain: state.chain, fits: state.fits })} verdictLine={modelNow ? verdictText(modelNow.v, level, modelNow.c) : verdictText(shown.v, level, shown.c)} estimate={!fittedVariants(state).some(Boolean)} beforeLine={beforeVerdict ? verdictText(beforeVerdict.v, level, beforeVerdict.c) : null} /> : null}
        {task === 'safePower' && power ? <SafePowerGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} cs={power} /> : null}
        {task === 'safePower' && !model ? <section className="panel guide"><h3>Guide</h3><p>{Object.keys(state.sweeps).length ? 'This project holds measured sweeps only, so there is no circuit to check at full power.' : 'This project has no circuit model yet, so there is nothing to check at full power.'}</p></section> : null}
        {task === 'newNetwork' ? <NewNetworkGuide state={state} dispatch={dispatch} level={level} onNewProject={onNewProject} verdictLine={modelNow ? `${fittedVariants(state).some(Boolean) ? '' : 'Estimate (not fitted to a sweep of this circuit): '}${verdictText(modelNow.v, level, modelNow.c)}` : ''} /> : null}
      </aside>
    </main>
  );
}

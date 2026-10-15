import { type Dispatch, useEffect, useMemo, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { applyPicks } from '../recommend/recommend.ts';
import { zFromGamma } from '../io/sweep.ts';
import { type VariantResult, evaluateVariants, measuredLanding } from '../app/evaluate.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { activeIsMeasured, trust, trustText } from '../present/circuit.ts';
import { DRAWING_LABEL, type DrawingKind, type Level, PROFILES, RESULT_LABEL, type ResultKind } from '../present/level.ts';
import { UNKNOWN, combine, landingNearF0, representative, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { Drawing } from './drawing/Drawing.tsx';
import { EngineerPanel } from './EngineerPanel.tsx';
import { NewSweepGuide } from './NewSweepGuide.tsx';
import { PartEditor } from './PartEditor.tsx';
import { TargetBox } from './TargetBox.tsx';
import { VerdictCard } from './VerdictCard.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

const DRAWINGS: readonly DrawingKind[] = ['flow', 'hardware', 'schematic'];
const RESULTS: readonly ResultKind[] = ['verdict', 'target', 'plots'];

export function Workbench({ state, dispatch, level, grid, results, caches, theme }: WorkbenchProps) {
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
  const ghost = useMemo(() => (preview ? evaluateVariants({ ...state, chain: applyPicks(state.chain, preview) }, grid)[state.primary]?.landing?.z ?? null : null), [preview, state, grid]);
  const highlight = preview
    ? Object.keys(preview).filter((id) => {
      const b = findBlock(state.chain, id);
      return b?.type === 'capBank' && JSON.stringify(b.counts) !== JSON.stringify(preview[id].counts);
    })
    : [];
  const view = useMemo(() => variantChain(state, state.primary), [state]);
  const verdicts = useMemo(() => results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, state.window))), [results, state.window]);
  const combined = combine(verdicts.map((v) => v.state));
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const measuredV = useMemo(() => (active ? verdictOf(landingNearF0(active.f, active.gamma.map((g) => zFromGamma(g)), state.window), state.window) : null), [active, state.window]);
  // The measured verdict applies only while the circuit is the one the active sweep was taken on (spec §7.4).
  const shown = activeIsMeasured(state.chain, state.tagged, state.activeSweep) && measuredV
    ? { v: measuredV, c: undefined, source: 'measured' as const }
    : { v: representative(verdicts, state.primary, combined.state), c: combined, source: 'predicted' as const };
  const t = trust(state.chain, state.tagged);
  const modelError = results.find((r) => r.error)?.error ?? null;
  const clamped = results.some((r) => r.outOfRange);
  const dKind = drawing ?? PROFILES[level].drawing;
  const rKind = result ?? PROFILES[level].result;
  const tone = toneOf(shown.v.state);
  const line = verdictText(shown.v, level === 'beginner' ? 'builder' : level, shown.c);
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
            <h3>{shown.source === 'measured' ? 'Your sweep' : 'Predicted'}: where the tuner lands at 13.56 MHz</h3>
            <label className="override">Result <select value={rKind} onChange={(e) => setResult(e.target.value as ResultKind)}>{RESULTS.map((k) => <option key={k} value={k}>{RESULT_LABEL[k]}</option>)}</select></label>
          </header>
          {modelError ? <p className="bad">The model can't evaluate this circuit: {modelError}</p> : null}
          {rKind === 'verdict' ? <VerdictCard text={verdictText(shown.v, 'beginner')} tone={tone} source={shown.source} trustNote={trustText(t, 'beginner')} state={shown.v.state} /> : null}
          {rKind === 'target' ? <TargetBox window={state.window} measured={active ? measuredLanding(active)?.z ?? null : null} measuredLabel={tag?.label ?? active?.name ?? ''} predicted={results[state.primary]?.landing?.z ?? null} ghost={ghost} /> : null}
          {rKind !== 'verdict' ? <p className={`verdict-line ${tone}`}>{line}</p> : null}
          {rKind === 'plots' ? <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} /> : null}
          {rKind !== 'verdict' && trustText(t, 'builder') ? <small>{trustText(t, 'builder')}</small> : null}
          {rKind !== 'verdict' && clamped ? <small className="warn-text"> The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side">
        {state.selected ? <PartEditor state={state} dispatch={dispatch} level={level} /> : null}
        <NewSweepGuide state={state} dispatch={dispatch} level={level} grid={grid} caches={caches} combined={combined} preview={preview} onPreview={setPreview} />
      </aside>
    </main>
  );
}

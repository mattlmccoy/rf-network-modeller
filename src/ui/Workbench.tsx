import { type Dispatch, useEffect, useMemo, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { VariantResult } from '../app/evaluate.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { DRAWING_LABEL, type DrawingKind, type Level, PROFILES } from '../present/level.ts';
import { UNKNOWN, combine, representative, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { Drawing } from './drawing/Drawing.tsx';
import { EngineerPanel } from './EngineerPanel.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

const DRAWINGS: readonly DrawingKind[] = ['flow', 'hardware', 'schematic'];

export function Workbench({ state, dispatch, level, grid, results, theme }: WorkbenchProps) {
  const [drawing, setDrawing] = useState<DrawingKind | null>(null);
  useEffect(() => { setDrawing(null); }, [level]);
  const view = useMemo(() => variantChain(state, state.primary), [state]);
  const verdicts = results.map((r) => (r.error ? UNKNOWN : verdictOf(r.landing, state.window)));
  const combined = combine(verdicts.map((v) => v.state));
  const rep = representative(verdicts, state.primary, combined.state);
  const dKind = drawing ?? PROFILES[level].drawing;
  const clamped = results.some((r) => r.outOfRange);
  return (
    <main className="workbench">
      <div className="wb-main">
        <section className="panel">
          <header className="panel-head">
            <h3>Your circuit{dKind === 'flow' ? '' : ': click any part to change it'}</h3>
            <label className="override">Drawing <select value={dKind} onChange={(e) => setDrawing(e.target.value as DrawingKind)}>{DRAWINGS.map((k) => <option key={k} value={k}>{DRAWING_LABEL[k]}</option>)}</select></label>
          </header>
          <Drawing kind={dKind} chain={view} selected={state.selected} highlight={[]} onSelect={(id) => dispatch({ type: 'select', id })} cableM={state.variants[state.primary].cable.length} tuner={{ text: verdictText(rep, 'beginner'), tone: toneOf(rep.state) }} />
        </section>
        <section className="panel">
          <header className="panel-head"><h3>Where the tuner lands at 13.56 MHz</h3></header>
          <EngineerPanel state={state} dispatch={dispatch} grid={grid} results={results} theme={theme} />
          {clamped ? <small className="warn-text">The model reads the measured part outside its sweep here; treat it as rough.</small> : null}
        </section>
      </div>
      <aside className="wb-side" />
    </main>
  );
}

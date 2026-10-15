import type { Dispatch } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { VariantResult } from '../app/evaluate.ts';
import type { Action, AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import { EngineerPanel } from './EngineerPanel.tsx';

export interface WorkbenchProps { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; results: VariantResult[]; caches: BranchCache[]; theme: 'light' | 'dark' }

export function Workbench({ state, dispatch, grid, results, theme }: WorkbenchProps) {
  const clamped = results.some((r) => r.outOfRange);
  return (
    <main className="workbench">
      <div className="wb-main">
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

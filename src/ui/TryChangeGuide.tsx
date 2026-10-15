import type { Dispatch, ReactNode } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { trust, trustText } from '../present/circuit.ts';
import { tryChangeStatus } from '../present/guide.ts';
import type { Level } from '../present/level.ts';

export interface Baseline { chain: Chain; fits: AppState['fits'] }

/** "Try a change first" (spec §8.2): pick a part, change it, see before and after, then keep or undo. */
export function TryChangeGuide({ state, dispatch, level, baseline, onKeep, verdictLine }: { state: AppState; dispatch: Dispatch<Action>; level: Level; baseline: Baseline; onKeep: () => void; verdictLine: string }) {
  const changed = baseline.chain !== state.chain || baseline.fits !== state.fits;
  const status = tryChangeStatus(state.selected !== null, changed);
  const note = trustText(trust(state.chain, state.tagged), level);
  const step = (n: number, title: string, body: ReactNode): ReactNode => (
    <section className={`step ${status[n]}`} key={n}>
      <h4><span className="step-mark">{status[n] === 'done' ? '✓' : n + 1}</span>{title}</h4>
      {status[n] === 'waiting' ? null : body}
    </section>
  );
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(0, 'Pick a part on the drawing', <p>{state.selected ? `Selected: ${findBlock(state.chain, state.selected)?.label ?? state.selected}.` : 'Click a part in the drawing.'}</p>)}
      {step(1, 'Change it', <p>{changed ? 'Changed. The drawing and the result show the new circuit.' : 'Edit it in the panel that opens beside the drawing.'}</p>)}
      {step(2, 'What it does', (
        <>
          <p>{verdictLine}</p>
          {note ? <small>{note}</small> : null}
          {level === 'builder' ? <small>The dashed ring in the target box marks where it was before the change.</small> : null}
          <div className="row">
            <button onClick={onKeep}>Keep this change</button>
            <button onClick={() => dispatch({ type: 'load', state: { ...state, chain: baseline.chain, fits: baseline.fits } })}>Undo</button>
          </div>
        </>
      ))}
    </section>
  );
}

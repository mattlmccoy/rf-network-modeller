import { type Dispatch, useState } from 'react';
import type { Sweep } from '../io/sweep.ts';
import type { Action, AppState } from '../app/state.ts';
import { sweepFromFile, sweepLabel } from '../app/sweepFile.ts';
import { tagSummary } from '../app/units.ts';

export function SweepsPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [error, setError] = useState<string | null>(null);
  async function onFiles(files: FileList | null): Promise<void> {
    setError(null);
    const taken: Record<string, Sweep> = { ...state.sweeps };
    const problems: string[] = [];
    for (const file of Array.from(files ?? [])) {
      try {
        const sweep = sweepFromFile(file.name, await file.text(), taken);
        taken[sweep.id] = sweep;
        dispatch({ type: 'addSweep', sweep, label: sweepLabel(file.name) });
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }
    if (problems.length) setError(problems.join(' · '));
  }
  return (
    <div className="sweeps">
      <label className="file-picker">Load .s1p sweep(s)…<input type="file" accept=".s1p" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
      {error ? <small className="bad">{error}</small> : null}
      <small>A loaded sweep is tagged with the circuit as it is now. If a tag is wrong, set the circuit to match and press Re-tag.</small>
      <div className="sweep-list">
        {state.tagged.map((t) => (
          <div className={`sweep-row ${state.activeSweep === t.sweepId ? 'active' : ''}`} key={t.sweepId}>
            <input type="radio" name="active-sweep" checked={state.activeSweep === t.sweepId} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: t.sweepId })} title="Show this sweep" />
            <label className="sweep-name"><input type="checkbox" checked={t.include} onChange={() => dispatch({ type: 'toggleInclude', sweepId: t.sweepId })} title="Use in refits" /> {t.label}</label>
            <button onClick={() => dispatch({ type: 'applySweepState', sweepId: t.sweepId })} title="Set the circuit to the build this sweep was taken on">Set circuit</button>
            <button onClick={() => dispatch({ type: 'retagSweep', sweepId: t.sweepId })} title="This sweep was taken on the circuit as it is now">Re-tag</button>
            <button className="marker-remove" onClick={() => dispatch({ type: 'removeSweep', sweepId: t.sweepId })} aria-label={`Remove ${t.label}`}>×</button>
            <small className="sweep-tag">{tagSummary(state.chain, t.state)}</small>
          </div>
        ))}
      </div>
      <label className="check-row"><input type="radio" name="active-sweep" checked={state.activeSweep === null} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: null })} /> Show no sweep</label>
    </div>
  );
}

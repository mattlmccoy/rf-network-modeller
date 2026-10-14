import { type Dispatch, useState } from 'react';
import { parseS1p } from '../io/s1p.ts';
import type { Sweep } from '../io/sweep.ts';
import { type Action, type AppState, uniqueSweepId } from '../app/state.ts';
import { tagSummary } from '../app/units.ts';

export function SweepsPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [error, setError] = useState<string | null>(null);
  async function onFiles(files: FileList | null): Promise<void> {
    setError(null);
    const taken: Record<string, Sweep> = { ...state.sweeps };
    const problems: string[] = [];
    for (const file of Array.from(files ?? [])) {
      try {
        const t = parseS1p(await file.text());
        const id = uniqueSweepId(taken, file.name);
        const sweep: Sweep = { id, name: file.name, f: t.f, gamma: t.gamma };
        taken[id] = sweep;
        dispatch({ type: 'addSweep', sweep, label: file.name.replace(/\.s1p$/i, '') });
      } catch (e) {
        problems.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (problems.length) setError(problems.join(' · '));
  }
  return (
    <fieldset>
      <legend>Sweeps</legend>
      <label className="file-picker">Load .s1p sweep(s)…<input type="file" accept=".s1p" multiple onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
      {error ? <small className="bad">{error}</small> : null}
      <small>A loaded sweep is tagged with the circuit as it is now, so set the circuit to match that build first.</small>
      <div className="sweep-list">
        {state.tagged.map((t) => (
          <div className={`sweep-row ${state.activeSweep === t.sweepId ? 'active' : ''}`} key={t.sweepId}>
            <input type="radio" name="active-sweep" checked={state.activeSweep === t.sweepId} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: t.sweepId })} title="Show on the plots" />
            <label className="sweep-name"><input type="checkbox" checked={t.include} onChange={() => dispatch({ type: 'toggleInclude', sweepId: t.sweepId })} title="Use in fits (Plan 2b)" /> {t.label}</label>
            <button onClick={() => dispatch({ type: 'applySweepState', sweepId: t.sweepId })} title="Set the circuit to the state this sweep was taken in">Set circuit</button>
            <button className="marker-remove" onClick={() => dispatch({ type: 'removeSweep', sweepId: t.sweepId })} aria-label={`Remove ${t.label}`}>×</button>
            <small className="sweep-tag">{tagSummary(state.chain, t.state)}</small>
          </div>
        ))}
      </div>
      <label className="check-row"><input type="radio" name="active-sweep" checked={state.activeSweep === null} onChange={() => dispatch({ type: 'setActiveSweep', sweepId: null })} /> Show no measured sweep</label>
    </fieldset>
  );
}

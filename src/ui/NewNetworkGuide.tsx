import { type Dispatch, type ReactNode, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import { type NewBlockKind, type Placement, canMove, newBlock } from '../app/chainEdit.ts';
import { loadExample } from '../app/example.ts';
import { type Action, type AppState, reservedIds } from '../app/state.ts';
import { TEMPLATES, type TemplateKind, fromTemplate } from '../app/templates.ts';
import { hasModel } from '../present/circuit.ts';
import type { Level } from '../present/level.ts';
import { PLACEMENT_LABEL, paletteFor, placementsFor } from '../present/palette.ts';
import type { Task } from './Home.tsx';
import { RigSettings } from './RigSettings.tsx';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** "Start a new network" (spec §8.4): a starting point, then add, remove and reorder parts; Engineer also sets the rig. */
export function NewNetworkGuide({ state, dispatch, level, onNewProject, verdictLine }: { state: AppState; dispatch: Dispatch<Action>; level: Level; onNewProject: (s: AppState, next: Task) => void; verdictLine: string }) {
  const palette = paletteFor(level);
  const [kind, setKind] = useState<NewBlockKind>(palette[0].kind);
  const [where, setWhere] = useState<Placement>('inline');
  const [sweepId, setSweepId] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Nothing edits a project until the user picks a starting point here (final review I5).
  const [started, setStarted] = useState(false);
  const sel = state.selected ? findBlock(state.chain, state.selected) : undefined;
  const places = placementsFor(level).filter((p) => sel || p !== 'parallel');
  const k = palette.some((p) => p.kind === kind) ? kind : palette[0].kind;
  const w = places.includes(where) ? where : 'inline';
  const sweeps = Object.values(state.sweeps);
  const sw = sweeps.some((x) => x.id === sweepId) ? sweepId : sweeps[0]?.id ?? '';
  const start = async (t: TemplateKind): Promise<void> => {
    try {
      setError(null);
      onNewProject(fromTemplate(t, t === 'o7' ? await loadExample() : t === 'copy' ? state : undefined), 'newNetwork');
      setStarted(true);
    } catch (e) {
      setError(`Couldn't start from that template: ${message(e)}`);
    }
  };
  const add = (): void => dispatch({ type: 'place', targetId: sel?.id ?? null, where: w, block: newBlock(state.chain, k, k === 'measuredBranch' ? sw : '', reservedIds(state)) });
  const step = (n: number, title: string, body: ReactNode, live = true, anchor?: string): ReactNode => (
    <section className={`step ${live ? 'active' : 'waiting'}`} key={n} data-tour={anchor}><h4><span className="step-mark">{n}</span>{title}</h4>{live ? body : null}</section>
  );
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(1, 'Pick a starting point', (
        <>
          <p>A template starts a new project; the one open now stays in Past builds.</p>
          <div className="row">{TEMPLATES.map((t) => <button key={t.kind} data-tour={t.kind === 'copy' ? 'tpl-copy' : undefined} onClick={() => { void start(t.kind); }}>{t.label}</button>)}</div>
          <button disabled={started} onClick={() => setStarted(true)}>Keep working on "{state.chain.name}"</button>
          {error ? <p className="bad">{error}</p> : null}
          {started ? <div className="form-row"><label>Project name</label><input value={state.chain.name} onChange={(e) => dispatch({ type: 'setName', name: e.target.value })} /></div> : null}
        </>
      ))}
      {step(2, 'Add, remove and reorder parts', (
        <>
          <p>{sel ? `Selected: ${sel.label}. A new part goes next to it.` : 'Nothing selected: a new part goes at the end. Click a part in the drawing to place it there instead.'}</p>
          <div className="form-row"><label>Part</label><select value={k} onChange={(e) => setKind(e.target.value as NewBlockKind)}>{palette.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}</select></div>
          {k === 'measuredBranch' ? (
            <div className="form-row"><label>Measured with</label>{sweeps.length ? <select value={sw} onChange={(e) => setSweepId(e.target.value)}>{sweeps.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <small>Load the part's sweep first (Sweeps).</small>}</div>
          ) : null}
          <div className="form-row"><label>Where</label><select value={w} onChange={(e) => setWhere(e.target.value as Placement)}>{places.map((p) => <option key={p} value={p}>{sel ? PLACEMENT_LABEL[p] : p === 'inline' ? 'At the end' : 'At the end, to ground'}</option>)}</select></div>
          <button data-tour="add-part" disabled={k === 'measuredBranch' && !sw} onClick={add}>Add the part</button>
          {sel ? (
            <div className="row" data-tour="move">
              <button disabled={!canMove(state.chain, sel.id, -1)} onClick={() => dispatch({ type: 'move', id: sel.id, dir: -1 })}>Move earlier</button>
              <button disabled={!canMove(state.chain, sel.id, 1)} onClick={() => dispatch({ type: 'move', id: sel.id, dir: 1 })}>Move later</button>
              <button data-tour="remove" onClick={() => dispatch({ type: 'remove', id: sel.id })}>Remove {sel.label}</button>
            </div>
          ) : null}
        </>
      ), started)}
      {level === 'engineer' ? step(3, 'Rig settings', <RigSettings state={state} dispatch={dispatch} />, started) : null}
      {step(level === 'engineer' ? 4 : 3, 'What it predicts', <p>{hasModel(state.chain) ? verdictLine : 'Add parts to get a prediction.'}</p>, true, 'predict')}
    </section>
  );
}

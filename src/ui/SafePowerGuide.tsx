import { type Dispatch, useMemo, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import type { Level } from '../present/level.ts';
import { capStress, powerText } from '../present/power.ts';
import { fPriSolutions, fitBranchTModel, transformerView } from '../present/transformer.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

/** Never green while a current-carrying part has no rating (review I6). */
const tone = (pct: number | null, unrated: number): string => (pct === null ? 'unknown' : pct >= 100 ? 'bad' : unrated > 0 ? 'unknown' : pct >= 80 ? 'warn' : 'good');
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function TurnsForm({ onSave }: { onSave: (t: { nP: number; nS: number; nC: number }) => void }) {
  const [t, setT] = useState({ nP: 3, nS: 15, nC: 4 });
  return (
    <>
      <p>Flux needs the transformer's turns and core count.</p>
      <div className="form-row"><label>Primary turns</label><DraftNumberInput min="1" step="1" value={t.nP} onCommit={(n) => setT({ ...t, nP: Math.max(1, Math.round(n)) })} /></div>
      <div className="form-row"><label>Secondary turns</label><DraftNumberInput min="1" step="1" value={t.nS} onCommit={(n) => setT({ ...t, nS: Math.max(1, Math.round(n)) })} /></div>
      <div className="form-row"><label>Cores per stack</label><DraftNumberInput min="1" step="1" value={t.nC} onCommit={(n) => setT({ ...t, nC: Math.max(1, Math.round(n)) })} /></div>
      <button onClick={() => onSave(t)}>Use these turns</button>
    </>
  );
}

/** "Safe at full power?" (spec §8.3): capacitors against their ratings, the safe power, and transformer flux. */
export function SafePowerGuide({ state, dispatch, level, grid, caches }: { state: AppState; dispatch: Dispatch<Action>; level: Level; grid: number[]; caches: BranchCache[] }) {
  const [fitting, setFitting] = useState<string | null>(null);
  const [loopMeasured, setLoopMeasured] = useState<number | null>(null);
  const cs = useMemo(() => capStress(state, grid, state.powerW, caches), [state.chain, state.fits, state.variants, state.sweeps, state.powerW, grid]);
  const tv = useMemo(() => transformerView(state, grid, state.powerW, caches), [state.chain, state.fits, state.variants, state.primary, state.sweeps, state.powerW, state.tmodel, grid]);
  const fit = (): void => {
    setFitting('Fitting the transformer model (about 5 s)…');
    setTimeout(() => {
      try {
        dispatch({ type: 'setTModel', tmodel: fitBranchTModel(state) });
        setFitting(null);
      } catch (e) {
        setFitting(`Couldn't fit the transformer model: ${message(e)}`);
      }
    }, 50);
  };
  const sols = tv.kind === 'ranges' && tv.loopV && loopMeasured !== null ? fPriSolutions(tv.loopV, loopMeasured) : null;
  const pct = (fp: number): string => `${(fp * 100).toFixed(0)} %`;
  return (
    <section className="panel guide">
      <h3>Guide</h3>
      <section className="step current">
        <h4><span className="step-mark">1</span>Planned power</h4>
        <div className="form-row"><label>Power into the cage (W)</label><DraftNumberInput min="1" step="any" value={state.powerW} onCommit={(w) => dispatch({ type: 'setPower', watts: w })} /></div>
      </section>
      <section className="step current">
        <h4><span className="step-mark">2</span>Capacitors against their ratings</h4>
        <p className={`verdict-line ${tone(cs.worstPct, cs.unrated.length)}`}>{powerText(cs, level)}</p>
        <small>Only the capacitors have ratings here; transformer and wiring heating aren't modelled.</small>
        {level === 'beginner' ? null : (
          <table className="numbers">
            <thead><tr><th>Part</th><th>% of rating</th>{level === 'engineer' ? <><th>V rms</th><th>A rms</th></> : null}</tr></thead>
            <tbody>
              {cs.rows.map((r) => (
                <tr key={`${r.blockId}:${r.pf}`}>
                  <td>{r.label}: {r.count}×{r.pf} pF</td>
                  <td><span className={`stress-bar ${r.flag}`}><i style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} /></span> {r.pct === null ? 'no rating' : `${r.pct.toFixed(0)} % (${r.limit})`}</td>
                  {level === 'engineer' ? <><td>{r.vRms.toFixed(0)}</td><td>{r.iRms.toFixed(2)}</td></> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {level === 'beginner' ? null : (
        <section className="step current">
          <h4><span className="step-mark">3</span>Transformer</h4>
          {tv.kind === 'none' ? <p>No transformer in this circuit.</p> : null}
          {tv.kind === 'error' ? <p className="bad">Can't tell: {tv.message}.</p> : null}
          {tv.kind === 'needs-turns' ? <TurnsForm onSave={(t) => dispatch({ type: 'patchBlock', id: tv.branchId, patch: { transformer: t } })} /> : null}
          {tv.kind === 'needs-tmodel' ? (
            <>
              <p>Flux needs a transformer model fitted to the measured part's sweep{level === 'engineer' ? ' for this cable assumption' : ''} and these turns.</p>
              <button onClick={fit} disabled={fitting !== null && fitting.startsWith('Fitting')}>Fit transformer model (about 5 s)</button>
              {fitting ? <small>{fitting}</small> : null}
            </>
          ) : null}
          {tv.kind === 'ranges' ? (
            <>
              {tv.extent.map((r) => <p key={r.blockId}>Flux per core: {r.bMin.toFixed(2)}–{r.bMax.toFixed(2)} mT · sense-loop voltage {r.vMin.toFixed(1)}–{r.vMax.toFixed(1)} V rms at {state.powerW} W.</p>)}
              <small>A range, because one-port sweeps can't tell how the leakage splits between the windings (0 to 0.5 of it on the primary).</small>
              {level === 'engineer' ? (
                <>
                  <table className="numbers">
                    <thead><tr><th>Leakage on the primary</th><th>Flux (mT)</th><th>Loop (V rms)</th></tr></thead>
                    <tbody>{tv.ranges[0].points.map((p) => <tr key={p.fPri}><td>{p.fPri.toFixed(1)}</td><td>{p.bPk_mT.toFixed(2)}</td><td>{p.vLoopRms.toFixed(1)}</td></tr>)}</tbody>
                  </table>
                  {tv.loopV ? (
                    <div className="form-row"><label>Measured loop voltage (V rms)</label><DraftNumberInput min="0" step="any" value={loopMeasured ?? 0} onCommit={(v) => setLoopMeasured(v > 0 ? v : null)} /></div>
                  ) : null}
                  {sols ? <small>{sols.length === 0 ? `No leakage split from 0 to 1 gives ${loopMeasured} V on the loop: the model structure, not the split, is off.` : sols.length === 1 ? `That reading means ${pct(sols[0])} of the leakage sits on the primary.` : `That reading fits ${sols.map(pct).join(' or ')} of the leakage on the primary; one sweep can't tell which.`}</small> : null}
                  <p>{tv.source === 'branch'
                    ? `The measured part absorbs ${tv.branchW === null ? '?' : tv.branchW.toFixed(0)} W; the split between transformer, plates and part can't be identified from a one-port sweep.`
                    : `Power: ${tv.split.map((x) => `${x.label} ${x.watts.toFixed(1)} W`).join(' · ')}`}</p>
                </>
              ) : null}
            </>
          ) : null}
        </section>
      )}
    </section>
  );
}

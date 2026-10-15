import { type Dispatch, type ReactNode, useEffect, useMemo, useState } from 'react';
import { allBlocks } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { recommend } from '../recommend/recommend.ts';
import { type Action, type AppState, type FitValues, variantChain } from '../app/state.ts';
import { sweepFromFile, sweepLabel } from '../app/sweepFile.ts';
import { tagSummary } from '../app/units.ts';
import { type Agreement, agreementFor, agreementText } from '../present/agreement.ts';
import { hasModel, sameState, snapshotState, structureKey } from '../present/circuit.ts';
import { newSweepStatus } from '../present/guide.ts';
import { type Level, PROFILES } from '../present/level.ts';
import { type CapStress, roundSafe } from '../present/power.ts';
import { type RecRow, type RecView, noChangeNeeded, picksState, shapeRecs } from '../present/recs.ts';
import { refitAll, refitNote } from '../present/refit.ts';
import type { VerdictState } from '../present/verdict.ts';

const SHORT: Record<VerdictState, string> = { unknown: "can't tell", outside: "outside the tuner's good range", little: 'in range, little room', some: 'in range, some room', plenty: 'in range, plenty of room' };

function rowText(r: RecRow, level: Level, watts: number): string {
  const v = `Model: ${SHORT[r.verdict]}${level === 'engineer' ? ` (${r.inCount} of ${r.total} cable assumptions)` : ''}`;
  const st = r.stressPct === null ? 'capacitor stress unknown' : r.stress === 'red' ? `over a capacitor rating at ${watts} W (${r.stressPct.toFixed(0)} %)` : `capacitors at ${r.stressPct.toFixed(0)} % of rating at ${watts} W`;
  return `${v} · ${st}`;
}

const MEASURED_ONLY = <p>This project holds measured sweeps only, so there is no model to compare with or to suggest changes from.</p>;

export interface GuideProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  level: Level;
  grid: number[];
  caches: BranchCache[];
  /** The verdict on screen (measured or predicted), so step 4 never contradicts the result panel (review I3). */
  verdict: VerdictState;
  preview: Record<string, Pick> | null;
  onPreview: (p: Record<string, Pick> | null) => void;
  onSafePower: () => void;
  /** Capacitor stress of the current build at the planned power, or null without a model. */
  power: CapStress | null;
}

/** "I measured a new sweep" (spec §8.1): confirm the build, load the sweep, check the model, choose a change. */
export function NewSweepGuide({ state, dispatch, level, grid, caches, verdict, preview, onPreview, onSafePower, power }: GuideProps) {
  // "Confirmed" belongs to the circuit that was confirmed: any change to it asks again (reviewer pass).
  const circuit = `${structureKey(state.chain)}|${JSON.stringify(snapshotState(state.chain))}`;
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const confirmed = confirmedFor === circuit;
  const [loaded, setLoaded] = useState(false);
  const [usedChange, setUsedChange] = useState(false);
  const [prevFits, setPrevFits] = useState<Record<string, FitValues> | null>(null);
  useEffect(() => {
    setLoaded(false);
  }, [circuit]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refitMsg, setRefitMsg] = useState<string | null>(null);
  const [blind, setBlind] = useState<Agreement | null>(null);
  const [recs, setRecs] = useState<RecView | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const status = newSweepStatus(confirmed, loaded);
  const last = state.tagged.at(-1);
  const sameAsLast = last !== undefined && last.structure === structureKey(state.chain) && sameState(state.chain, last.state, snapshotState(state.chain));
  const activeTag = state.tagged.find((t) => t.sweepId === state.activeSweep);
  const tagMatches = activeTag !== undefined && activeTag.structure === structureKey(state.chain) && sameState(state.chain, activeTag.state, snapshotState(state.chain));
  const model = hasModel(state.chain);
  const agreement = useMemo(() => (loaded && model ? agreementFor(state, grid, caches) : null), [loaded, model, state.chain, state.fits, state.sweeps, state.tagged, state.activeSweep, state.variants, state.window, grid]);

  useEffect(() => {
    setRecs(null);
    setRecError(null);
    if (!loaded || !model) return undefined;
    const t = setTimeout(() => {
      try {
        const out = recommend({ fitted: state.variants.map((variant, i) => ({ variant, chain: variantChain(state, i) })), sweeps: state.sweeps, grid, window: state.window, stock: state.stock, stressWatts: state.powerW });
        setRecs(shapeRecs(out, state.window));
      } catch (e) {
        setRecError(e instanceof Error ? e.message : String(e));
      }
    }, 30);
    return () => clearTimeout(t);
  }, [loaded, state.chain, state.fits, state.sweeps, state.variants, state.window, state.stock, state.powerW, grid]);

  const onFiles = async (files: FileList | null): Promise<void> => {
    setLoadError(null);
    const file = files?.[0];
    if (!file) return;
    try {
      const sweep = sweepFromFile(file.name, await file.text(), state.sweeps);
      dispatch({ type: 'addSweep', sweep, label: sweepLabel(file.name) });
      setLoaded(true);
      setBlind(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  };

  const doRefit = async (): Promise<void> => {
    const before = blind;
    setBlind((b) => b ?? agreement);
    setBusy(true);
    setRefitMsg(null);
    const r = await refitAll(state, (i, n) => setRefitMsg(`Refitting ${i + 1} of ${n}…`));
    setBusy(false);
    if ('error' in r) {
      setRefitMsg(`The refit failed, so the previous fit is kept: ${r.error}`);
      setBlind(before);
      return;
    }
    setPrevFits(state.fits);
    dispatch({ type: 'setFits', fits: r.fits });
    setRefitMsg(null);
  };

  const editBanks = (): void => {
    const b = allBlocks(state.chain.blocks).find((x) => x.type === 'capBank');
    if (b) dispatch({ type: 'select', id: b.id });
  };

  const recBody = (): ReactNode => {
    if (recError) return <small className="bad">Couldn't work out changes: {recError}</small>;
    if (!recs) return <small>Working out changes from your parts…</small>;
    const heads: string[] = [];
    if (noChangeNeeded(verdict, recs.currentStressPct)) heads.push('No change needed.');
    if (recs.notes.includes('nothing-beats')) heads.push('Nothing in your stock beats what you have.');
    if (recs.notes.includes('none-fit')) heads.push(recs.closest.length ? 'None of your stock combinations lets the tuner match for most cable assumptions. The closest:' : 'None of your stock combinations lets the tuner match, and there is nothing to try: check Parts on hand.');
    if (recs.notes.includes('all-red')) heads.push(`Every option is over a capacitor rating at ${state.powerW} W planned power.`);
    const lim = power?.limiting;
    if (recs.notes.includes('nothing-beats') && lim && power && power.worstPct !== null && power.worstPct >= 100 && power.safeW !== null) {
      heads.push(`Nothing in your stock fixes the ${lim.pf} pF part in the ${lim.label} at ${state.powerW} W. Run at about ${roundSafe(power.safeW)} W or less, or use a part rated for more ${lim.limit === 'voltage' ? 'voltage' : 'current'}.`);
    }
    const rows = recs.rows.length ? recs.rows : recs.closest;
    return (
      <div className="recs">
        {heads.map((h) => <p key={h}><b>{h}</b></p>)}
        <ol>
          {rows.map((r, i) => {
            const on = preview === r.picks;
            return (
              <li key={i} className={on ? 'previewing' : ''}>
                <span>{r.isCurrent ? 'Keep what you have' : r.movesText.join('; ')}</span>
                <small className={`stress-${r.stress}`}>{rowText(r, level, state.powerW)}</small>
                {r.isCurrent ? null : (
                  <div className="row">
                    <button onClick={() => onPreview(on ? null : r.picks)}>{on ? 'Hide' : 'Show on drawing'}</button>
                    <button onClick={() => { dispatch({ type: 'setCircuitState', state: picksState(r.picks) }); setUsedChange(true); }}>Use this</button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const step = (n: number, title: string, body: ReactNode): ReactNode => (
    <section className={`step ${status[n]}`} key={n}>
      <h4><span className="step-mark">{status[n] === 'done' ? '✓' : n + 1}</span>{title}</h4>
      {status[n] === 'waiting' ? null : body}
    </section>
  );

  return (
    <section className="panel guide">
      <h3>Guide</h3>
      {step(0, "What's installed right now?", (
        <>
          {usedChange && !confirmed ? <p><b>The circuit now shows the change you chose.</b> Build it, then confirm it here and load its sweep.</p> : null}
          <p>{tagSummary(state.chain, snapshotState(state.chain)) || 'No capacitor banks or sense loop in this circuit.'}</p>
          {sameAsLast ? <small>Same as your last build.</small> : null}
          <div className="row">
            <button onClick={() => setConfirmedFor(circuit)} disabled={confirmed}>{confirmed ? 'Confirmed' : "That's what's installed"}</button>
            <button onClick={editBanks}>Change</button>
          </div>
        </>
      ))}
      {step(1, 'Load the sweep', (
        <>
          <label className="file-picker">Choose an .s1p file…<input type="file" accept=".s1p" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
          {activeTag && !loaded && tagMatches ? <button onClick={() => setLoaded(true)}>Use "{activeTag.label}" (already loaded)</button> : null}
          {activeTag && !loaded && !tagMatches ? <small>"{activeTag.label}" was taken on {tagSummary(state.chain, activeTag.state) || 'a different build'}, not on what's installed now. Load this build's sweep, or fix the tag in Sweeps.</small> : null}
          {loadError ? <small className="bad">{loadError}</small> : null}
          {PROFILES[level].sheets.includes('sweeps') ? <small>Tagged with the wrong build? Fix it in Sweeps (top bar).</small> : null}
        </>
      ))}
      {step(2, 'Does the model agree?', !model ? MEASURED_ONLY : (
        <>
          {blind ? <p><b>Before the refit:</b> {agreementText(blind, level, state.primary)}</p> : null}
          {agreement ? <p>{agreementText(agreement, level, state.primary)}</p> : <p>Can't compare: no sweep is shown.</p>}
          {refitNote(state) ? <small className="warn-text">{refitNote(state)}</small> : null}
          <button onClick={() => { void doRefit(); }} disabled={busy}>Refit the model with your sweeps</button>
          {prevFits ? <button onClick={() => { dispatch({ type: 'setFits', fits: prevFits }); setPrevFits(null); setBlind(null); }}>Put back the fit from before the refit</button> : null}
          {refitMsg ? <small>{refitMsg}</small> : null}
        </>
      ))}
      {model ? step(3, 'What to change', recBody()) : null}
      {model ? step(4, 'Safe at full power?', <button onClick={onSafePower}>Check it at full power</button>) : null}
    </section>
  );
}

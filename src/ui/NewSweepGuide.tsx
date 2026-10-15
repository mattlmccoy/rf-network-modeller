import { type Dispatch, type ReactNode, useEffect, useMemo, useState } from 'react';
import { allBlocks } from '../chain/state.ts';
import type { BranchCache } from '../chain/types.ts';
import type { Pick } from '../recommend/enumerate.ts';
import { recommend } from '../recommend/recommend.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { sweepFromFile, sweepLabel } from '../app/sweepFile.ts';
import { tagSummary } from '../app/units.ts';
import { type Agreement, agreementFor, agreementText } from '../present/agreement.ts';
import { sameState, snapshotState, structureKey } from '../present/circuit.ts';
import { newSweepStatus } from '../present/guide.ts';
import { type Level, PROFILES } from '../present/level.ts';
import { type RecRow, type RecView, noChangeNeeded, picksState, shapeRecs } from '../present/recs.ts';
import { refitAll } from '../present/refit.ts';
import type { Combined, VerdictState } from '../present/verdict.ts';

const SHORT: Record<VerdictState, string> = { unknown: "can't tell", outside: "tuner can't match", little: 'matches, little room', some: 'matches, some room', plenty: 'matches, plenty of room' };

function rowText(r: RecRow, level: Level, watts: number): string {
  const v = `${SHORT[r.verdict]}${level === 'engineer' ? ` (${r.inCount} of ${r.total} cable assumptions)` : ''}`;
  const st = r.stressPct === null ? 'capacitor stress unknown' : r.stress === 'red' ? `over a capacitor rating at ${watts} W (${r.stressPct.toFixed(0)} %)` : `capacitors at ${r.stressPct.toFixed(0)} % of rating at ${watts} W`;
  return `${v} · ${st}`;
}

export interface GuideProps {
  state: AppState;
  dispatch: Dispatch<Action>;
  level: Level;
  grid: number[];
  caches: BranchCache[];
  combined: Combined;
  preview: Record<string, Pick> | null;
  onPreview: (p: Record<string, Pick> | null) => void;
}

/** "I measured a new sweep" (spec §8.1): confirm the build, load the sweep, check the model, choose a change. */
export function NewSweepGuide({ state, dispatch, level, grid, caches, combined, preview, onPreview }: GuideProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [loaded, setLoaded] = useState(false);
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
  const agreement = useMemo(() => (loaded ? agreementFor(state, grid, caches) : null), [loaded, state.chain, state.fits, state.sweeps, state.tagged, state.activeSweep, state.variants, state.window, grid]);

  useEffect(() => {
    setRecs(null);
    setRecError(null);
    if (!loaded) return undefined;
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
    if (noChangeNeeded(combined.state, recs.currentStressPct)) heads.push('No change needed.');
    if (recs.notes.includes('nothing-beats')) heads.push('Nothing in your stock beats what you have.');
    if (recs.notes.includes('none-fit')) heads.push(recs.closest.length ? 'None of your stock combinations lets the tuner match for most cable assumptions. The closest:' : 'None of your stock combinations lets the tuner match, and there is nothing to try: check Parts on hand.');
    if (recs.notes.includes('all-red')) heads.push(`Every option is over a capacitor rating at ${state.powerW} W planned power.`);
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
                    <button onClick={() => dispatch({ type: 'setCircuitState', state: picksState(r.picks) })}>Use this</button>
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
          <p>{tagSummary(state.chain, snapshotState(state.chain)) || 'No capacitor banks or sense loop in this circuit.'}</p>
          {sameAsLast ? <small>Same as your last build.</small> : null}
          <div className="row">
            <button onClick={() => setConfirmed(true)} disabled={confirmed}>{confirmed ? 'Confirmed' : "That's what's installed"}</button>
            <button onClick={editBanks}>Change</button>
          </div>
        </>
      ))}
      {step(1, 'Load the sweep', (
        <>
          <label className="file-picker">Choose an .s1p file…<input type="file" accept=".s1p" onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} /></label>
          {activeTag && !loaded ? <button onClick={() => setLoaded(true)}>Use "{activeTag.label}" (already loaded)</button> : null}
          {loadError ? <small className="bad">{loadError}</small> : null}
          {PROFILES[level].sheets.includes('sweeps') ? <small>Tagged with the wrong build? Fix it in Sweeps (top bar).</small> : null}
        </>
      ))}
      {step(2, 'Does the model agree?', (
        <>
          {blind ? <p><b>Before refit (blind check):</b> {agreementText(blind, level, state.primary)}</p> : null}
          {agreement ? <p>{agreementText(agreement, level, state.primary)}</p> : <p>Can't compare: no sweep is shown.</p>}
          <button onClick={() => { void doRefit(); }} disabled={busy}>Refit the model with this sweep</button>
          {refitMsg ? <small>{refitMsg}</small> : null}
        </>
      ))}
      {step(3, 'What to change', recBody())}
      {step(4, 'Safe at full power?', <><button disabled>Check it at full power</button> <small>Coming next.</small></>)}
    </section>
  );
}

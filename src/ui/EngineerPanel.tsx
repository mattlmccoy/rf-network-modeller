import { type Dispatch, useMemo } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Variant } from '../chain/types.ts';
import { getParam, refName } from '../fit/params.ts';
import { zFromGamma } from '../io/sweep.ts';
import { landingNearF0 } from '../present/verdict.ts';
import { type VariantResult, measuredLanding } from '../app/evaluate.ts';
import { type Action, type AppState, type FitValues, type PaneMode, variantChain } from '../app/state.ts';
import { displayUnit, fmtZ, toDisplay } from '../app/units.ts';
import { type Dot, PlotPane, type Trace } from './PlotPane.tsx';

export const VARIANT_COLORS = ['#a9008b', '#173de3', '#20aa35'];

function FitTable({ state }: { state: AppState }) {
  const rows = state.variants.map((v, i) => ({ v, i, f: state.fits[v.name] })).filter((r): r is { v: Variant; i: number; f: FitValues } => r.f !== undefined);
  if (!rows.length) return <small>No fitted values yet.</small>;
  const value = (i: number, k: number): string => {
    const ref = rows[0].f.refs[k];
    const b = findBlock(state.chain, ref.blockId);
    if (!b) return 'part removed';
    const u = displayUnit(b, ref.key);
    try {
      return `${toDisplay(getParam(variantChain(state, i), ref).value, u).toPrecision(4)} ${u.unit}`;
    } catch {
      return 'missing';
    }
  };
  return (
    <table className="numbers">
      <thead><tr><th>Fitted values</th>{rows.map(({ v }) => <th key={v.name}>{v.name}</th>)}</tr></thead>
      <tbody>
        {rows[0].f.refs.map((ref, k) => (
          <tr key={refName(ref)}><td>{findBlock(state.chain, ref.blockId)?.label ?? ref.blockId} · {ref.key}</td>{rows.map(({ v, i }) => <td key={v.name}>{value(i, k)}</td>)}</tr>
        ))}
        <tr><td>Settled?</td>{rows.map(({ v, f }) => <td key={v.name}>{f.converged === null ? 'imported (no flag)' : f.converged ? 'yes' : <span className="bad">no</span>}</td>)}</tr>
        <tr><td>RMS |ΔΓ|</td>{rows.map(({ v, f }) => <td key={v.name}>{f.rms === null ? '–' : f.rms.toFixed(4)}</td>)}</tr>
        <tr><td>Can't be told apart</td>{rows.map(({ v, f }) => <td key={v.name}>{f.illDetermined.length ? f.illDetermined.map((p) => p.join(' ~ ')).join('; ') : 'none'}</td>)}</tr>
        <tr><td>Source</td>{rows.map(({ v, f }) => <td key={v.name}>{f.source}</td>)}</tr>
      </tbody>
    </table>
  );
}

/** Engineer result: the four VNA panes, Z at 13.56 MHz per cable assumption, and the fit (spec §7.4). */
export function EngineerPanel({ state, dispatch, grid, results, theme }: { state: AppState; dispatch: Dispatch<Action>; grid: number[]; results: VariantResult[]; theme: 'light' | 'dark' }) {
  const colors = state.variants.map((_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length]);
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const measuredColor = theme === 'dark' ? '#b0b0aa' : '#777777';
  const traces = useMemo<Trace[]>(() => {
    const out: Trace[] = [];
    results.forEach((r, i) => {
      if (r.z.length) out.push({ key: `v${i}`, label: state.variants[i].name, color: colors[i], f: grid, z: r.z, role: i === state.primary ? 'primary' : 'variant', clamped: r.clamped });
    });
    if (active) out.push({ key: 'measured', label: `${active.name} (measured)`, color: measuredColor, f: active.f, z: active.gamma.map((g) => zFromGamma(g)), role: 'measured' });
    return out;
  }, [results, active, grid, state.primary, state.variants, theme]);
  const m = active ? measuredLanding(active) : null;
  // the measured landing is marked too, so the plots show what the verdict reads (reviewer pass)
  const dots = useMemo<Dot[]>(() => [...results.flatMap((r, i) => (r.landing ? [{ key: `d${i}`, z: r.landing.z, color: colors[i] }] : [])), ...(m ? [{ key: 'dm', z: m.z, color: measuredColor }] : [])], [results, m, measuredColor]);
  const mRoom = useMemo(() => (active ? landingNearF0(active.f, active.gamma.map((g) => zFromGamma(g)), state.window) : null), [active, state.window]);
  return (
    <div className="engineer">
      <div className="plots">
        {state.panes.map((mode, i) => <PlotPane key={i} mode={mode} traces={traces} dots={dots} aitWindow={state.window} theme={theme} onMode={(md: PaneMode) => dispatch({ type: 'setPane', index: i, mode: md })} />)}
      </div>
      <label className="title-select">Cable assumption
        <select value={state.primary} onChange={(e) => dispatch({ type: 'setPrimary', index: Number(e.target.value) })}>
          {state.variants.map((v, i) => <option key={v.name} value={i}>{v.name}{v.flag ? ' (poor fit)' : ''}</option>)}
        </select>
      </label>
      <table className="numbers">
        <thead><tr><th>At 13.56 MHz, at the tuner</th><th>Z</th><th>Room to drift up</th></tr></thead>
        <tbody>
          <tr><td>Measured{active ? ` (${active.name})` : ''}</td><td>{active ? (m ? fmtZ(m.z) : 'no point at 13.56 MHz') : 'no sweep shown'}</td><td>{mRoom?.inWindow ? `${mRoom.roomUp.toFixed(2)} %` : '–'}</td></tr>
          {results.map((r, i) => (
            <tr key={state.variants[i].name}>
              <td><span className="swatch" style={{ background: colors[i] }} />{state.variants[i].name}{state.variants[i].flag ? ' (poor fit)' : ''}{i === state.primary ? ' · chosen' : ''}</td>
              <td>{r.error ? `can't evaluate: ${r.error}` : r.landing ? fmtZ(r.landing.z) : 'no point at 13.56 MHz'}</td>
              <td>{r.landing?.inWindow ? `${r.landing.roomUp.toFixed(2)} %` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FitTable state={state} />
    </div>
  );
}

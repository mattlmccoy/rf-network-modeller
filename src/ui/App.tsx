import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { zFromGamma } from '../io/sweep.ts';
import { evaluateVariants, measuredLanding } from '../app/evaluate.ts';
import { loadExample } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { type PaneMode, emptyState, reducer } from '../app/state.ts';
import { LandingStrip } from './LandingStrip.tsx';
import { CircuitStrip } from './CircuitStrip.tsx';
import { Inspector } from './Inspector.tsx';
import { type Dot, PlotPane, type Trace } from './PlotPane.tsx';
import { StockPanel } from './StockPanel.tsx';
import { SweepsPanel } from './SweepsPanel.tsx';

type Theme = 'light' | 'dark';
const VARIANT_COLORS = ['#a9008b', '#173de3', '#20aa35'];

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [loadError, setLoadError] = useState<string | null>(null);
  const caches = useRef<BranchCache[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rfnm-theme', theme);
    } catch {
      // storage unavailable: the theme still applies for this session
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1e20' : '#cfcfcd');
  }, [theme]);

  const openExample = (): void => {
    setLoadError(null);
    loadExample()
      .then((s) => dispatch({ type: 'load', state: s }))
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(openExample, []);

  const grid = useMemo(() => evalGrid(state.chain, state.sweeps), [state.chain, state.sweeps]);
  const results = useMemo(() => evaluateVariants(state, grid, caches.current), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);
  const colors = state.variants.map((_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length]);
  const active = state.activeSweep ? state.sweeps[state.activeSweep] : undefined;
  const traces = useMemo<Trace[]>(() => {
    const out: Trace[] = [];
    results.forEach((r, i) => {
      if (r.z.length) out.push({ key: `v${i}`, label: state.variants[i].name, color: colors[i], f: grid, z: r.z, role: i === state.primary ? 'primary' : 'variant', clamped: r.clamped });
    });
    if (active) out.push({ key: 'measured', label: `${active.name} (measured)`, color: theme === 'dark' ? '#b0b0aa' : '#777777', f: active.f, z: active.gamma.map((g) => zFromGamma(g)), role: 'measured' });
    return out;
  }, [results, active, grid, state.primary, state.variants, theme]);
  const dots = useMemo<Dot[]>(() => results.flatMap((r, i) => (r.landing ? [{ key: `d${i}`, z: r.landing.z, color: colors[i] }] : [])), [results]);
  const measured = active ? { label: state.tagged.find((t) => t.sweepId === active.id)?.label ?? active.name, color: theme === 'dark' ? '#b0b0aa' : '#777777', landing: measuredLanding(active) } : null;
  const clampNote = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of results) r.clamped.forEach((c, i) => { if (c) { lo = Math.min(lo, grid[i]); hi = Math.max(hi, grid[i]); } });
    return Number.isFinite(lo) ? `The measured branch is read outside its sweep from ${(lo / 1e6).toFixed(2)} to ${(hi / 1e6).toFixed(2)} MHz (values clamped to the sweep's end); those parts of the traces are drawn faint and dashed.` : null;
  }, [results, grid]);

  return (
    <div className="application">
      <div className="window-title">
        <span>RF NETWORK MODELLER — {state.chain.name}</span>
        <div className="window-actions">
          <label className="title-select">Variant
            <select value={state.primary} onChange={(e) => dispatch({ type: 'setPrimary', index: Number(e.target.value) })}>
              {state.variants.map((v, i) => <option key={v.name} value={i}>{v.name}{v.flag ? ' (poor fit)' : ''}</option>)}
            </select>
          </label>
          <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        </div>
      </div>
      <main className="main-grid">
        <aside className="controls-column">
          <fieldset>
            <legend>Project</legend>
            {loadError ? <small className="bad">Could not load the O7 example: {loadError}</small> : <small>{state.chain.name}</small>}
            <button className="wide" onClick={openExample}>Reload O7 example</button>
          </fieldset>
          <SweepsPanel state={state} dispatch={dispatch} />
          <StockPanel state={state} dispatch={dispatch} />
        </aside>
        <section className="readouts-column">
          <Inspector state={state} dispatch={dispatch} />
        </section>
        <section className="charts-grid">
          <CircuitStrip state={state} dispatch={dispatch} />
          <LandingStrip names={state.variants.map((v) => v.name)} colors={colors} results={results} measured={measured} clampNote={clampNote} />
          {state.panes.map((mode, i) => <PlotPane key={i} mode={mode} traces={traces} dots={dots} aitWindow={state.window} theme={theme} onMode={(m: PaneMode) => dispatch({ type: 'setPane', index: i, mode: m })} />)}
        </section>
      </main>
    </div>
  );
}

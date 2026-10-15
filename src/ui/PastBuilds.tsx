import { useEffect, useState } from 'react';
import type { Window } from '../chain/types.ts';
import { type Sweep, zFromGamma } from '../io/sweep.ts';
import { measuredLanding } from '../app/evaluate.ts';
import type { AppState, PaneMode } from '../app/state.ts';
import { buildSweep, buildsOf } from '../present/builds.ts';
import { hasModel } from '../present/circuit.ts';
import type { Level } from '../present/level.ts';
import { landingNearF0, toneOf, verdictOf, verdictText } from '../present/verdict.ts';
import { fromProjectJson } from '../project/file.ts';
import { listProjects } from '../project/store.ts';
import { VARIANT_COLORS } from './EngineerPanel.tsx';
import { PlotPane } from './PlotPane.tsx';
import { TargetBox } from './TargetBox.tsx';

interface Row { id: string | null; name: string; state: AppState | null; error: string | null }
interface Chosen { key: string; label: string; sweep: Sweep; window: Window }

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const dateText = (ms: number | null): string => (ms === null ? 'date unknown' : new Date(ms).toISOString().slice(0, 10));
const zs = (s: Sweep) => s.gamma.map((g) => zFromGamma(g));

/** "Look back at past builds" (spec §8.5): every project's builds, compare up to two, open one. */
export function PastBuilds({ current, level, onOpen }: { current: { id: string | null; state: AppState }; level: Level; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Chosen[]>([]);
  const [mode, setMode] = useState<PaneMode>('smith');
  useEffect(() => {
    let live = true;
    listProjects().then((list) => {
      if (!live) return;
      setRows(list.filter((e) => e.id !== current.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((e): Row => {
        try {
          return { id: e.id, name: e.name, state: fromProjectJson(e.json).state, error: null };
        } catch (err) {
          return { id: e.id, name: e.name, state: null, error: message(err) };
        }
      }));
    }, (e: unknown) => {
      if (live) setError(`Couldn't read the projects saved in this browser: ${message(e)}`);
    });
    return () => {
      live = false;
    };
  }, [current.id]);
  const all: Row[] = [{ id: current.id, name: current.state.chain.name, state: current.state, error: null }, ...(rows ?? [])];
  const toggle = (c: Chosen): void => setPicked((ps) => (ps.some((x) => x.key === c.key) ? ps.filter((x) => x.key !== c.key) : [...ps, c].slice(-2)));
  const lvl = level === 'beginner' ? 'beginner' : level;
  const verdict = (c: Chosen) => verdictOf(landingNearF0(c.sweep.f, zs(c.sweep), c.window), c.window);
  return (
    <main className="past">
      {error ? <p className="bad">{error}</p> : null}
      {rows === null && !error ? <p>Reading the projects saved in this browser…</p> : null}
      <section className="panel">
        <header className="panel-head"><h3>Compare</h3></header>
        {picked.length ? (
          <>
            {picked.map((c, i) => <p key={c.key} className={`verdict-line ${toneOf(verdict(c).state)}`}><b>{'AB'[i]}: {c.label}.</b> {verdictText(verdict(c), lvl)}</p>)}
            {level === 'engineer' ? (
              <PlotPane mode={mode} onMode={setMode} theme={document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'} aitWindow={picked[0].window}
                dots={picked.flatMap((c, i) => { const m = measuredLanding(c.sweep); return m ? [{ key: c.key, z: m.z, color: VARIANT_COLORS[i] }] : []; })}
                traces={picked.map((c, i) => ({ key: c.key, label: 'AB'[i], color: VARIANT_COLORS[i], f: c.sweep.f, z: zs(c.sweep), role: 'measured' as const }))} />
            ) : (
              <TargetBox window={picked[0].window} measured={measuredLanding(picked[0].sweep)?.z ?? null} measuredLabel="A" predicted={null}
                ghost={picked[1] ? measuredLanding(picked[1].sweep)?.z ?? null : null} ghostLabel="B" />
            )}
          </>
        ) : <p>Tick up to two builds below to compare their sweeps.</p>}
      </section>
      {all.map((r) => {
        const builds = r.state ? buildsOf(r.state) : [];
        return (
          <section className="panel" key={r.id ?? 'current'}>
            <header className="panel-head">
              <h3>{r.name}</h3>
              {r.state ? <small>{hasModel(r.state.chain) ? 'modelled' : 'measured only'}</small> : null}
              {r.id === current.id ? <small>open now</small> : r.id ? <button onClick={() => onOpen(r.id as string)}>Open</button> : null}
            </header>
            {r.error ? <p className="bad">Couldn't read this project: {r.error}</p> : null}
            {r.state && !builds.length ? <small>No sweeps yet.</small> : null}
            {builds.map((b) => {
              const sweep = r.state ? buildSweep(r.state, b) : undefined;
              const key = `${r.id ?? 'current'}:${b.key}`;
              return (
                <label className="check-row" key={key}>
                  <input type="checkbox" disabled={!sweep} checked={picked.some((x) => x.key === key)}
                    onChange={() => { if (sweep && r.state) toggle({ key, label: `${r.name}: ${b.label}`, sweep, window: r.state.window }); }} />
                  {dateText(b.newest)} · {b.label} · {b.sweepIds.length} sweep{b.sweepIds.length === 1 ? '' : 's'}
                </label>
              );
            })}
          </section>
        );
      })}
    </main>
  );
}

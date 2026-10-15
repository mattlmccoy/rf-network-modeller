import { useEffect, useRef, useState } from 'react';
import type { AppState } from '../app/state.ts';
import { historyCopy, historyUrl } from '../history/copy.ts';
import { type HistoryIndex, type IndexSession, type SweepKind, parseIndex } from '../history/manifest.ts';

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const KIND: Record<SweepKind, string> = {
  network: 'network, no tuner in the path',
  'network+tuner': 'tuner in the path: not comparable to predictions',
  branch: 'measured part, no matching capacitors',
  calibration: 'calibration standard',
  short: 'shorted cable',
  other: 'other',
};
const PRESET: Record<'o7' | 'cd', string> = {
  o7: 'The "O7 as built" starting point in Start a new network was fitted to this session\'s sweeps.',
  cd: 'Same hardware as the "C+D 2:18 two-core" starting point in Start a new network; that starting point is not fitted to these sweeps.',
};
const pf = (v: number | null): string => (v === null ? 'unknown' : `${v} pF`);

/** Rig history (spec §8.6, §10): every configuration ever swept, read-only, newest first; a session opens as a copy. */
export function RigHistory({ onCopy }: { onCopy: (s: AppState) => void }) {
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // A copy that arrives after the user left this page must not replace the project they moved to (final review M1).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    fetch('history/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => { if (live) setIndex(parseIndex(t)); }, (e: unknown) => { if (live) setError(`Couldn't load the rig history: ${message(e)}`); });
    return () => {
      live = false;
    };
  }, []);
  const copy = async (s: IndexSession): Promise<void> => {
    setBusy(true);
    setStatus((m) => ({ ...m, [s.id]: `Fetching ${s.sweeps.length} sweeps…` }));
    try {
      const texts = Object.fromEntries(await Promise.all(s.sweeps.map(async (w) => {
        const r = await fetch(historyUrl(w.path));
        if (!r.ok) throw new Error(`${w.path}: HTTP ${r.status}`);
        return [w.path, await r.text()] as const;
      })));
      if (mounted.current) onCopy(historyCopy(s, texts));
    } catch (e) {
      if (mounted.current) setStatus((m) => ({ ...m, [s.id]: `Couldn't open a copy: ${message(e)}` }));
    }
    if (mounted.current) setBusy(false);
  };
  if (error) return <main className="past"><p className="bad">{error}</p></main>;
  if (!index) return <main className="past"><p>Loading the rig history…</p></main>;
  return (
    <main className="past">
      <p>{index.sessions.length} sessions, {index.sessions.reduce((n, s) => n + s.sweeps.length, 0)} sweeps, newest first; undated files last. Read-only copies of {index.source}. Impedances quoted in labels come from the notes and can differ slightly from the file. Load: cube = powder and cube between connected plates; electrodes = plates connected, contents not recorded; none = no load: plates bare or nothing connected to them.</p>
      {index.sessions.map((s) => (
        <section className="panel" key={s.id}>
          <header className="panel-head">
            <h3>{s.date ?? 'date unknown'}</h3>
            <button disabled={busy || !s.sweeps.length} onClick={() => { void copy(s); }}>Open a copy</button>
          </header>
          <p><b>{s.title}</b></p>
          {status[s.id] ? <small>{status[s.id]}</small> : null}
          {s.modelPreset ? <small>{PRESET[s.modelPreset]}</small> : null}
          <details>
            <summary>Rig</summary>
            <p><small>Transformer: {s.rig.transformer}</small></p>
            <p><small>Turns: {s.rig.turns}</small></p>
            <p><small>Cores: {s.rig.cores}</small></p>
            <p><small>Plates: {s.rig.plates}</small></p>
          </details>
          <details>
            <summary>{s.sweeps.length} sweeps{s.skipped.length ? `, ${s.skipped.length} files not imported` : ''}</summary>
            {s.sweeps.map((w) => (
              <p key={w.path}>
                <b>{w.label}</b> · {KIND[w.kind]} · series {pf(w.series_pF)}, shunt {pf(w.shunt_pF)} · loop {w.loop === null ? 'unknown' : w.loop ? 'on' : 'off'} · load {w.load}{w.condition ? ` · ${w.condition}` : ''}
                {w.uncertain ? <small className="warn-text"> Uncertain: {w.uncertain}</small> : null}
                <small> Evidence: {w.evidence}{w.sources.length > 1 ? `; identical copies: ${w.sources.slice(1).join(', ')}` : ''}{w.converted ? '; converted from a VNA export CSV' : ''}</small>
              </p>
            ))}
            {s.skipped.map((k) => <p key={k.file}><small>Not imported: {k.file}: {k.reason}</small></p>)}
            <small>Session evidence: {s.evidence}</small>
          </details>
        </section>
      ))}
    </main>
  );
}

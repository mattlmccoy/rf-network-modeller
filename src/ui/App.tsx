import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { loadExample } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { emptyState, reducer } from '../app/state.ts';
import { type Level, PROFILES, type SheetKind, parseLevel } from '../present/level.ts';
import { fromProjectJson, toProjectJson } from '../project/file.ts';
import { getCurrentId, getProject, putProject, setCurrentId } from '../project/store.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { Home, type Task } from './Home.tsx';
import { Sheet } from './Sheet.tsx';
import { StockPanel } from './StockPanel.tsx';
import { SweepsPanel } from './SweepsPanel.tsx';
import { type SaveStatus, TopBar } from './TopBar.tsx';
import { Workbench } from './Workbench.tsx';

type Theme = 'light' | 'dark';
const LEVEL_KEY = 'rfnm-level';
const TASK_TITLE: Record<Task, string> = { home: '', newSweep: 'I measured a new sweep' };
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const newId = (): string => `p-${Date.now().toString(36)}`;

function readLevel(): Level {
  try {
    return parseLevel(localStorage.getItem(LEVEL_KEY));
  } catch {
    return 'builder';
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [level, setLevel] = useState<Level>(readLevel);
  const [task, setTask] = useState<Task>('home');
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const [projectId, setProjectId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
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

  useEffect(() => {
    try {
      localStorage.setItem(LEVEL_KEY, level);
    } catch {
      // the level is a per-viewer convenience; it still applies for this session
    }
    setSheet((s) => (s && PROFILES[level].sheets.includes(s) ? s : null));
  }, [level]);

  // Reopen the last project; fall back to the O7 example with a notice (review focus 1).
  useEffect(() => {
    let live = true;
    const start = async (): Promise<void> => {
      try {
        const id = await getCurrentId();
        const entry = id ? await getProject(id) : undefined;
        if (entry) {
          const p = fromProjectJson(entry.json);
          if (live) {
            dispatch({ type: 'load', state: p.state });
            setProjectId(entry.id);
          }
          return;
        }
      } catch (e) {
        if (live) setNotice(`Couldn't reopen your saved project (${message(e)}). Showing the O7 example instead.`);
      }
      try {
        const s = await loadExample();
        if (live) {
          dispatch({ type: 'load', state: s });
          setProjectId(newId());
        }
      } catch (e) {
        if (live) setNotice(`Couldn't load the O7 example: ${message(e)}`);
      }
    };
    void start();
    return () => {
      live = false;
    };
  }, []);

  // Autosave one second after the last change; "Saved ✓" only after a confirmed write (spec §9).
  useEffect(() => {
    if (!projectId) return undefined;
    setSave('pending');
    const t = setTimeout(() => {
      const savedAt = new Date().toISOString();
      putProject({ id: projectId, name: state.chain.name, savedAt, json: toProjectJson(state, savedAt) })
        .then(() => setCurrentId(projectId))
        .then(() => setSave('saved'), () => setSave('failed'));
    }, 1000);
    return () => clearTimeout(t);
  }, [state, projectId]);

  const openExample = async (): Promise<void> => {
    try {
      dispatch({ type: 'load', state: await loadExample() });
      setProjectId(newId());
      setTask('home');
    } catch (e) {
      setNotice(`Couldn't load the O7 example: ${message(e)}`);
    }
  };

  const saveFile = (): void => {
    const url = URL.createObjectURL(new Blob([toProjectJson(state, new Date().toISOString())], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.chain.name.replace(/[^A-Za-z0-9_-]+/g, '-') || 'project'}.rfnm.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const openFile = async (file: File): Promise<void> => {
    try {
      const p = fromProjectJson(await file.text());
      dispatch({ type: 'load', state: p.state });
      setProjectId(newId());
      setTask('home');
      setNotice(null);
    } catch (e) {
      setNotice(message(e));
    }
  };

  const grid = useMemo(() => evalGrid(state.chain, state.sweeps), [state.chain, state.sweeps]);
  const results = useMemo(() => evaluateVariants(state, grid, caches.current), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);

  return (
    <div className="application">
      <TopBar name={state.chain.name} taskTitle={TASK_TITLE[task]} onHome={task === 'home' ? null : () => setTask('home')} level={level} onLevel={setLevel}
        save={save} sheets={PROFILES[level].sheets} onSheet={setSheet} onSave={saveFile} onOpen={(f) => { void openFile(f); }}
        theme={theme} onTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
      {notice ? <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}
      {task === 'home' ? <Home onTask={setTask} /> : (
        <ErrorBoundary onReset={() => { void openExample(); }}>
          <Workbench state={state} dispatch={dispatch} level={level} grid={grid} results={results} caches={caches.current} theme={theme} />
        </ErrorBoundary>
      )}
      {sheet ? (
        <Sheet title={sheet === 'parts' ? 'Parts on hand' : 'Sweeps'} onClose={() => setSheet(null)}>
          {sheet === 'parts' ? <StockPanel state={state} dispatch={dispatch} /> : <SweepsPanel state={state} dispatch={dispatch} />}
        </Sheet>
      ) : null}
    </div>
  );
}

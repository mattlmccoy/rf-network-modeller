import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { BranchCache } from '../chain/types.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { loadExample } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { type AppState, emptyState, reducer, savedState } from '../app/state.ts';
import { hasModel } from '../present/circuit.ts';
import { type Level, PROFILES, type SheetKind, parseLevel } from '../present/level.ts';
import { fromProjectJson, toProjectJson } from '../project/file.ts';
import { getCurrentId, getProject, putProject, setCurrentId } from '../project/store.ts';
import { stepsFor, tourById } from '../tour/run.ts';
import type { TourId } from '../tour/tours.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { Home, type Task, type WorkTask } from './Home.tsx';
import { PastBuilds } from './PastBuilds.tsx';
import { RigHistory } from './RigHistory.tsx';
import { Sheet } from './Sheet.tsx';
import { StockPanel } from './StockPanel.tsx';
import { SweepsPanel } from './SweepsPanel.tsx';
import { type SaveStatus, TopBar } from './TopBar.tsx';
import { TourOverlay } from './TourOverlay.tsx';
import { Workbench } from './Workbench.tsx';

type Theme = 'light' | 'dark';
const LEVEL_KEY = 'rfnm-level';
const TOUR_KEY = 'rfnm-tour-offered';
const TASK_TITLE: Record<Task, string> = { home: '', newSweep: 'I measured a new sweep', tryChange: 'Try a change first', safePower: 'Safe at full power?', newNetwork: 'Start a new network', pastBuilds: 'Look back at past builds', rigHistory: 'Rig history' };
const WORK: readonly Task[] = ['newSweep', 'tryChange', 'safePower', 'newNetwork'];
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const newId = (): string => `p-${Date.now().toString(36)}`;

/** The first-visit tour offer is a per-viewer convenience: without storage it simply shows again. */
function readOffer(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === null;
  } catch {
    return true;
  }
}

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
  // an un-kept Try-a-change trial, with the project it belongs to: autosave writes the circuit from before it (fix review I1)
  const [trial, setTrial] = useState<{ chain: AppState['chain']; fits: AppState['fits']; project: string | null } | null>(null);
  // The tutorial (tutorial spec §3): the running tour and, while practising, the project to return to; projectId stays null so nothing is saved.
  const [tour, setTour] = useState<{ id: TourId; i: number; atStep: AppState } | null>(null);
  const [practice, setPractice] = useState<{ returnTo: string | null } | null>(null);
  const [offerTour, setOfferTour] = useState(readOffer);
  const latest = useRef({ state, level, tour });
  latest.current = { state, level, tour };

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
    setTask((t) => (t === 'rigHistory' && level !== 'engineer' ? 'home' : t));
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
      const toSave = trial && trial.project === projectId ? savedState(state, trial) : state;
      putProject({ id: projectId, name: state.chain.name, savedAt, json: toProjectJson(toSave, savedAt) })
        .then(() => setCurrentId(projectId))
        .then(() => setSave('saved'), () => setSave('failed'));
    }, 1000);
    return () => clearTimeout(t);
  }, [state, projectId, trial]);

  const openExample = async (): Promise<void> => {
    try {
      dispatch({ type: 'load', state: await loadExample() });
      setProjectId(practice ? null : newId());
      setTask('home');
    } catch (e) {
      setNotice(`Couldn't load the O7 example: ${message(e)}`);
    }
  };

  /** Makes `s` a new current project; the previous one stays in the library. */
  const newProject = (s: AppState, next: Task): void => {
    dispatch({ type: 'load', state: s });
    setProjectId(practice ? null : newId());
    setTask(next);
  };

  const openProject = async (id: string): Promise<void> => {
    try {
      const e = await getProject(id);
      if (!e) throw new Error('it is no longer saved in this browser');
      setTour(null);
      setPractice(null);
      dispatch({ type: 'load', state: fromProjectJson(e.json).state });
      setProjectId(id);
      setTask('home');
    } catch (e) {
      setNotice(`Couldn't open that project: ${message(e)}`);
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
      setTour(null);
      setPractice(null);
      dispatch({ type: 'load', state: p.state });
      setProjectId(newId());
      setTask('home');
      setNotice(null);
    } catch (e) {
      setNotice(message(e));
    }
  };

  const dismissOffer = (): void => {
    setOfferTour(false);
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {
      // per-viewer convenience: the offer shows again next time
    }
  };

  /** Starts a tour on a fresh O7 example, saving and remembering the open project first (once, if already practising). */
  const startTour = async (id: TourId): Promise<void> => {
    try {
      if (projectId) {
        const savedAt = new Date().toISOString();
        await putProject({ id: projectId, name: state.chain.name, savedAt, json: toProjectJson(state, savedAt) });
        await setCurrentId(projectId);
      }
      const ex = await loadExample();
      setPractice((p) => p ?? { returnTo: projectId });
      dispatch({ type: 'load', state: ex });
      setProjectId(null);
      setTask('home');
      setTour({ id, i: 0, atStep: ex });
      setNotice(null);
    } catch (e) {
      setNotice(`Couldn't start the tutorial: ${message(e)}`);
    }
  };

  /** Ends practice and reopens the remembered project (the O7 example as a new project if there was none). */
  const endTour = async (finished: boolean): Promise<void> => {
    const back = practice?.returnTo ?? null;
    setTour(null);
    setPractice(null);
    try {
      const e = back ? await getProject(back) : undefined;
      if (e && back) {
        dispatch({ type: 'load', state: fromProjectJson(e.json).state });
        setProjectId(back);
      } else {
        dispatch({ type: 'load', state: await loadExample() });
        setProjectId(newId());
      }
      setTask('home');
      if (finished) setNotice(e ? 'Tutorial finished: your project is back.' : 'Tutorial finished.');
    } catch (err) {
      setNotice(`Couldn't reopen your project after the tutorial: ${message(err)}`);
    }
  };

  /** One step forward or back; the next step starts from the app as it is now (refs: a click step advances after its handler ran). */
  const moveTour = (d: 1 | -1): void => {
    const { tour: t, level: l, state: s } = latest.current;
    if (!t) return;
    const n = stepsFor(tourById(t.id), l).length;
    const i = Math.min(t.i, n - 1) + d;
    if (i >= n) {
      void endTour(true);
      return;
    }
    setTour({ ...t, i: Math.max(0, i), atStep: s });
  };
  const tourSteps = tour ? stepsFor(tourById(tour.id), level) : [];

  const grid = useMemo(() => evalGrid(state.chain, state.sweeps), [state.chain, state.sweeps]);
  const results = useMemo(() => (hasModel(state.chain) ? evaluateVariants(state, grid, caches.current) : []), [state.chain, state.variants, state.fits, state.sweeps, state.window, grid]);

  return (
    <div className="application">
      <TopBar name={state.chain.name} taskTitle={TASK_TITLE[task]} onHome={task === 'home' ? null : () => setTask('home')} level={level} onLevel={setLevel}
        save={save} sheets={PROFILES[level].sheets} onSheet={setSheet} onSave={saveFile} onOpen={(f) => { void openFile(f); }}
        theme={theme} onTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} practice={practice !== null} onExitTour={() => { void endTour(false); }} />
      {notice ? <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div> : null}
      {task === 'home' ? <Home onTask={setTask} level={level} onTour={(id) => { void startTour(id); }} offerTour={offerTour && !practice} onDismissOffer={dismissOffer} /> : null}
      {task === 'pastBuilds' ? <PastBuilds current={{ id: projectId, state }} level={level} onOpen={(id) => { void openProject(id); }} /> : null}
      {task === 'rigHistory' && level === 'engineer' ? <RigHistory onCopy={(s) => newProject(s, 'pastBuilds')} /> : null}
      {WORK.includes(task) ? (
        <ErrorBoundary onReset={() => { void openExample(); }}>
          <Workbench task={task as WorkTask} onTask={setTask} onNewProject={newProject} onOpenExample={() => { void openExample(); }} projectId={projectId} onTrial={(b) => setTrial(b ? { ...b, project: projectId } : null)} state={state} dispatch={dispatch} level={level} grid={grid} results={results} caches={caches.current} theme={theme} />
        </ErrorBoundary>
      ) : null}
      {sheet ? (
        <Sheet title={sheet === 'parts' ? 'Parts on hand' : 'Sweeps'} onClose={() => setSheet(null)}>
          {sheet === 'parts' ? <StockPanel state={state} dispatch={dispatch} /> : <SweepsPanel state={state} dispatch={dispatch} />}
        </Sheet>
      ) : null}
      {tour && tourSteps.length ? (
        <TourOverlay steps={tourSteps} index={Math.min(tour.i, tourSteps.length - 1)} ctx={{ state, atStep: tour.atStep, task, level }}
          onNext={() => moveTour(1)} onBack={() => moveTour(-1)} onExit={() => { void endTour(false); }} />
      ) : null}
    </div>
  );
}

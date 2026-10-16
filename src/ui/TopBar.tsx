import { LEVELS, type Level, PROFILES, type SheetKind } from '../present/level.ts';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'failed';
const SAVE_TEXT: Record<SaveStatus, string> = { idle: '', pending: 'Saving…', saved: 'Saved ✓', failed: 'Not saved: use Save project' };
const SHEET_TEXT: Record<SheetKind, string> = { parts: 'Parts on hand', sweeps: 'Sweeps' };

export interface TopBarProps {
  name: string;
  taskTitle: string;
  onHome: (() => void) | null;
  level: Level;
  onLevel: (l: Level) => void;
  save: SaveStatus;
  sheets: readonly SheetKind[];
  onSheet: (s: SheetKind) => void;
  onSave: () => void;
  onOpen: (f: File) => void;
  theme: 'light' | 'dark';
  onTheme: () => void;
  /** Practice mode (tutorial): nothing is saved, so the save status gives way to a practice note and Exit. */
  practice: boolean;
  onExitTour: () => void;
}

export function TopBar(p: TopBarProps) {
  return (
    <div className="window-title">
      <span className="topbar-left">
        {p.onHome ? <button onClick={p.onHome}>⌂ Home</button> : null}
        <b>RF NETWORK MODELLER</b>
        <span>{p.name}</span>
        {p.taskTitle ? <b>· {p.taskTitle}</b> : null}
      </span>
      <div className="window-actions">
        {p.practice ? (
          <>
            <span className="save-status practice" role="status">Practice: nothing here is saved</span>
            <button data-tour="exit-tour" onClick={p.onExitTour}>Exit tutorial</button>
          </>
        ) : <span className={`save-status ${p.save}`} role="status">{SAVE_TEXT[p.save]}</span>}
        {p.sheets.map((s) => <button key={s} onClick={() => p.onSheet(s)}>{SHEET_TEXT[s]}</button>)}
        <button onClick={p.onSave}>Save project</button>
        <label className="file-picker">Open project<input type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onOpen(f); e.target.value = ''; }} /></label>
        <label className="title-select">Level
          <select value={p.level} onChange={(e) => p.onLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{PROFILES[l].label}</option>)}
          </select>
        </label>
        <button className="theme-toggle" onClick={p.onTheme}>{p.theme === 'light' ? 'Dark' : 'Light'}</button>
      </div>
    </div>
  );
}

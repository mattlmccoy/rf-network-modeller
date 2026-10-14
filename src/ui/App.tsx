import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rfnm-theme', theme);
    } catch {
      // storage unavailable: the theme still applies for this session
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d1e20' : '#cfcfcd');
  }, [theme]);
  return (
    <div className="application">
      <div className="window-title">
        <span>RF NETWORK MODELLER</span>
        <div className="window-actions">
          <button className="theme-toggle" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? 'Dark' : 'Light'}</button>
        </div>
      </div>
      <main className="main-grid">
        <aside className="controls-column"><fieldset><legend>Project</legend><small>Loading…</small></fieldset></aside>
        <section className="readouts-column"><fieldset><legend>Block</legend><small>Select a block.</small></fieldset></section>
        <section className="charts-grid"><div className="circuit full-row"><small>Circuit</small></div></section>
      </main>
    </div>
  );
}

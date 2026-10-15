export type Task = 'home' | 'newSweep';

const TILES: readonly { task: Task | null; title: string; text: string }[] = [
  { task: 'newSweep', title: 'I measured a new sweep', text: 'Load it, see how it compares, get the next change to make' },
  { task: null, title: 'Try a change first', text: 'Swap a part and see what the VNA would show' },
  { task: null, title: 'Safe at full power?', text: 'Cap voltage and current, transformer flux' },
  { task: null, title: 'Start a new network', text: 'From a template or a blank board' },
  { task: null, title: 'Look back at past builds', text: 'Every build and its sweeps; compare two' },
];

/** What are you doing today? Tasks not built yet are disabled tiles marked "coming next" (spec §3). */
export function Home({ onTask }: { onTask: (t: Task) => void }) {
  return (
    <main className="home">
      <h2>What are you doing today?</h2>
      <div className="tiles">
        {TILES.map((t) => (
          <button key={t.title} className="tile" disabled={t.task === null} onClick={() => { if (t.task) onTask(t.task); }}>
            <b>{t.title}</b>
            <span>{t.text}</span>
            {t.task === null ? <em>coming next</em> : null}
          </button>
        ))}
      </div>
    </main>
  );
}

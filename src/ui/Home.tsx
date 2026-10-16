import type { Level } from '../present/level.ts';

export type WorkTask = 'newSweep' | 'tryChange' | 'safePower' | 'newNetwork';
export type Task = 'home' | WorkTask | 'pastBuilds' | 'rigHistory';

const TILES: readonly { task: Exclude<Task, 'home'>; title: string; text: string; engineerOnly?: boolean }[] = [
  { task: 'newSweep', title: 'I measured a new sweep', text: 'Load it, see how it compares, get the next change to make' },
  { task: 'tryChange', title: 'Try a change first', text: 'Swap a part and see what the VNA would show' },
  { task: 'safePower', title: 'Safe at full power?', text: 'Cap voltage and current, transformer flux' },
  { task: 'newNetwork', title: 'Start a new network', text: 'From a template or a blank board' },
  { task: 'pastBuilds', title: 'Look back at past builds', text: 'Every build and its sweeps; compare two' },
  { task: 'rigHistory', title: 'Rig history', text: 'Every configuration ever swept, read-only', engineerOnly: true },
];

/** What are you doing today? Rig history shows at Engineer level only ("hidden, not private", spec §2). */
export function Home({ onTask, level }: { onTask: (t: Task) => void; level: Level }) {
  return (
    <main className="home">
      <h2>What are you doing today?</h2>
      <div className="tiles">
        {TILES.filter((t) => !t.engineerOnly || level === 'engineer').map((t) => (
          <button key={t.title} className="tile" data-tour={`tile-${t.task}`} onClick={() => onTask(t.task)}>
            <b>{t.title}</b>
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

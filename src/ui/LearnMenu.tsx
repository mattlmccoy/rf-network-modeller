import type { Level } from '../present/level.ts';
import { toursFor } from '../tour/run.ts';
import type { TourId } from '../tour/tours.ts';

/** The tour list: one hands-on tour per task, on a practice copy of the O7 example (spec §2). */
export function LearnMenu({ level, onStart }: { level: Level; onStart: (id: TourId) => void }) {
  return (
    <section className="panel learn">
      <p>Each tour runs on a practice copy of the O7 example: nothing you do is saved, and your project comes back when it ends.</p>
      {toursFor(level).map((t) => (
        <div className="learn-row" key={t.id}>
          <div><b>{t.title}</b> <small>about {t.minutes} min</small><br /><small>{t.blurb}</small></div>
          <button onClick={() => onStart(t.id)}>Start</button>
        </div>
      ))}
    </section>
  );
}

import type { Tone, VerdictState } from '../present/verdict.ts';

/** What to do next, by verdict; no step numbers, since every task shows this card (reviewer pass). */
export const NEXT: Record<VerdictState, string> = {
  unknown: 'Load a sweep in “I measured a new sweep”, or fix the circuit, to get a verdict.',
  outside: '“I measured a new sweep” lists changes you can make from your parts.',
  little: 'Should work, with little room. “I measured a new sweep” lists changes that would add room.',
  some: 'Should work. Check “I measured a new sweep” before changing anything.',
  plenty: 'Should work, with margin. Check “I measured a new sweep” before changing anything.',
};

/** Beginner result: one plain verdict, where it comes from, and one next step (spec §7.4). */
export function VerdictCard({ text, tone, label, trustNote, next }: { text: string; tone: Tone; label: string; trustNote: string | null; next: string }) {
  return (
    <div className={`verdict-card ${tone}`} data-tour="verdict-card">
      <small>{label}</small>
      <b>{text}</b>
      {trustNote ? <small>{trustNote}</small> : null}
      <p>{next}</p>
    </div>
  );
}

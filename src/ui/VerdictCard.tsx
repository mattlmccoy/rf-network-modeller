import type { Tone, VerdictState } from '../present/verdict.ts';

const NEXT: Record<VerdictState, string> = {
  unknown: 'Load a sweep in the guide, or fix the circuit, to get a verdict.',
  outside: 'The guide (step 4) lists changes you can make from your parts.',
  little: 'It works. The guide lists changes that would add room.',
  some: 'It works. Check the guide before changing anything.',
  plenty: 'It works with margin. Check the guide before changing anything.',
};

/** Beginner result: one plain verdict and one next step (spec §7.4). */
export function VerdictCard({ text, tone, source, trustNote, state }: { text: string; tone: Tone; source: 'measured' | 'predicted'; trustNote: string | null; state: VerdictState }) {
  return (
    <div className={`verdict-card ${tone}`}>
      <small>{source === 'measured' ? 'From your sweep' : 'Predicted by the model'}</small>
      <b>{text}</b>
      {source === 'predicted' && trustNote ? <small>{trustNote}</small> : null}
      <p>{NEXT[state]}</p>
    </div>
  );
}

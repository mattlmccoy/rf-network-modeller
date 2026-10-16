import { useEffect, useState } from 'react';
import { type ResolvedStep, stepDone } from '../tour/run.ts';
import type { StepCtx } from '../tour/tours.ts';

interface Rect { top: number; left: number; width: number; height: number }
const find = (id: string | null): HTMLElement | null => (id ? document.querySelector<HTMLElement>(`[data-tour="${id}"]`) : null);
const measure = (el: HTMLElement | null): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width || r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
};

/** One tutorial step: a spotlight on the real control and a card that says what to do (spec §4). Never blocks the app. */
export function TourOverlay({ steps, index, ctx, onNext, onBack, onExit }: { steps: ResolvedStep[]; index: number; ctx: StepCtx; onNext: () => void; onBack: () => void; onExit: () => void }) {
  const step = steps[index];
  const [rect, setRect] = useState<Rect | null>(null);
  // room at the bottom of the page, so a target near the end can scroll above the card on a phone
  useEffect(() => {
    document.documentElement.classList.add('touring');
    return () => document.documentElement.classList.remove('touring');
  }, []);
  // follow the target while the step is shown (scrolling, layout shifts, a panel opening)
  useEffect(() => {
    find(step.target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setInterval(() => setRect(measure(find(step.target))), 200);
    setRect(measure(find(step.target)));
    return () => clearInterval(t);
  }, [step.id, step.target]);
  useEffect(() => {
    if (stepDone(step, ctx)) onNext();
  }, [ctx, step.id]);
  useEffect(() => {
    if (step.advance.kind !== 'click') return undefined;
    const onClick = (e: MouseEvent): void => {
      const el = find(step.target);
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(onNext, 0);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step.id, step.target]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) onExit(); // a field that used Escape to cancel its edit keeps the tour
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
  const pad = 6;
  const narrow = window.innerWidth < 768;
  const below = rect ? rect.top + rect.height + 12 : 0;
  const cardStyle = !rect || narrow ? undefined : below + 220 < window.innerHeight ? { top: below, left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) } : { top: Math.max(12, rect.top - 232), left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) };
  return (
    <div className="tour" role="dialog" aria-label={`Tutorial: ${step.title}`}>
      {rect ? <div className="tour-spot" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} /> : <div className="tour-dim" />}
      <div className={`tour-card${!rect ? ' centred' : ''}${narrow ? ' bottom' : ''}`} style={cardStyle}>
        <small>Step {index + 1} of {steps.length}</small>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="row">
          <button disabled={index === 0} onClick={onBack}>Back</button>
          {step.advance.kind === 'next' ? <button onClick={onNext}>{index === steps.length - 1 ? 'Finish' : 'Next'}</button> : <button onClick={onNext}>Skip step</button>}
          <button onClick={onExit}>Exit</button>
        </div>
      </div>
    </div>
  );
}

import { Fragment } from 'react';
import type { MeasuredLanding, VariantResult } from '../app/evaluate.ts';
import { fmtZ } from '../app/units.ts';

/** " (at 13.5000 MHz)" when a landing is read more than 10 kHz from 13.56 MHz, so a coarse grid never passes as exact. */
const atNote = (f: number): string => (Math.abs(f - 13.56e6) > 10e3 ? ` (at ${(f / 1e6).toFixed(4)} MHz)` : '');

export function LandingStrip({ names, colors, results, measured, clampNote }: { names: string[]; colors: string[]; results: VariantResult[]; measured: { label: string; color: string; landing: MeasuredLanding | null } | null; clampNote: string | null }) {
  const inCount = results.filter((r) => r.landing?.inWindow).length;
  return (
    <div className="landing full-row">
      <b>13.56 MHz landing</b><b>Z at the AIT-out plane</b><b>AIT window</b><b>Drift room up / down</b>
      {results.map((r, i) => (
        <Fragment key={names[i]}>
          <span><i className="swatch" style={{ background: colors[i] }} />{names[i]}</span>
          {r.error ? <span className="error">{r.error}</span> : (
            <>
              <span>{r.landing ? `${fmtZ(r.landing.z)}${atNote(r.landing.f)}` : 'no 12.5–14.6 MHz points'}{r.outOfRange ? <em className="warn-text"> · branch read outside its sweep</em> : null}</span>
              <span className={r.landing?.inWindow ? 'ok' : 'bad'}>{r.landing?.inWindow ? 'in' : 'out'}</span>
              <span>{r.landing?.inWindow ? `+${r.landing.roomUp.toFixed(2)} % / +${r.landing.roomDown.toFixed(2)} %` : '—'}</span>
            </>
          )}
        </Fragment>
      ))}
      {measured ? (
        <>
          <span><i className="swatch" style={{ background: measured.color }} />{measured.label} (measured)</span>
          <span>{measured.landing ? `${fmtZ(measured.landing.z)}${atNote(measured.landing.f)}` : <em className="warn-text">no point near 13.56 MHz in this sweep</em>}</span><span /><span />
        </>
      ) : null}
      {clampNote ? <span className="landing-total warn-text">{clampNote}</span> : null}
      <span className="landing-total">{inCount} of {results.length} variants put 13.56 MHz inside the AIT window.</span>
    </div>
  );
}

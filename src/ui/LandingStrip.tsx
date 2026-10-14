import { Fragment } from 'react';
import type { Complex } from '../engine/complex.ts';
import type { VariantResult } from '../app/evaluate.ts';
import { fmtZ } from '../app/units.ts';

export function LandingStrip({ names, colors, results, measured }: { names: string[]; colors: string[]; results: VariantResult[]; measured: { label: string; z: Complex } | null }) {
  const inCount = results.filter((r) => r.landing?.inWindow).length;
  return (
    <div className="landing full-row">
      <b>13.56 MHz landing</b><b>Z at the AIT-out plane</b><b>AIT window</b><b>Drift room up / down</b>
      {results.map((r, i) => (
        <Fragment key={names[i]}>
          <span><i className="swatch" style={{ background: colors[i] }} />{names[i]}</span>
          {r.error ? <span className="error">{r.error}</span> : (
            <>
              <span>{r.landing ? fmtZ(r.landing.z) : 'no 12.5–14.6 MHz points'}{r.outOfRange ? <em className="warn-text"> · branch read outside its sweep</em> : null}</span>
              <span className={r.landing?.inWindow ? 'ok' : 'bad'}>{r.landing?.inWindow ? 'in' : 'out'}</span>
              <span>{r.landing?.inWindow ? `+${r.landing.roomUp.toFixed(2)} % / +${r.landing.roomDown.toFixed(2)} %` : '—'}</span>
            </>
          )}
        </Fragment>
      ))}
      {measured ? (
        <>
          <span><i className="swatch" style={{ background: '#777777' }} />{measured.label} (measured)</span>
          <span>{fmtZ(measured.z)}</span><span /><span />
        </>
      ) : null}
      <span className="landing-total">{inCount} of {results.length} variants put 13.56 MHz inside the AIT window.</span>
    </div>
  );
}

import type { Complex } from '../engine/complex.ts';
import type { Window } from '../chain/types.ts';
import { TARGET, targetPos } from '../app/plotmath.ts';
import { WORDS } from '../present/words.ts';

const X0 = 44;
const Y0 = 186;
const PW = 246;
const PH = 168;
const X = (u: number): number => X0 + u * PW;
const Y = (v: number): number => Y0 - v * PH;
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function Marker({ z, kind, label }: { z: Complex | null; kind: 'measured' | 'predicted' | 'ghost'; label: string }) {
  const t = z ? targetPos(z) : null;
  if (!t) return null;
  return (
    <g className={`mark ${kind}`}>
      <circle cx={X(t.u)} cy={Y(t.v)} r={6} fill={kind === 'measured' ? undefined : 'none'} strokeDasharray={kind === 'ghost' ? '3 2' : undefined} />
      <text x={X(t.u) + 10} y={Y(t.v) + 4}>{label}{t.pinned ? ' (off the scale)' : ''}</text>
    </g>
  );
}

/** Builder result: the tuner's window, your sweep's point and the model's (spec §7.4). */
export function TargetBox({ window: w, measured, measuredLabel, predicted, ghost, ghostLabel }: { window: Window; measured: Complex | null; measuredLabel: string; predicted: Complex | null; ghost: Complex | null; ghostLabel: string }) {
  const x1 = X(clamp01(w.rLo / TARGET.rMax));
  const x2 = X(clamp01(w.rHi / TARGET.rMax));
  const y1 = Y(clamp01(w.xHi / TARGET.xMax));
  const y2 = Y(clamp01(w.xLo / TARGET.xMax));
  return (
    <svg className="target" viewBox="0 0 310 214" role="img" aria-label={`${WORDS.landing} at 13.56 MHz`}>
      <line x1={X0} y1={Y0} x2={X(1)} y2={Y0} className="axis" />
      <line x1={X0} y1={Y0} x2={X0} y2={Y(1)} className="axis" />
      <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} className="win" />
      <text x={(x1 + x2) / 2} y={y1 - 5} textAnchor="middle">{WORDS.window}</text>
      <text x={X(0.5)} y={208} textAnchor="middle">resistance at 13.56 MHz (Ω), 0 to {TARGET.rMax}</text>
      <text x={14} y={Y(0.5)} transform={`rotate(-90 14 ${Y(0.5)})`} textAnchor="middle">reactance (Ω), 0 to {TARGET.xMax}</text>
      <Marker z={predicted} kind="predicted" label="model predicts" />
      <Marker z={ghost} kind="ghost" label={ghostLabel} />
      <Marker z={measured} kind="measured" label={measuredLabel ? `your sweep (${measuredLabel})` : 'your sweep'} />
    </svg>
  );
}

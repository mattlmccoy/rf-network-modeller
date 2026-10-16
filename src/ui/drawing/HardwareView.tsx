import { useMemo } from 'react';
import { findBlock } from '../../chain/state.ts';
import { layoutChain } from '../../present/layout.ts';
import { COPPER, type DrawingProps, PartLabel, S, frame, hardwareSymbol, partValue, sizeStyle, vbString } from './symbols.tsx';

/** Builder drawing: the cage side view; every ground drops to the cage floor (spec §6.1). */
export function HardwareView({ chain, selected, highlight, onSelect, cableM }: DrawingProps) {
  const l = useMemo(() => layoutChain(chain), [chain]);
  const top = l.minY * S - 44;
  const floor = (l.maxY + 1) * S;
  const left = l.minX * S - 24;
  const right = l.maxX * S + 110;
  const py = l.port.y * S;
  const vb = { x: left - 132, y: top - 6, w: right - left + 140, h: floor - top + 26 };
  return (
    <svg className="drawing" viewBox={vbString(vb)} style={sizeStyle(vb)} role="img" aria-label="Circuit hardware view">
      <rect x={left} y={top} width={right - left} height={floor - top} className="cage" />
      <text x={left + 6} y={top + 14} className="s">Faraday cage (its walls and floor are ground)</text>
      <line x1={left} y1={floor} x2={right} y2={floor} className="floor" />
      <rect x={left - 126} y={py - 30} width={86} height={60} rx={6} className="genbox" />
      <text x={left - 83} y={py - 4} textAnchor="middle" className="t">Generator</text>
      <text x={left - 83} y={py + 12} textAnchor="middle" className="s">+ auto-tuner</text>
      <line x1={left - 40} y1={py} x2={l.port.x * S} y2={py} stroke={COPPER} strokeWidth={5} />
      {l.wires.map((w, i) => <line key={i} x1={w.a.x * S} y1={w.a.y * S} x2={w.b.x * S} y2={w.b.y * S} stroke={COPPER} strokeWidth={5} strokeLinecap="round" />)}
      {l.grounds.map((g, i) => <line key={i} x1={g.x * S} y1={g.y * S} x2={g.x * S} y2={floor} stroke={COPPER} strokeWidth={5} />)}
      {l.junctions.map((j, i) => <circle key={i} cx={j.x * S} cy={j.y * S} r={5} fill={COPPER} />)}
      {l.parts.map((p) => {
        const b = findBlock(chain, p.id);
        return (
          <g key={p.id} className={`part${selected === p.id ? ' selected' : ''}${highlight.includes(p.id) ? ' highlight' : ''}`} data-tour={`part-${p.id}`} onClick={() => onSelect(p.id)} role="button" aria-label={b?.label ?? p.id}>
            <rect x={p.x * S - 4} y={p.y * S - 4} width={p.w * S + 8} height={p.h * S + 8} className="hit" />
            <g transform={frame(p)}>{hardwareSymbol(p, b)}</g>
            <PartLabel p={p} title={b?.label ?? p.id} value={b ? partValue(b, cableM) : ''} />
          </g>
        );
      })}
    </svg>
  );
}

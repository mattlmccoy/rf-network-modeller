import { useMemo } from 'react';
import { findBlock } from '../../chain/state.ts';
import { layoutChain } from '../../present/layout.ts';
import { type DrawingProps, PartLabel, S, frame, groundPath, partValue, schematicBox, schematicSymbol, sizeStyle, vbString } from './symbols.tsx';

/** Engineer drawing: a wired schematic with plain labels (spec §6.1). */
export function SchematicView({ chain, selected, highlight, onSelect, cableM }: DrawingProps) {
  const l = useMemo(() => layoutChain(chain), [chain]);
  const vb = schematicBox(l);
  return (
    <svg className="drawing" viewBox={vbString(vb)} style={sizeStyle(vb)} role="img" aria-label="Circuit schematic">
      {l.wires.map((w, i) => <line key={i} x1={w.a.x * S} y1={w.a.y * S} x2={w.b.x * S} y2={w.b.y * S} className="sym" />)}
      {l.junctions.map((j, i) => <circle key={i} cx={j.x * S} cy={j.y * S} r={4} className="dot" />)}
      {l.grounds.map((g, i) => <path key={i} d={groundPath(g)} className="sym" />)}
      <circle cx={l.port.x * S - 10} cy={l.port.y * S} r={8} className="sym" />
      <text x={l.port.x * S - 10} y={l.port.y * S - 16} textAnchor="middle" className="t">Tuner</text>
      {l.parts.map((p) => {
        const b = findBlock(chain, p.id);
        return (
          <g key={p.id} className={`part${selected === p.id ? ' selected' : ''}${highlight.includes(p.id) ? ' highlight' : ''}`} onClick={() => onSelect(p.id)} role="button" aria-label={b?.label ?? p.id}>
            <rect x={p.x * S - 4} y={p.y * S - 4} width={p.w * S + 8} height={p.h * S + 8} className="hit" />
            <g transform={frame(p)}>{schematicSymbol(p)}</g>
            <PartLabel p={p} title={b?.label ?? p.id} value={b ? partValue(b, cableM) : ''} />
          </g>
        );
      })}
    </svg>
  );
}

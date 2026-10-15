import type { CSSProperties, ReactNode } from 'react';
import { partTotal } from '../../blocks/ht50.ts';
import type { Block, Chain } from '../../chain/types.ts';
import { blockSummary } from '../../app/units.ts';
import { BOX, type Layout, type PartBox, type Pt } from '../../present/layout.ts';
import { wrapWords } from '../../present/words.ts';

export interface DrawingProps { chain: Chain; selected: string | null; highlight: readonly string[]; onSelect: (id: string) => void; cableM: number }

/** px per grid unit; HALF is half a part box's length in px. */
export const S = 46;
const HALF = (BOX * S) / 2;
export const COPPER = '#c97a3a';

/** A part's local frame: it runs along +x centred on (0, 0); vertical parts are rotated 90°. */
export const frame = (p: PartBox): string => `translate(${(p.x + p.w / 2) * S} ${(p.y + p.h / 2) * S}) rotate(${p.dir === 'v' ? 90 : 0})`;
export interface VB { x: number; y: number; w: number; h: number }
export const vbString = (v: VB): string => `${v.x} ${v.y} ${v.w} ${v.h}`;
export const schematicBox = (l: Layout): VB => ({ x: l.minX * S - 50, y: l.minY * S - 60, w: (l.maxX - l.minX) * S + 200, h: (l.maxY - l.minY) * S + 130 });
/** Natural size when it fits; shrinks with the panel but never below 80 %, past which the panel scrolls sideways. */
export const sizeStyle = (v: VB): CSSProperties => ({ width: v.w, maxWidth: '100%', minWidth: v.w * 0.8, height: 'auto' });
export const groundPath = (g: Pt): string => {
  const x = g.x * S;
  const y = g.y * S;
  return `M${x - 12} ${y} H${x + 12} M${x - 8} ${y + 5} H${x + 8} M${x - 4} ${y + 10} H${x + 4}`;
};
/** Value text under a part; a coax says its length, never "variant" (spec §11). */
export const partValue = (b: Block, cableM: number): string => (b.type === 'coax' ? `${cableM} m cable` : blockSummary(b));

export function schematicSymbol(p: PartBox): ReactNode {
  const L = HALF;
  switch (p.kind) {
    case 'capBank':
    case 'C':
      return <path className="sym" d={`M${-L} 0 H-4 M4 0 H${L} M-4 -13 V13 M4 -13 V13`} />;
    case 'inductor':
    case 'L':
      return <path className="sym" d={`M${-L} 0 H-20 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 a5 5 0 0 1 10 0 H${L}`} />;
    case 'R':
      return <path className="sym" d={`M${-L} 0 H-18 l3 -7 l6 14 l6 -14 l6 14 l6 -14 l6 14 l3 -7 H${L}`} />;
    case 'wire':
    case 'short':
      return <path className="sym" d={`M${-L} 0 H${L}`} />;
    case 'coax':
      return <g><path d={`M${-L} 0 H${L}`} stroke="#8a8a8e" strokeWidth={7} /><path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={2} /></g>;
    case 'stack':
    case 'ideal':
      return (
        <g className="sym">
          <path d={`M${-L} 0 H-18 V-15 H-12 M${L} 0 H18 V-15 H12`} />
          <path d="M-12 -15 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 a5 5 0 0 1 0 10 M12 -15 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10 a5 5 0 0 0 0 10" />
          <path d="M-3 -17 V17 M3 -17 V17" />
          <path d="M-12 15 H-18 V22 M-24 22 H-12 M-21 26 H-15 M12 15 H18 V22 M12 22 H24 M15 26 H21" />
        </g>
      );
    case 'measured':
      return (
        <g className="sym">
          <path d={`M${-L} 0 H-16 M16 0 H${L}`} />
          <rect x={-16} y={-14} width={32} height={28} rx={3} strokeDasharray="4 3" />
          <path d="M-6 -8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 M6 -8 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 M0 -9 V9" />
        </g>
      );
    case 'plates':
      return <g><path className="sym" d={`M${-L} 0 H-6 M6 0 H${L}`} /><path d="M-6 -14 V14 M6 -14 V14" stroke={COPPER} strokeWidth={4} /><rect x={-3} y={-3} width={6} height={6} className="cube" /></g>;
  }
}

export function hardwareSymbol(p: PartBox, b: Block | undefined): ReactNode {
  const L = HALF;
  const lead = (inner: number): ReactNode => <path d={`M${-L} 0 H${-inner} M${inner} 0 H${L}`} stroke={COPPER} strokeWidth={5} />;
  switch (p.kind) {
    case 'wire':
    case 'inductor':
    case 'L':
    case 'short':
      return <path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={5} strokeLinecap="round" />;
    case 'coax':
      return <g><path d={`M${-L} 0 H${L}`} stroke="#8a8a8e" strokeWidth={8} /><path d={`M${-L} 0 H${L}`} stroke={COPPER} strokeWidth={2} /></g>;
    case 'capBank':
    case 'C': {
      const n = b?.type === 'capBank' ? Math.min(4, Math.max(1, partTotal(b.counts))) : 1;
      const h = n * 11;
      return (
        <g>
          {lead(L - 5)}
          <rect x={-L + 4} y={-h / 2} width={4} height={h} fill={COPPER} />
          <rect x={L - 8} y={-h / 2} width={4} height={h} fill={COPPER} />
          {Array.from({ length: n }, (_, i) => <rect key={i} x={-L + 10} y={-h / 2 + i * 11 + 1.5} width={2 * L - 20} height={8} rx={3} className="puck" />)}
        </g>
      );
    }
    case 'R':
      return <g>{lead(14)}<rect x={-14} y={-6} width={28} height={12} rx={3} fill="#8a5a2b" /></g>;
    case 'stack':
      return <g>{lead(16)}<rect x={-15} y={-20} width={12} height={40} rx={3} className="ferrite" /><rect x={3} y={-20} width={12} height={40} rx={3} className="ferrite" /><path d="M-18 -8 H18 M-18 0 H18 M-18 8 H18" stroke={COPPER} strokeWidth={2} /></g>;
    case 'ideal':
      return <g>{lead(10)}<rect x={-8} y={-20} width={16} height={40} rx={3} className="ferrite" /><path d="M-12 -8 H12 M-12 0 H12 M-12 8 H12" stroke={COPPER} strokeWidth={2} /></g>;
    case 'measured':
      return <g>{lead(20)}<rect x={-20} y={-20} width={40} height={40} rx={4} className="dashed" /><rect x={-15} y={-14} width={10} height={28} rx={2} className="ferrite" /><path d="M3 -14 V14 M13 -14 V14" stroke={COPPER} strokeWidth={4} /><rect x={5} y={-4} width={6} height={8} className="cube" /></g>;
    case 'plates':
      return <g>{lead(10)}<path d="M-10 -20 V20 M10 -20 V20" stroke={COPPER} strokeWidth={5} /><rect x={-7} y={-12} width={14} height={24} className="bed" /><rect x={-4} y={-4} width={8} height={8} className="cube" /></g>;
  }
}

/** Name above (horizontal parts) or to the right (vertical parts), value below or under the name; long text wraps. */
export function PartLabel({ p, title, value }: { p: PartBox; title: string; value: string }) {
  const t = wrapWords(title, 16);
  const v = value ? wrapWords(value, 20) : [];
  const cx = (p.x + p.w / 2) * S;
  if (p.dir === 'h') {
    const top = p.y * S - 6 - (t.length - 1) * 12;
    return (
      <g>
        {t.map((line, i) => <text key={`t${i}`} x={cx} y={top + i * 12} textAnchor="middle" className="t">{line}</text>)}
        {v.map((line, i) => <text key={`v${i}`} x={cx} y={(p.y + p.h) * S + 13 + i * 11} textAnchor="middle" className="s">{line}</text>)}
      </g>
    );
  }
  const lines = [...t.map((text) => ({ text, cls: 't' })), ...v.map((text) => ({ text, cls: 's' }))];
  const x = (p.x + p.w) * S + 6;
  const y0 = (p.y + p.h / 2) * S - ((lines.length - 1) * 12) / 2 + 3;
  return <g>{lines.map((l, i) => <text key={i} x={x} y={y0 + i * 12} className={l.cls}>{l.text}</text>)}</g>;
}

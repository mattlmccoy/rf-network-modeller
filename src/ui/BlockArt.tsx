import type { ReactNode } from 'react';
import { CAP_VALUES } from '../blocks/ht50.ts';
import type { Block } from '../chain/types.ts';

const LINE = { stroke: 'currentColor', fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const COIL = 'M2 16H12a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0H62';
const RESISTOR = 'M2 16H14l3-7l6 14l6-14l6 14l6-14l6 14l3-7H62';
const CAPACITOR = 'M2 16H29M35 16H62M29 6V26M35 6V26';
const TRANSFORMER = 'M2 6H18M2 26H18M18 6a4 4 0 0 1 0 6.7a4 4 0 0 1 0 6.6a4 4 0 0 1 0 6.7M46 6a4 4 0 0 0 0 6.7a4 4 0 0 0 0 6.6a4 4 0 0 0 0 6.7M46 6H62M46 26H62M30 4V28M34 4V28';
const label = (text: string, y = 20, size = 9): ReactNode => <text x="32" y={y} fontSize={size} textAnchor="middle" fill="currentColor" stroke="none">{text}</text>;

function symbol(b: Block): ReactNode {
  switch (b.type) {
    case 'capBank': return <path d={CAPACITOR} />;
    case 'plates': return <><path d={CAPACITOR} /><path d="M24 29H40" /></>;
    case 'inductor': return <path d={COIL} />;
    case 'wire': return <path d="M2 16H62" strokeDasharray="4 3" />;
    case 'coax': return <><circle cx="32" cy="16" r="9" /><circle cx="32" cy="16" r="2" /><path d="M2 16H23M41 16H62" /></>;
    case 'measuredBranch': return <><rect x="16" y="7" width="32" height="18" rx="2" /><path d="M2 16H16M48 16H62" />{label('Z(f)')}</>;
    case 'stack':
    case 'ideal': return <path d={TRANSFORMER} />;
    case 'primitive': return <path d={b.kind === 'R' ? RESISTOR : b.kind === 'L' ? COIL : b.kind === 'C' ? CAPACITOR : 'M2 16H62'} />;
    default: return null;
  }
}

function physical(b: Block): ReactNode {
  switch (b.type) {
    case 'capBank': {
      const parts = CAP_VALUES.flatMap((v) => Array.from({ length: b.counts[v] }, () => v)).slice(0, 6);
      if (!parts.length) return label('empty');
      const step = 56 / parts.length;
      return <>{parts.map((v, i) => <circle key={i} cx={4 + step * (i + 0.5)} cy="16" r={v === 100 ? 7 : v === 50 ? 5.5 : 4.5} fill="rgba(201,139,74,.35)" />)}</>;
    }
    case 'inductor': return <path d={COIL} strokeWidth="2.4" />;
    case 'wire': return <path d="M2 16C12 4 20 28 32 16S52 4 62 16" strokeWidth="2.2" />;
    case 'coax': return <><rect x="6" y="11" width="52" height="10" rx="5" fill="rgba(0,0,0,.08)" /><path d="M2 16H6M58 16H62" /></>;
    case 'measuredBranch': return <><rect x="8" y="4" width="48" height="24" rx="3" /><path d="M12 22C20 8 28 8 32 16S44 26 52 10" /></>;
    case 'stack': return <><ellipse cx="21" cy="15" rx="12" ry="10" /><ellipse cx="21" cy="15" rx="5" ry="4" /><ellipse cx="43" cy="15" rx="12" ry="10" /><ellipse cx="43" cy="15" rx="5" ry="4" />{label(`${b.unit.N_p}:${Math.round(b.unit.n * b.unit.N_p)}`, 31, 7)}</>;
    case 'plates': return <><path d="M16 3V29M48 3V29" strokeWidth="3" /><rect x="27" y="11" width="10" height="10" fill="rgba(60,60,60,.45)" /></>;
    case 'primitive':
      if (b.kind === 'R') return <><path d="M2 16H18M46 16H62" /><rect x="18" y="10" width="28" height="12" rx="4" fill="rgba(201,139,74,.25)" /></>;
      if (b.kind === 'C') return <><path d="M2 16H24M40 16H62" /><circle cx="32" cy="16" r="8" fill="rgba(201,139,74,.35)" /></>;
      if (b.kind === 'L') return <path d={COIL} strokeWidth="2.4" />;
      return <path d="M2 16H62" strokeWidth="3" />;
    case 'ideal': return <path d={TRANSFORMER} />;
    default: return null;
  }
}

/** A 64 × 32 drawing of a block: what you would build (physical) or its standard symbol. */
export function BlockArt({ block, view }: { block: Block; view: 'physical' | 'symbol' }) {
  return (
    <svg className="block-art" viewBox="0 0 64 32" width="64" height="32" aria-hidden="true">
      <g {...LINE}>{view === 'physical' ? physical(block) : symbol(block)}</g>
    </svg>
  );
}

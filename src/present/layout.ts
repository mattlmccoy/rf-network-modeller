import type { Block, Chain } from '../chain/types.ts';

export type PartKind = 'coax' | 'capBank' | 'inductor' | 'wire' | 'R' | 'L' | 'C' | 'short' | 'stack' | 'ideal' | 'measured' | 'plates';
export type Dir = 'h' | 'v';
export interface Pt { x: number; y: number }
/** A part's box in grid units: (x, y) is its top-left corner; it runs along `dir`. */
export interface PartBox { id: string; kind: PartKind; x: number; y: number; w: number; h: number; dir: Dir }
export interface Seg { a: Pt; b: Pt }
export interface Layout { parts: PartBox[]; wires: Seg[]; junctions: Pt[]; grounds: Pt[]; port: Pt; minX: number; minY: number; maxX: number; maxY: number }

/** Each series part takes PITCH along its line; its box is BOX long and 1 wide. */
export const PITCH = 2.4;
export const BOX = 1.4;
const GAP = (PITCH - BOX) / 2;
/** Room left after a hanging branch for the labels drawn to its right. */
const LABEL_ROOM = 2.2;
/** Room between parallel arms on a horizontal line for a value label below one arm and a title above the next. */
const ARM_LABEL_ROOM = 1.2;

function kindOf(b: Block): PartKind {
  switch (b.type) {
    case 'primitive':
      return b.kind;
    case 'measuredBranch':
      return 'measured';
    case 'shunt':
    case 'parallel':
      throw new Error(`"${b.id}" is a container, not a part`);
    default:
      return b.type;
  }
}

/** A line: origin and direction. u runs along it; w runs across (+w is down for 'h', right for 'v'). */
interface Line { o: Pt; dir: Dir }
const at = (l: Line, u: number, w: number): Pt => (l.dir === 'h' ? { x: l.o.x + u, y: l.o.y + w } : { x: l.o.x + w, y: l.o.y + u });
const perp = (d: Dir): Dir => (d === 'h' ? 'v' : 'h');

interface Acc { parts: PartBox[]; wires: Seg[]; junctions: Pt[]; grounds: Pt[] }
/** After laying a run: the last terminal, the next free u, and how far anything reached across (+w). */
interface Run { cursor: Pt; u: number; extent: number }

function part(acc: Acc, l: Line, b: Block, u: number): Pt {
  const s = at(l, u + GAP, 0);
  acc.parts.push(l.dir === 'h'
    ? { id: b.id, kind: kindOf(b), x: s.x, y: s.y - 0.5, w: BOX, h: 1, dir: 'h' }
    : { id: b.id, kind: kindOf(b), x: s.x - 0.5, y: s.y, w: 1, h: BOX, dir: 'v' });
  return at(l, u + GAP + BOX, 0);
}

/** Lay blocks along a line from u0, wiring from `cursor`; with `endLoad`, a final shunt continues the line to ground. */
function run(acc: Acc, blocks: readonly Block[], l: Line, cursor: Pt, u0: number, endLoad: boolean): Run {
  let u = u0;
  let cur = cursor;
  let extent = 0.5;
  blocks.forEach((b, i) => {
    if (b.type === 'shunt' && endLoad && i === blocks.length - 1) {
      const r = run(acc, b.chain, l, cur, u, false);
      const g = at(l, r.u + GAP, 0);
      acc.wires.push({ a: r.cursor, b: g });
      acc.grounds.push(g);
      extent = Math.max(extent, r.extent);
      cur = g;
      u = r.u + PITCH;
    } else if (b.type === 'shunt') {
      const j = at(l, u + 0.5, 0);
      acc.wires.push({ a: cur, b: j });
      acc.junctions.push(j);
      const child: Line = { o: j, dir: perp(l.dir) };
      const r = run(acc, b.chain, child, j, 0, false);
      const g = at(child, r.u + GAP, 0);
      acc.wires.push({ a: r.cursor, b: g });
      acc.grounds.push(g);
      extent = Math.max(extent, r.u + GAP);
      cur = j;
      u += 0.5 + Math.max(1, r.extent + 0.5) + LABEL_ROOM;
    } else if (b.type === 'parallel') {
      const a = at(l, u + 0.5, 0);
      acc.wires.push({ a: cur, b: a });
      acc.junctions.push(a);
      const arms: { r: Run; off: number }[] = [];
      let off = 0;
      for (const arm of b.chains) {
        const armLine: Line = { o: at(l, 0, off), dir: l.dir };
        const start = at(armLine, u + 0.5, 0);
        if (off !== 0) acc.wires.push({ a, b: start });
        const r = run(acc, arm, armLine, start, u + 0.5, false);
        arms.push({ r, off });
        off += r.extent + 0.5 + (l.dir === 'h' ? ARM_LABEL_ROOM : LABEL_ROOM);
      }
      const uB = Math.max(u + 1, ...arms.map((x) => x.r.u)) + GAP;
      const bj = at(l, uB, 0);
      for (const { r, off: o } of arms) {
        const end = at(l, uB, o);
        if (r.cursor.x !== end.x || r.cursor.y !== end.y) acc.wires.push({ a: r.cursor, b: end });
        if (o !== 0) acc.wires.push({ a: end, b: bj });
      }
      acc.junctions.push(bj);
      const last = arms.at(-1);
      if (last) extent = Math.max(extent, last.off + last.r.extent);
      cur = bj;
      u = uB;
    } else {
      acc.wires.push({ a: cur, b: at(l, u + GAP, 0) });
      cur = part(acc, l, b, u);
      u += PITCH;
    }
  });
  return { cursor: cur, u, extent };
}

/** Ladder geometry for a chain: main line rightward from the port, shunts perpendicular to their line (spec §6.1). */
export function layoutChain(chain: Chain): Layout {
  const acc: Acc = { parts: [], wires: [], junctions: [], grounds: [] };
  const port: Pt = { x: 0, y: 0 };
  run(acc, chain.blocks, { o: port, dir: 'h' }, port, 0, true);
  const xs = [port.x, ...acc.parts.flatMap((p) => [p.x, p.x + p.w]), ...acc.wires.flatMap((s) => [s.a.x, s.b.x]), ...acc.grounds.map((g) => g.x)];
  const ys = [port.y, ...acc.parts.flatMap((p) => [p.y, p.y + p.h]), ...acc.wires.flatMap((s) => [s.a.y, s.b.y]), ...acc.grounds.map((g) => g.y + 0.6)];
  const flat = acc.parts.length === 0;
  return { ...acc, port, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: flat ? 0 : Math.max(...ys) };
}

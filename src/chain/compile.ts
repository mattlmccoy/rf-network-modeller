import { type Complex, ZERO, add, cx, inv } from '../engine/complex.ts';
import { coaxY } from '../engine/coax.ts';
import { type Element, type Netlist, inputImpedance } from '../engine/mna.ts';
import { unitY } from '../engine/transformer.ts';
import type { Y2 } from '../engine/twoport.ts';
import { branchOutOfRange, buildBranchTable, twoTerminalZ } from './blockZ.ts';
import { duplicateIds } from './state.ts';
import type { Block, BranchCache, BranchTable, Chain, Context, MeasuredBranchBlock, ZFn } from './types.ts';

export class ChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChainError';
  }
}

export interface RunPart { blockId: string; z: ZFn }
/** A maximal run of series two-terminal blocks between nodes a and b, solved as one admittance 1/Σz. */
export interface Run { a: number; b: number; parts: RunPart[] }
export interface TwoPortRef { blockId: string; kind: 'coax' | 'stack'; a: number; b: number; y: (f: number) => Y2 }
export interface BranchRef { block: MeasuredBranchBlock; table: BranchTable }
export interface Compiled { net: Netlist; runs: Run[]; twoPorts: TwoPortRef[]; branches: BranchRef[] }

/** Admittance standing in for a run whose impedances cancel exactly at one frequency only (a 1 nΩ short). */
export const SHORT_Y = 1e9;

const PROBE_F = [1e6, 13.56e6, 30e6];
/** True when the run's impedances cancel exactly at every probe frequency (e.g. +L then −L): a true short. */
function cancels(parts: RunPart[]): boolean {
  return PROBE_F.every((f) => {
    const z = parts.reduce((acc, p) => add(acc, p.z(f)), ZERO);
    return z.re === 0 && z.im === 0;
  });
}

/**
 * Admittance of a series run. An open part (infinite z) makes the run carry no current; a NaN part makes it invalid;
 * parts that cancel exactly (Σz = 0) act as a short.
 */
export function seriesY(parts: RunPart[], f: number): Complex {
  let z = ZERO;
  for (const p of parts) {
    const zp = p.z(f);
    if (Number.isNaN(zp.re) || Number.isNaN(zp.im)) return cx(Number.NaN, Number.NaN);
    if (!Number.isFinite(zp.re) || !Number.isFinite(zp.im)) return ZERO;
    z = add(z, zp);
  }
  if (z.re === 0 && z.im === 0) return cx(SHORT_Y);
  return inv(z);
}

export function compile(chain: Chain, ctx: Context): Compiled {
  const dup = duplicateIds(chain);
  if (dup.length) throw new ChainError(`duplicate block id(s) ${dup.join(', ')}: every block needs its own id`);
  const parent: number[] = [0]; // union-find over node ids; 0 = ground and always its own root
  const alloc = (): number => {
    parent.push(parent.length);
    return parent.length - 1;
  };
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    while (parent[x] !== r) {
      const next = parent[x];
      parent[x] = r;
      x = next;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rb === 0) parent[ra] = 0;
    else parent[rb] = ra;
  };
  const cache: BranchCache = ctx.cache ?? new Map();
  const tableFor = (sweepId: string): BranchTable => {
    const s = ctx.sweeps[sweepId];
    if (!s) throw new ChainError(`the measured branch needs sweep "${sweepId}", which is not loaded`);
    const c = ctx.variant.cable;
    const key = `${sweepId}|${c.length}|${c.vf}|${c.z0}|${c.alpha13}|${ctx.variant.Lj}`;
    const hit = cache.get(key);
    if (hit && hit.sweep === s) return hit.table;
    const table = buildBranchTable(s, ctx.variant);
    cache.set(key, { sweep: s, table });
    return table;
  };
  const runs: Run[] = [];
  const twoPorts: TwoPortRef[] = [];
  const branches: BranchRef[] = [];
  const ideals: { p1: number; s1: number; n: number }[] = [];
  const cable = ctx.variant.cable;
  const port = alloc();

  /** Walks a path; returns its end node and whether it passed through any element (or an explicit short). */
  const walk = (blocks: Block[], start: number): [number, boolean] => {
    let node = start;
    let pending: RunPart[] = [];
    let open = false;
    let carried = false;
    const flush = (): void => {
      if (open) node = alloc();
      else if (pending.length && !cancels(pending)) {
        const e = alloc();
        runs.push({ a: node, b: e, parts: pending });
        node = e;
      }
      pending = [];
      open = false;
    };
    for (const b of blocks) {
      if (b.type === 'coax') {
        flush();
        carried = true;
        if (!(cable.length > 0)) continue; // a zero-length line passes straight through (final review I2)
        const e = alloc();
        twoPorts.push({ blockId: b.id, kind: 'coax', a: node, b: e, y: (f) => coaxY(cable, f) });
        node = e;
      } else if (b.type === 'stack') {
        flush();
        carried = true;
        const e = alloc();
        const u = b.unit;
        twoPorts.push({ blockId: b.id, kind: 'stack', a: node, b: e, y: (f) => unitY(u, f) });
        node = e;
      } else if (b.type === 'ideal') {
        flush();
        carried = true;
        const e = alloc();
        ideals.push({ p1: node, s1: e, n: b.n });
        node = e;
      } else if (b.type === 'shunt') {
        flush();
        if (!b.chain.length) throw new ChainError(`shunt "${b.label}" is empty and would short its node to ground`);
        const [end, ok] = walk(b.chain, node);
        if (!ok) throw new ChainError(`shunt "${b.label}" has no element in its own path and would short its node to ground`);
        union(end, 0);
      } else if (b.type === 'parallel') {
        flush();
        if (!b.chains.length || b.chains.some((c) => !c.length)) throw new ChainError(`parallel group "${b.label}" has an empty arm, which would short it`);
        const arms = b.chains.map((c) => walk(c, node));
        if (arms.some(([, ok]) => !ok)) throw new ChainError(`parallel group "${b.label}" has an arm with no element in its own path, which would short it`);
        for (const [e] of arms.slice(1)) union(arms[0][0], e);
        node = arms[0][0];
        carried = true;
      } else {
        const imp = twoTerminalZ(b, tableFor);
        if (b.type === 'measuredBranch') branches.push({ block: b, table: tableFor(b.sweepId) });
        carried = true;
        if (imp.kind === 'open') open = true;
        else if (imp.kind === 'z') pending.push({ blockId: b.id, z: imp.z });
      }
    }
    flush();
    return [node, carried];
  };
  walk(chain.blocks, port);

  // Keep only elements connected to the port. Ground is a sink, not a connector: an island that touches the rest of the
  // network only through ground carries no current from the port and would make the solve singular (final review I2).
  const edges: [number, number][] = [];
  for (const r of runs) edges.push([find(r.a), find(r.b)]);
  for (const t of twoPorts) edges.push([find(t.a), find(t.b)]);
  for (const i of ideals) edges.push([find(i.p1), find(i.s1)]);
  const reach = new Set<number>([find(port)]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [x, y] of edges) {
      for (const [from, to] of [[x, y], [y, x]]) {
        if (reach.has(from) && from !== 0 && !reach.has(to)) {
          reach.add(to);
          grew = true;
        }
      }
    }
  }
  const ids = new Map<number, number>([[0, 0]]);
  const idOf = (x: number): number => {
    const r = find(x);
    let k = ids.get(r);
    if (k === undefined) {
      k = ids.size;
      ids.set(r, k);
    }
    return k;
  };
  const live = (...xs: number[]): boolean => xs.every((x) => find(x) === 0 || reach.has(find(x)));
  const portId = idOf(port);
  const outRuns = runs.filter((r) => live(r.a, r.b)).map((r) => ({ ...r, a: idOf(r.a), b: idOf(r.b) }));
  const outTwo = twoPorts.filter((t) => live(t.a, t.b)).map((t) => ({ ...t, a: idOf(t.a), b: idOf(t.b) }));
  const outIdeal = ideals.filter((i) => live(i.p1, i.s1)).map((i) => ({ p1: idOf(i.p1), s1: idOf(i.s1), n: i.n }));
  const elements: Element[] = [
    ...outRuns.map((r): Element => ({ kind: 'y', a: r.a, b: r.b, y: (f) => seriesY(r.parts, f) })),
    ...outTwo.map((t): Element => ({ kind: 'y2', a: t.a, b: t.b, y: t.y })),
    ...outIdeal.map((i): Element => ({ kind: 'ideal', p1: i.p1, p2: 0, s1: i.s1, s2: 0, n: i.n })),
  ];
  return { net: { nodeCount: ids.size, port: portId, elements }, runs: outRuns, twoPorts: outTwo, branches };
}

export const zin = (c: Compiled, f: number): Complex => inputImpedance(c.net, f);

export function evaluate(chain: Chain, ctx: Context, freqs: number[]): Complex[] {
  const c = compile(chain, ctx);
  return freqs.map((f) => inputImpedance(c.net, f));
}

/** True when any measured branch is read outside its sweep's frequency range at f (spec §4). */
export const outOfRangeAt = (c: Compiled, f: number): boolean => c.branches.some((b) => branchOutOfRange(b.block, b.table, f));

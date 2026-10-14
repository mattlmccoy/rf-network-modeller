import { counts } from '../blocks/ht50.ts';
import { estimateUnit } from '../blocks/design.ts';
import { allBlocks, mapBlocks } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';

export type NewBlockKind = 'capBank' | 'inductor' | 'wire' | 'coax' | 'stack' | 'plates' | 'measuredBranch' | 'shunt' | 'parallel' | 'R' | 'L' | 'C' | 'short' | 'ideal';

/** What the circuit toolbar can add, physical blocks first, standard parts after. */
export const PALETTE: readonly { kind: NewBlockKind; label: string }[] = [
  { kind: 'capBank', label: 'Cap bank (HT50 parts)' },
  { kind: 'inductor', label: 'Inductance (lumped L)' },
  { kind: 'wire', label: 'Wire / jumper' },
  { kind: 'coax', label: 'Coax (variant cable)' },
  { kind: 'stack', label: 'Transformer stack' },
  { kind: 'plates', label: 'Plates + load' },
  { kind: 'measuredBranch', label: 'Measured branch (sweep)' },
  { kind: 'shunt', label: 'Shunt to ground' },
  { kind: 'parallel', label: 'Parallel group' },
  { kind: 'R', label: 'Resistor' },
  { kind: 'L', label: 'Inductor' },
  { kind: 'C', label: 'Capacitor' },
  { kind: 'short', label: 'Short' },
  { kind: 'ideal', label: 'Ideal transformer' },
];

/** A new block with default values (typed badges), its ids unique against `chain`, nested blocks included. */
export function newBlock(chain: Chain, kind: NewBlockKind, sweepId = ''): Block {
  const used = new Set(allBlocks(chain.blocks).map((b) => b.id));
  const id = (base: string): string => {
    let i = 1;
    while (used.has(`${base}${i}`)) i += 1;
    used.add(`${base}${i}`);
    return `${base}${i}`;
  };
  const make = (k: NewBlockKind): Block => {
    switch (k) {
      case 'capBank':
        return { id: id('bank'), label: 'Cap bank', type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1, 'typed', true, 0.8, 1.5), esr: 0, searchable: true };
      case 'inductor':
        return { id: id('L'), label: 'Inductance', type: 'inductor', L: param(100e-9, 'typed', true, -1e-6, 5e-6), R: 0 };
      case 'wire':
        return { id: id('wire'), label: 'Jumper', type: 'wire', lengthMm: 100, awg: 14, strands: 2 };
      case 'coax':
        return { id: id('coax'), label: 'Coax', type: 'coax' };
      case 'stack': {
        const design = { N_p: 3, N_s: 15, N_c: 4, strap: false };
        return { id: id('stack'), label: 'Stack', type: 'stack', unit: estimateUnit(design), source: 'estimate', design };
      }
      case 'plates':
        return { id: id('plates'), label: 'Plates + load', type: 'plates', C: param(3e-12), G_cube: param(0.3e-6), G_fix: param(1e-6) };
      case 'measuredBranch':
        return { id: id('branch'), label: 'Measured branch', type: 'measuredBranch', sweepId, kr: param(1, 'typed', true, 0.2, 3), d: param(0, 'typed', false, -2, 4), dLb: param(0, 'typed', false, -200e-9, 400e-9), loop: false };
      case 'shunt':
        return { id: id('shunt'), label: 'Shunt', type: 'shunt', chain: [make('capBank')] };
      case 'parallel':
        return { id: id('par'), label: 'Parallel', type: 'parallel', chains: [[make('inductor')], [make('inductor')]] };
      case 'R':
        return { id: id('R'), label: 'Resistor', type: 'primitive', kind: 'R', value: param(50) };
      case 'L':
        return { id: id('Lp'), label: 'Inductor', type: 'primitive', kind: 'L', value: param(100e-9, 'typed', false, 1e-9, 10e-6) };
      case 'C':
        return { id: id('Cp'), label: 'Capacitor', type: 'primitive', kind: 'C', value: param(100e-12, 'typed', false, 1e-12, 10e-9) };
      case 'short':
        return { id: id('short'), label: 'Short', type: 'primitive', kind: 'short', value: param(0) };
      case 'ideal':
        return { id: id('ideal'), label: 'Ideal transformer', type: 'ideal', n: 3 };
    }
  };
  return make(kind);
}

function editList(blocks: Block[], id: string, fn: (list: Block[], i: number) => Block[]): Block[] | null {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) return fn(blocks, i);
  for (let k = 0; k < blocks.length; k += 1) {
    const b = blocks[k];
    if (b.type === 'shunt') {
      const inner = editList(b.chain, id, fn);
      if (inner) return blocks.map((x, j) => (j === k ? { ...b, chain: inner } : x));
    }
    if (b.type === 'parallel') {
      for (let a = 0; a < b.chains.length; a += 1) {
        const inner = editList(b.chains[a], id, fn);
        if (inner) return blocks.map((x, j) => (j === k ? { ...b, chains: b.chains.map((c, ai) => (ai === a ? inner : c)) } : x));
      }
    }
  }
  return null;
}

export function insertAfter(chain: Chain, targetId: string | null, block: Block): Chain {
  if (targetId === null) return { ...chain, blocks: [...chain.blocks, block] };
  const next = editList(chain.blocks, targetId, (list, i) => [...list.slice(0, i + 1), block, ...list.slice(i + 1)]);
  return next ? { ...chain, blocks: next } : { ...chain, blocks: [...chain.blocks, block] };
}

export function insertInto(chain: Chain, containerId: string, arm: number, block: Block): Chain {
  return {
    ...chain,
    blocks: mapBlocks(chain.blocks, (b) => {
      if (b.id !== containerId) return b;
      if (b.type === 'shunt') return { ...b, chain: [...b.chain, block] };
      if (b.type === 'parallel') return { ...b, chains: arm >= b.chains.length ? [...b.chains, [block]] : b.chains.map((c, i) => (i === arm ? [...c, block] : c)) };
      return b;
    }),
  };
}

function prune(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === 'shunt') {
      const c = prune(b.chain);
      return c.length ? [{ ...b, chain: c }] : [];
    }
    if (b.type === 'parallel') {
      const arms = b.chains.map(prune).filter((c) => c.length);
      return arms.length ? [{ ...b, chains: arms }] : [];
    }
    return [b];
  });
}

export function removeBlock(chain: Chain, id: string): Chain {
  const next = editList(chain.blocks, id, (list, i) => [...list.slice(0, i), ...list.slice(i + 1)]);
  return next ? { ...chain, blocks: prune(next) } : chain;
}

export function moveBlock(chain: Chain, id: string, dir: -1 | 1): Chain {
  const next = editList(chain.blocks, id, (list, i) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const out = list.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });
  return next ? { ...chain, blocks: next } : chain;
}

import { mapBlocks } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';

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

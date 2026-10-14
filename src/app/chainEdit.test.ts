import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { compile } from '../chain/compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, o7Chain } from '../chain/presets.ts';
import { allBlocks, duplicateIds, findBlock } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';
import { insertAfter, insertInto, moveBlock, removeBlock } from './chainEdit.ts';
import { loadFixtureSweep } from '../testutil.ts';

const base = o7Chain('capfree');
const ids = (c: Chain): string[] => allBlocks(c.blocks).map((b) => b.id);
const bank = (id: string): Block => ({ id, label: id, type: 'capBank', counts: counts(1, 0, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true });
const ctx = { variant: DEFAULT_VARIANTS[0], sweeps: { capfree: loadFixtureSweep('capfree', O7_FILES.capFree) } };

test('insertAfter places a block after its target, also inside nested lists; null appends to the main chain', () => {
  const arm = findBlock(insertAfter(base, 'sh', bank('x')), 'shuntArm');
  assert.deepEqual(arm?.type === 'shunt' ? arm.chain.map((b) => b.id) : [], ['sh', 'x']);
  assert.equal(insertAfter(base, null, bank('y')).blocks.at(-1)?.id, 'y');
});

test("removing a shunt's last block removes the shunt; removing an arm's only block removes the arm (review focus 1)", () => {
  assert.equal(findBlock(removeBlock(base, 'sh'), 'shuntArm'), undefined);
  const par: Chain = { name: 'p', blocks: [{ id: 'p', label: 'p', type: 'parallel', chains: [[bank('a')], [bank('b')]] }] };
  const r2 = removeBlock(par, 'a');
  const p2 = findBlock(r2, 'p');
  assert.equal(p2?.type === 'parallel' ? p2.chains.length : -1, 1);
  assert.equal(removeBlock(r2, 'b').blocks.length, 0);
});

test('moveBlock swaps within its own list and stops at the ends', () => {
  assert.deepEqual(moveBlock(base, 'Ls', -1).blocks.map((b) => b.id).slice(0, 3), ['coax', 'Ls', 'ser']);
  assert.deepEqual(moveBlock(base, 'coax', -1).blocks.map((b) => b.id), base.blocks.map((b) => b.id));
});

test('insertInto appends inside a shunt, into a parallel arm, or as a new arm', () => {
  const s = ids(insertInto(base, 'shuntArm', 0, bank('x')));
  assert.deepEqual(s.slice(s.indexOf('sh'), s.indexOf('sh') + 2), ['sh', 'x']);
  const par: Chain = { name: 'p', blocks: [{ id: 'p', label: 'p', type: 'parallel', chains: [[bank('a')]] }] };
  const p = findBlock(insertInto(par, 'p', 1, bank('b')), 'p');
  assert.equal(p?.type === 'parallel' ? p.chains.length : -1, 2);
});

test('edited chains keep unique ids and still compile', () => {
  for (const c of [insertAfter(base, 'Ls', bank('x')), removeBlock(base, 'sh'), moveBlock(base, 'Ls', -1), insertInto(base, 'branchArm', 0, bank('z'))]) {
    assert.deepEqual(duplicateIds(c), []);
    compile(c, ctx);
  }
});

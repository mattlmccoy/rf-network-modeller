import assert from 'node:assert/strict';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { applyState, duplicateIds, findBlock, updateBlock } from './state.ts';
import { type Chain, param } from './types.ts';

const chain: Chain = { name: 't', blocks: [
  { id: 'ser', label: 'ser', type: 'capBank', counts: counts(0, 1, 1), customPf: 0, nSeries: 1, slots: 2, k: param(1), esr: 0, searchable: true },
  { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'sh', label: 'sh', type: 'capBank', counts: counts(1, 1, 1), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true }] },
] };

test('finds nested blocks and updates them without touching the original', () => {
  const next = updateBlock(chain, 'sh', { counts: counts(2, 0, 0) });
  assert.deepEqual((findBlock(next, 'sh') as { counts: unknown }).counts, counts(2, 0, 0));
  assert.deepEqual((findBlock(chain, 'sh') as { counts: unknown }).counts, counts(1, 1, 1));
});

test('applyState applies every override; an unknown id throws', () => {
  const s = applyState(chain, { ser: { counts: counts(1, 0, 1) }, sh: { counts: counts(2, 0, 1) } });
  assert.deepEqual((findBlock(s, 'ser') as { counts: unknown }).counts, counts(1, 0, 1));
  assert.throws(() => updateBlock(chain, 'nope', {}), /no block "nope"/);
});

test('duplicate ids are reported', () => {
  assert.deepEqual(duplicateIds(chain), []);
  assert.deepEqual(duplicateIds({ ...chain, blocks: [...chain.blocks, chain.blocks[0]] }), ['ser']);
});

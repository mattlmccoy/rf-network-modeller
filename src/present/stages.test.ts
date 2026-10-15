import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { allBlocks } from '../chain/state.ts';
import type { Chain } from '../chain/types.ts';
import { stageTitle, stagesOf } from './stages.ts';

const leaves = (c: Chain): string[] => allBlocks(c.blocks).filter((b) => b.type !== 'shunt' && b.type !== 'parallel').map((b) => b.id).sort();
const ids = (c: Chain): string[] => stagesOf(c).flatMap((s) => s.blockIds).sort();

test('O7: the measured pair is "Transformer + plates (measured together)" and there is no separate Plates stage', () => {
  const s = stagesOf(o7Chain('capfree'));
  assert.deepEqual(s.map((x) => x.kind), ['generator', 'tuner', 'cable', 'matching', 'transformer']);
  assert.deepEqual(s.find((x) => x.kind === 'matching')?.blockIds, ['ser', 'Ls', 'sh']);
  const t = s.find((x) => x.kind === 'transformer');
  assert.deepEqual(t?.blockIds, ['Lb', 'branch']);
  assert.equal(t && stageTitle(t), 'Transformer + plates (measured together)');
});

test('C+D: wiring before the stack is matching; the stack is the transformer; plates are their own stage', () => {
  const s = stagesOf(cdChain());
  assert.deepEqual(s.map((x) => x.kind), ['generator', 'tuner', 'cable', 'matching', 'transformer', 'plates']);
  assert.deepEqual(s.find((x) => x.kind === 'transformer')?.blockIds, ['stack']);
  assert.deepEqual(s.find((x) => x.kind === 'plates')?.blockIds, ['plates']);
});

test('every leaf block lands in exactly one stage', () => {
  for (const c of [o7Chain('capfree'), cdChain()]) assert.deepEqual(ids(c), leaves(c));
});

test('a blank network keeps generator, tuner and cable only', () => {
  const blank: Chain = { name: 'blank', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] };
  assert.deepEqual(stagesOf(blank).map((x) => [x.kind, x.blockIds]), [['generator', []], ['tuner', []], ['cable', ['coax']]]);
});

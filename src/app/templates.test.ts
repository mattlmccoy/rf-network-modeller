import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { hasModel } from '../present/circuit.ts';
import { loadExampleState } from '../testutil.ts';
import { evaluateVariants } from './evaluate.ts';
import { evalGrid } from './grid.ts';
import { fromTemplate } from './templates.ts';

const ex = loadExampleState();

test('O7 as built keeps the circuit, its fits and the part sweep, but no tagged sweeps (spec §8.4)', () => {
  const s = fromTemplate('o7', ex);
  assert.deepEqual(s.chain.blocks, ex.chain.blocks);
  assert.deepEqual(Object.keys(s.sweeps), ['capfree'], 'only the sweep the measured part needs');
  assert.deepEqual(s.tagged, []);
  assert.equal(s.activeSweep, null);
  assert.equal(s.fits, ex.fits);
  assert.equal(s.tmodel, ex.tmodel);
  assert.ok(evaluateVariants(s, evalGrid(s.chain, s.sweeps)).every((r) => r.error === null && r.landing !== null));
});

test('C+D predicts with no sweeps; Blank is the cable alone and measured only', () => {
  const cd = fromTemplate('cd');
  assert.deepEqual(cd.chain, cdChain());
  assert.ok(evaluateVariants(cd, evalGrid(cd.chain, cd.sweeps)).every((r) => r.error === null && r.landing !== null));
  const blank = fromTemplate('blank');
  assert.deepEqual(blank.chain.blocks.map((b) => b.type), ['coax']);
  assert.equal(hasModel(blank.chain), false);
  assert.throws(() => fromTemplate('o7'), /O7 example/);
});

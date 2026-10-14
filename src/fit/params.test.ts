import assert from 'node:assert/strict';
import test from 'node:test';
import { O7_REFS, o7Chain } from '../chain/presets.ts';
import { freeRefs, fromFitVars, getParam, toFitVars } from './params.ts';

test('fit variables use the Python recipe units and bounds', () => {
  const v = toFitVars(o7Chain('capfree'), O7_REFS);
  assert.deepEqual(v.x.map((x) => Math.round(x * 1e9) / 1e9), [300, 150, 1, 1, 1]);
  assert.deepEqual(v.lo.map((x) => Math.round(x * 1e9) / 1e9), [150, -100, 0.8, 0.8, 0.2]);
  assert.deepEqual(v.hi.map((x) => Math.round(x * 1e9) / 1e9), [700, 600, 1.5, 1.5, 3]);
});

test('fromFitVars writes SI values and marks them fitted', () => {
  const c = fromFitVars(o7Chain('capfree'), O7_REFS, [330, 92, 1.07, 1.2, 0.49]);
  const ls = getParam(c, { blockId: 'Ls', key: 'L' });
  assert.equal(ls.value, 330 * 1e-9);
  assert.equal(ls.badge, 'fit');
});

test('freeRefs lists the free parameters in chain order', () => {
  assert.deepEqual(freeRefs(o7Chain('capfree')).map((r) => `${r.blockId}.${r.key}`), ['ser.k', 'Ls.L', 'sh.k', 'Lb.L', 'branch.kr']);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { O7_FILES, o7Chain } from '../chain/presets.ts';
import { F0, defaultGrid, evalGrid } from './grid.ts';
import { loadFixtureSweep } from '../testutil.ts';

test('default grid: 1–30 MHz, 2,000 points plus exactly 13.56 MHz, strictly increasing (spec §4)', () => {
  const g = defaultGrid();
  assert.equal(g.length, 2001);
  assert.equal(g[0], 1e6);
  assert.equal(g[g.length - 1], 30e6);
  assert.ok(g.includes(F0));
  assert.ok(g.every((f, i) => i === 0 || f > g[i - 1]));
});

test("the grid is the measured branch's own sweep grid when that sweep is loaded", () => {
  const capfree = loadFixtureSweep('capfree', O7_FILES.capFree);
  assert.equal(evalGrid(o7Chain('capfree'), { capfree }), capfree.f);
  assert.equal(evalGrid(o7Chain('capfree'), {}).length, 2001);
});

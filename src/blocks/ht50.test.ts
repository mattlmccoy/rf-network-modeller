import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_STOCK, HT50, counts, countsPf, overdrawn, physicalParts, stockLeft, sumCounts } from './ht50.ts';

test('HT50 ratings at 13.56 MHz and the stock on hand (model/match.py, stock_net.py)', () => {
  assert.deepEqual(HT50[100], { vRms: 1080, iRms: 9.2 });
  assert.deepEqual(HT50[50], { vRms: 1530, iRms: 6.5 });
  assert.deepEqual(HT50[30], { vRms: 1980, iRms: 5.1 });
  assert.deepEqual(DEFAULT_STOCK, counts(10, 3, 2));
});

test('capacitance and physical parts', () => {
  assert.equal(countsPf(counts(1, 1, 1)), 180);
  assert.deepEqual(physicalParts({ counts: counts(1, 0, 1), nSeries: 2 }), counts(2, 0, 2));
  assert.deepEqual(sumCounts([counts(1, 1, 0), counts(2, 0, 1)]), counts(3, 1, 1));
});

test('stock accounting flags overdrawn values', () => {
  const left = stockLeft(DEFAULT_STOCK, counts(4, 1, 3));
  assert.deepEqual(left, counts(6, 2, -1));
  assert.deepEqual(overdrawn(left), [30]);
});

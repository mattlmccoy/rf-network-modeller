import assert from 'node:assert/strict';
import test from 'node:test';
import { lowerMedian, rank } from './rank.ts';

const s = (name: string, inCount: number, roomScore: number, moves: number) => ({ candidate: name, landings: [], inCount, roomScore, moves });

test('lower median: the middle of three, the lower middle of four', () => {
  assert.equal(lowerMedian([3, -99, 1]), 1);
  assert.equal(lowerMedian([4, 1, 3, 2]), 2);
});

test('majority filter, then variants in window, capped room, then fewer moves (stable)', () => {
  const out = rank([s('minority', 1, 9, 0), s('room1', 3, 1.0, 1), s('room3moves4', 3, 3.0, 4), s('room4moves2', 3, 4.0, 2), s('two', 2, 9, 0)], 3);
  assert.deepEqual(out.map((x) => x.candidate), ['room4moves2', 'room3moves4', 'room1', 'two']);
});

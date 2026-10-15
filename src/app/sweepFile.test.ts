import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { O7_FILES } from '../chain/presets.ts';
import { ROOT } from '../testutil.ts';
import { sweepFromFile, sweepLabel } from './sweepFile.ts';

test('a sweep file becomes a sweep with a unique id; a bad file names itself in the error', () => {
  const text = readFileSync(new URL(`fixtures/sweeps/${O7_FILES.s80_180_loop}`, ROOT), 'utf8');
  const s = sweepFromFile('80-180-loop.s1p', text, {});
  assert.equal(s.id, '80-180-loop');
  assert.equal(s.f.length, s.gamma.length);
  assert.equal(sweepFromFile('80-180-loop.s1p', text, { [s.id]: s }).id, '80-180-loop-2');
  assert.throws(() => sweepFromFile('notes.s1p', 'hello', {}), /^Error: notes\.s1p: /);
  assert.equal(sweepLabel('80-180-loop.S1P'), '80-180-loop');
});

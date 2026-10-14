import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { parseS1p } from './s1p.ts';
import { ROOT, assertClose } from '../testutil.ts';

const S80 = 'noAIT_80ser_200sh_full_4core_parallel_315turnsratio_load_nanovna-sweep-1791931754256.s1p';

test('parses RI data in MHz', () => {
  const t = parseS1p('# MHz S RI R 50\n1 0.5 -0.25\n2 0.4 0.1');
  assert.deepEqual(t.f, [1e6, 2e6]);
  assertClose(t.gamma[0], cx(0.5, -0.25), 0);
});

test('converts dB-angle pairs', () => {
  const t = parseS1p('# GHz S DB R 50\n1 -6.020599913 90');
  assertClose(t.gamma[0], cx(0, 0.5), 1e-9);
});

test('refuses a non-50 Ω reference, Touchstone 2.0, and an incomplete record', () => {
  assert.throws(() => parseS1p('# MHz S RI R 75\n1 0 0'), /50 Ω/);
  assert.throws(() => parseS1p('[Version] 2.0\n# MHz S RI R 50\n1 0 0'), /Touchstone 2.0/);
  assert.throws(() => parseS1p('# MHz S RI R 50\n1 0'), /incomplete/);
});

test('reads a real NanoVNA Web export', () => {
  const t = parseS1p(readFileSync(new URL(`fixtures/sweeps/${S80}`, ROOT), 'utf8'));
  assert.equal(t.f.length, 5050);
  assert.equal(t.f[0], 1e6);
  assert.equal(t.f[5049], 24997897); // captured from the file: 1 MHz + 5049 steps of 4753 Hz
  assertClose(t.gamma[0], cx(0.994826688, -0.100195592), 1e-12);
});

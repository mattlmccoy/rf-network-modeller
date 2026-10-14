import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../engine/complex.ts';
import { AIT_WINDOW } from '../chain/presets.ts';
import { NOT_IN_WINDOW, landing } from './landing.ts';
import { assertNear } from '../testutil.ts';

const f = [13.0e6, 13.3e6, 13.56e6, 13.8e6, 14.0e6, 14.3e6];

test('contiguous in-window band around 13.56 MHz gives the drift room', () => {
  const z = [cx(4, 2), cx(6, 10), cx(8, 20), cx(10, 30), cx(30, 60), cx(12, 40)];
  const l = landing(f, z, AIT_WINDOW);
  assert.equal(l.inWindow, true);
  assertNear(l.roomUp, ((13.8e6 - 13.56e6) / 13.56e6) * 100, 1e-12); // stops at 14.0 (out), ignores 14.3 (back in)
  assertNear(l.roomDown, ((13.56e6 - 13.3e6) / 13.56e6) * 100, 1e-12);
});

test('out of the window at 13.56 MHz reports the sentinel', () => {
  const l = landing(f, f.map(() => cx(3, 3)), AIT_WINDOW);
  assert.equal(l.inWindow, false);
  assert.equal(l.roomUp, NOT_IN_WINDOW);
});

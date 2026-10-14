import assert from 'node:assert/strict';
import test from 'node:test';
import { cx, sub } from '../engine/complex.ts';
import { deembed } from '../engine/coax.ts';
import { counts } from '../blocks/ht50.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { branchOutOfRange, buildBranchTable, capBankFarads, measuredZ, twoTerminalZ } from './blockZ.ts';
import { type BranchTable, type CapBankBlock, type MeasuredBranchBlock, type Variant, param } from './types.ts';
import { assertClose, assertNear } from '../testutil.ts';

const bank = (n100: number, n50: number, n30: number, extra: Partial<CapBankBlock> = {}): CapBankBlock => ({
  id: 'b', label: 'bank', type: 'capBank', counts: counts(n100, n50, n30), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: true, ...extra,
});
const noTable = (): BranchTable => {
  throw new Error('no table expected');
};

test('a 50 + 30 pF series bank is −j146.7 Ω at 13.56 MHz', () => {
  const imp = twoTerminalZ(bank(0, 1, 1), noTable);
  assert.equal(imp.kind, 'z');
  if (imp.kind === 'z') assertClose(imp.z(13.56e6), cx(0, -1 / (2 * Math.PI * 13.56e6 * 80e-12)), 1e-12);
});

test('scale k and two groups in series set the actual capacitance', () => {
  assertNear(capBankFarads(bank(0, 1, 1, { k: param(1.1), nSeries: 2 })) * 1e12, 44, 1e-12);
});

test('an empty bank is an open circuit, not NaN (review focus 1)', () => {
  assert.equal(twoTerminalZ(bank(0, 0, 0), noTable).kind, 'open');
});

test('zero inductor and zero resistor are shorts; a zero capacitor is open', () => {
  assert.equal(twoTerminalZ({ id: 'l', label: 'l', type: 'inductor', L: param(0), R: 0 }, noTable).kind, 'short');
  assert.equal(twoTerminalZ({ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(0) }, noTable).kind, 'short');
  assert.equal(twoTerminalZ({ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: param(0) }, noTable).kind, 'open');
});

test('plates with no conductance and no capacitance are open', () => {
  const imp = twoTerminalZ({ id: 'p', label: 'p', type: 'plates', C: param(0), G_cube: param(0), G_fix: param(0) }, noTable);
  assert.equal(imp.kind, 'open');
});

const mb = (extra: Partial<MeasuredBranchBlock> = {}): MeasuredBranchBlock => ({
  id: 'm', label: 'm', type: 'measuredBranch', sweepId: 's', kr: param(0.5), d: param(0.1), dLb: param(10e-9), loop: true, ...extra,
});
const table: BranchTable = { f: [10e6, 20e6], re: [1, 3], im: [10, 30] };

test('measured branch: kr scales R, the loop reads the table at f(1+d) and adds jω·dLb', () => {
  assertClose(measuredZ(mb(), table)(10e6), cx(0.6, 12 + 2 * Math.PI * 10e6 * 10e-9), 1e-12);
  assertClose(measuredZ(mb({ loop: false }), table)(15e6), cx(1.0, 20), 1e-12);
});

test('reads outside the table clamp to the end values and are flagged (review focus 3)', () => {
  assertClose(measuredZ(mb({ loop: false }), table)(30e6), cx(1.5, 30), 1e-12);
  assert.equal(branchOutOfRange(mb({ loop: false }), table, 30e6), true);
  assert.equal(branchOutOfRange(mb({ loop: false }), table, 15e6), false);
  assert.equal(branchOutOfRange(mb({ d: param(0.3) }), table, 18e6), true);
});

test('buildBranchTable de-embeds the variant cable and removes its jumper L', () => {
  const s: Sweep = { id: 's', name: 's', f: [13.56e6], gamma: [gammaFromZ(cx(12, 200))] };
  const v: Variant = { name: 'v', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 342e-9 };
  const t = buildBranchTable(s, v);
  const want = sub(deembed(cx(12, 200), v.cable, 13.56e6), cx(0, 2 * Math.PI * 13.56e6 * 342e-9));
  assertClose(cx(t.re[0], t.im[0]), want, 1e-9);
});

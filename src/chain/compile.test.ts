import assert from 'node:assert/strict';
import test from 'node:test';
import { ONE, OPEN, add, cx, inv } from '../engine/complex.ts';
import { embed } from '../engine/coax.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { type Sweep, gammaFromZ } from '../io/sweep.ts';
import { ChainError, compile, evaluate, outOfRangeAt, zin } from './compile.ts';
import { type Block, type CapBankBlock, type Chain, type Context, param } from './types.ts';
import { assertClose } from '../testutil.ts';

const w = (f: number): number => 2 * Math.PI * f;
const cable = { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 };
const ctx = (sweeps: Record<string, Sweep> = {}): Context => ({ variant: { name: 'v', cable, Lj: 0 }, sweeps });
const cap = (id: string, pf: number): CapBankBlock => ({ id, label: id, type: 'capBank', counts: counts(), customPf: pf, nSeries: 1, slots: 4, k: param(1), esr: 0, searchable: false });
const res = (id: string, ohm: number): Block => ({ id, label: id, type: 'primitive', kind: 'R', value: param(ohm) });
const ind = (id: string, h: number): Block => ({ id, label: id, type: 'inductor', L: param(h), R: 0 });
const shunt = (id: string, chain: Block[]): Block => ({ id, label: id, type: 'shunt', chain });
const chainOf = (blocks: Block[]): Chain => ({ name: 't', blocks });

test('series C, shunt C and a series R–L load equal the closed-form L-network', () => {
  const f = 13.56e6;
  const c = chainOf([cap('cs', 80), shunt('a', [cap('cp', 180)]), shunt('b', [res('r', 2), ind('l', 290e-9)])]);
  const want = add(cx(0, -1 / (w(f) * 80e-12)), inv(add(cx(0, w(f) * 180e-12), inv(cx(2, w(f) * 290e-9)))));
  assertClose(evaluate(c, ctx(), [f])[0], want, 1e-12);
});

test('consecutive series blocks merge into one run', () => {
  const c = compile(chainOf([cap('cs', 80), ind('ls', 300e-9), shunt('a', [res('r', 5)])]), ctx());
  assert.equal(c.runs.filter((r) => r.parts.some((p) => p.blockId === 'cs')).length, 1);
  assert.deepEqual(c.runs.find((r) => r.parts.some((p) => p.blockId === 'cs'))?.parts.map((p) => p.blockId), ['cs', 'ls']);
});

test('a coax block in front equals embed of the rest', () => {
  const rest = [cap('cs', 80), shunt('a', [res('r', 5)])];
  const f = 13.56e6;
  assertClose(evaluate(chainOf([{ id: 'coax', label: 'coax', type: 'coax' }, ...rest]), ctx(), [f])[0], embed(evaluate(chainOf(rest), ctx(), [f])[0], cable, f), 1e-10);
});

test('two stacks in a parallel group, then plates, equal paralleled units', () => {
  const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };
  const c = chainOf([
    { id: 'pair', label: 'pair', type: 'parallel', chains: [[{ id: 'A', label: 'A', type: 'stack', unit: u, source: 'preset' }], [{ id: 'B', label: 'B', type: 'stack', unit: u, source: 'preset' }]] },
    shunt('pl', [{ id: 'plates', label: 'plates', type: 'plates', C: param(load.C), G_cube: param(load.G_cube), G_fix: param(load.G_fix) }]),
  ]);
  assertClose(evaluate(c, ctx(), [12e6])[0], inputImpedanceUnits([u, u], load, 12e6), 1e-10);
});

test('an empty shunt or an empty parallel arm is refused (review focus 2)', () => {
  assert.throws(() => compile(chainOf([cap('cs', 80), shunt('a', [])]), ctx()), ChainError);
  assert.throws(() => compile(chainOf([{ id: 'p', label: 'p', type: 'parallel', chains: [[res('r', 5)], []] }]), ctx()), ChainError);
});

test('an empty series bank opens the network: Z = OPEN and Γ = 1 (review focus 1)', () => {
  const z = evaluate(chainOf([cap('cs', 0), shunt('a', [res('r', 50)])]), ctx(), [13.56e6])[0];
  assertClose(z, OPEN, 0);
  assertClose(gammaFromZ(z), ONE, 0);
});

test('an open shunt changes nothing', () => {
  const f = 13.56e6;
  const withOpen = evaluate(chainOf([cap('cs', 80), shunt('o', [cap('cp', 0)]), shunt('a', [res('r', 50)])]), ctx(), [f])[0];
  const without = evaluate(chainOf([cap('cs', 80), shunt('a', [res('r', 50)])]), ctx(), [f])[0];
  assertClose(withOpen, without, 1e-12);
});

test('a port shorted to ground reads 0 Ω', () => {
  assertClose(evaluate(chainOf([shunt('s', [{ id: 'x', label: 'x', type: 'primitive', kind: 'short', value: param(0) }])]), ctx(), [1e6])[0], cx(0), 0);
});

test('a measured branch read outside its sweep clamps and is flagged (review focus 3)', () => {
  const s: Sweep = { id: 's', name: 's', f: [10e6, 15e6, 20e6], gamma: [cx(0.1, 0.2), cx(0.3, -0.1), cx(-0.2, 0.4)].map((g) => g) };
  const c = compile(chainOf([shunt('arm', [{ id: 'm', label: 'm', type: 'measuredBranch', sweepId: 's', kr: param(1), d: param(0), dLb: param(0), loop: false }])]), ctx({ s }));
  assert.equal(outOfRangeAt(c, 25e6), true);
  assert.equal(outOfRangeAt(c, 15e6), false);
  assertClose(zin(c, 25e6), zin(c, 20e6), 1e-12);
});

test('a measured branch whose sweep is not loaded is a named error', () => {
  const c = chainOf([shunt('arm', [{ id: 'm', label: 'm', type: 'measuredBranch', sweepId: 'missing', kr: param(1), d: param(0), dLb: param(0), loop: false }])]);
  assert.throws(() => compile(c, ctx()), /not loaded/);
});

// Final-review fixes (I1, I2, I3, I6)
test('a sub-chain with no series element is refused, not silently shorted (final review I1)', () => {
  assert.throws(() => compile(chainOf([cap('cs', 80), shunt('a', [res('r', 50)]), shunt('s', [shunt('inner', [cap('ci', 100)])])]), ctx()), ChainError);
  assert.throws(() => compile(chainOf([{ id: 'p', label: 'p', type: 'parallel', chains: [[ind('l', 300e-9)], [shunt('sa', [res('r2', 1000)])]] }, shunt('b', [res('r', 50)])]), ctx()), ChainError);
});

test('zero-length coax and wire pass through instead of reading OPEN (final review I2)', () => {
  const f = 13.56e6;
  const zeroLen: Context = { variant: { name: 'z', cable: { length: 0, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };
  assertClose(evaluate(chainOf([{ id: 'coax', label: 'coax', type: 'coax' }, cap('cs', 80), shunt('a', [res('r', 5)])]), zeroLen, [f])[0], cx(5, -1 / (w(f) * 80e-12)), 1e-9);
  assertClose(evaluate(chainOf([{ id: 'wr', label: 'wr', type: 'wire', lengthMm: 0, awg: 14, strands: 1 }, shunt('a', [res('r', 5)])]), ctx(), [f])[0], cx(5), 1e-9);
});

test('series elements that cancel exactly act as a short (final review I2)', () => {
  assertClose(evaluate(chainOf([ind('l1', 300e-9), ind('l2', -300e-9), shunt('a', [res('r', 50)])]), ctx(), [13.56e6])[0], cx(50), 1e-9);
});

test('a dangling ideal transformer behind an open does not open the network (final review I2)', () => {
  const f = 13.56e6;
  const c = chainOf([cap('cs', 80), shunt('a', [res('r', 50)]), cap('gap', 0), { id: 't', label: 't', type: 'ideal', n: 3 }]);
  assertClose(evaluate(c, ctx(), [f])[0], cx(50, -1 / (w(f) * 80e-12)), 1e-9);
});

test('a non-finite element value reads as invalid (NaN), not OPEN (final review I2)', () => {
  const z = evaluate(chainOf([shunt('a', [res('r', Number.NaN)])]), ctx(), [13.56e6])[0];
  assert.ok(Number.isNaN(z.re) && Number.isNaN(z.im), `got ${z.re} ${z.im}`);
});

test('duplicate block ids are refused (final review I3)', () => {
  assert.throws(() => compile(chainOf([cap('b', 30), shunt('arm', [cap('b', 300)]), shunt('load', [res('r', 5)])]), ctx()), /duplicate block id/);
});

test('a shared branch cache never mixes variants or sweeps (final review I6)', () => {
  const sA: Sweep = { id: 's', name: 'a', f: [10e6, 15e6, 20e6], gamma: [cx(0.1, 0.2), cx(0.3, -0.1), cx(-0.2, 0.4)] };
  const sB: Sweep = { ...sA, name: 'b', gamma: [cx(0.2, 0.1), cx(0.1, 0.3), cx(0.0, -0.4)] };
  const c = chainOf([{ id: 'coax', label: 'coax', type: 'coax' }, shunt('arm', [{ id: 'm', label: 'm', type: 'measuredBranch', sweepId: 's', kr: param(1), d: param(0), dLb: param(0), loop: false }])]);
  const v1 = { name: 'v', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 342e-9 };
  const v2 = { ...v1, cable: { ...v1.cable, vf: 0.66 } }; // same name, length and Lj
  const shared = new Map();
  evaluate(c, { variant: v1, sweeps: { s: sA }, cache: shared }, [15e6]);
  assertClose(evaluate(c, { variant: v2, sweeps: { s: sA }, cache: shared }, [15e6])[0], evaluate(c, { variant: v2, sweeps: { s: sA } }, [15e6])[0], 1e-12);
  assertClose(evaluate(c, { variant: v2, sweeps: { s: sB }, cache: shared }, [15e6])[0], evaluate(c, { variant: v2, sweeps: { s: sB } }, [15e6])[0], 1e-12);
});

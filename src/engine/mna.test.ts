import test from 'node:test';
import { OPEN, add, cx, inv } from './complex.ts';
import { type Cable, coaxY, embed } from './coax.ts';
import { type Netlist, inputImpedance } from './mna.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits, loadAdmittance, unitY } from './transformer.ts';
import { assertClose } from '../testutil.ts';

const w = (f: number): number => 2 * Math.PI * f;

test('series R, L, C to ground on separate nodes is resistive at resonance', () => {
  const R = 2;
  const L = 1e-6;
  const C = 100e-12;
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const net: Netlist = { nodeCount: 4, port: 1, elements: [
    { kind: 'y', a: 1, b: 2, y: () => cx(1 / R) },
    { kind: 'y', a: 2, b: 3, y: (f) => inv(cx(0, w(f) * L)) },
    { kind: 'y', a: 3, b: 0, y: (f) => cx(0, w(f) * C) },
  ] };
  assertClose(inputImpedance(net, f0), cx(R), 1e-9);
});

test('an ideal 1:3 transformer maps 450 Ω to 50 Ω', () => {
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'ideal', p1: 1, p2: 0, s1: 2, s2: 0, n: 3 },
    { kind: 'y', a: 2, b: 0, y: () => cx(1 / 450) },
  ] };
  assertClose(inputImpedance(net, 13.56e6), cx(50), 1e-12);
});

test('a coax 2-port plus a load equals embed', () => {
  const cab: Cable = { length: 1.245, vf: 0.7, z0: 50, alpha13: 0.0073 };
  const zl = cx(7.8, 27.9);
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y2', a: 1, b: 2, y: (f) => coaxY(cab, f) },
    { kind: 'y', a: 2, b: 0, y: () => inv(zl) },
  ] };
  assertClose(inputImpedance(net, 13.56e6), embed(zl, cab, 13.56e6), 1e-10);
});

test('two paralleled T-model units equal summed unit admittances', () => {
  const u: Unit = { n: 5, L_leak: 0.6e-6, f_pri: 0, L_m: 1.5e-6, G_core: 2e-4, R1: 0.3, R2: 8, C_w: 1e-12, N_p: 3, N_c: 4 };
  const load: PlateLoad = { C: 7e-12, G_cube: 0.3e-6, G_fix: 1e-6 };
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y2', a: 1, b: 2, y: (f) => unitY(u, f) },
    { kind: 'y2', a: 1, b: 2, y: (f) => unitY(u, f) },
    { kind: 'y', a: 2, b: 0, y: (f) => loadAdmittance(load, f) },
  ] };
  assertClose(inputImpedance(net, 12e6), inputImpedanceUnits([u, u], load, 12e6), 1e-10);
});

test('an L-network matches the closed form', () => {
  const f = 13.56e6;
  const zl = cx(1.5, 24.6);
  const net: Netlist = { nodeCount: 3, port: 1, elements: [
    { kind: 'y', a: 1, b: 2, y: (x) => cx(0, w(x) * 80e-12) },
    { kind: 'y', a: 2, b: 0, y: (x) => cx(0, w(x) * 180e-12) },
    { kind: 'y', a: 2, b: 0, y: () => inv(zl) },
  ] };
  const want = add(cx(0, -1 / (w(f) * 80e-12)), inv(add(cx(0, w(f) * 180e-12), inv(zl))));
  assertClose(inputImpedance(net, f), want, 1e-12);
});

test('a port with no path to ground reads OPEN', () => {
  const net: Netlist = { nodeCount: 3, port: 1, elements: [{ kind: 'y', a: 1, b: 2, y: () => cx(0.01) }] };
  assertClose(inputImpedance(net, 1e6), OPEN, 0);
});

test('a port shorted to ground (port 0) reads 0 Ω', () => {
  assertClose(inputImpedance({ nodeCount: 1, port: 0, elements: [] }, 1e6), cx(0), 0);
});

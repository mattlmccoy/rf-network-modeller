import test from 'node:test';
import type { Unit } from '../engine/transformer.ts';
import { DESIGN_CONSTS, estimateUnit, turnLengthMm } from './design.ts';
import { assertNear, readFixtureJson } from '../testutil.ts';

interface Fx { consts: Record<string, number>; designs: { N_p: number; N_s: number; N_c: number; strap: boolean; turn_length_mm: number; unit: Unit }[] }
const fx = readFixtureJson<Fx>('design_units.json');

test('ported constants equal model/design.py Consts', () => {
  for (const [k, v] of Object.entries(DESIGN_CONSTS)) assertNear(v, fx.consts[k], 1e-15, k);
});

test('estimateUnit equals design.make_unit', () => {
  for (const d of fx.designs) {
    const u = estimateUnit({ N_p: d.N_p, N_s: d.N_s, N_c: d.N_c, strap: d.strap }) as unknown as Record<string, number>;
    const want = d.unit as unknown as Record<string, number>;
    for (const key of Object.keys(want)) assertNear(u[key], want[key], 1e-12, `${d.N_p}:${d.N_s} ${key}`);
    assertNear(turnLengthMm(d.N_c), d.turn_length_mm, 1e-12);
  }
});

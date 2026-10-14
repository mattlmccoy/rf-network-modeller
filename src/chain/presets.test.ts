import assert from 'node:assert/strict';
import test from 'node:test';
import { type Counts, counts } from '../blocks/ht50.ts';
import { fromFitVars } from '../fit/params.ts';
import { evaluate } from './compile.ts';
import { DEFAULT_VARIANTS, O7_FILES, O7_LOOP_REF, O7_REFS, cdChain, o7Chain, o7State } from './presets.ts';
import { applyState, duplicateIds } from './state.ts';
import type { Context } from './types.ts';
import { assertClose, loadFixtureSweep, pair, readFixtureJson } from '../testutil.ts';

interface O7Variant { variant: string; length: number; fit2: { x: number[]; samples: { index: number; cs: number; cp: number; z: number[] }[] }; fit3: { x: number[] }; loop: { q: number; samples: { index: number; z: number[] }[] } }
const fx = readFixtureJson<{ variants: O7Variant[] }>('o7_fit.json');
const capFree = loadFixtureSweep('capfree', O7_FILES.capFree);
const PF: Record<number, Counts> = { 80: counts(0, 1, 1), 100: counts(1, 0, 0), 130: counts(1, 0, 1), 180: counts(1, 1, 1), 200: counts(2, 0, 0), 230: counts(2, 0, 1) };

test('the O7 preset has unique block ids', () => assert.deepEqual(duplicateIds(o7Chain('capfree')), []));

test('the O7 preset reproduces the o7_joint.py board impedance (fit2 parameters, 3 variants)', () => {
  fx.variants.forEach((v, i) => {
    assert.equal(DEFAULT_VARIANTS[i].cable.length, v.length);
    const ctx: Context = { variant: DEFAULT_VARIANTS[i], sweeps: { capfree: capFree } };
    const base = fromFitVars(o7Chain('capfree'), O7_REFS, v.fit2.x);
    for (const s of v.fit2.samples) {
      const c = applyState(base, o7State(PF[Math.round(s.cs * 1e12)], PF[Math.round(s.cp * 1e12)], false));
      assertClose(evaluate(c, ctx, [capFree.f[s.index]])[0], pair(s.z), 1e-9, `${v.variant} idx ${s.index}`);
    }
  });
});

test('the O7 preset reproduces the loop-state model (fit3 + frequency shift)', () => {
  fx.variants.forEach((v, i) => {
    const ctx: Context = { variant: DEFAULT_VARIANTS[i], sweeps: { capfree: capFree } };
    const c = applyState(fromFitVars(fromFitVars(o7Chain('capfree'), O7_REFS, v.fit3.x), [O7_LOOP_REF], [v.loop.q]), o7State(PF[80], PF[180], true));
    for (const s of v.loop.samples) assertClose(evaluate(c, ctx, [capFree.f[s.index]])[0], pair(s.z), 1e-9, `${v.variant} loop idx ${s.index}`);
  });
});

test('the C+D preset reproduces the Python C+D prediction', () => {
  const cd = readFixtureJson<{ f: number; pred: number[] }>('cd_check.json');
  const ctx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };
  assertClose(evaluate(cdChain(), ctx, [cd.f])[0], pair(cd.pred), 1e-9);
});

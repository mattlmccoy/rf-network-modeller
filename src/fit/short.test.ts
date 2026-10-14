import assert from 'node:assert/strict';
import test from 'node:test';
import { fitShort, variantFromShort } from './short.ts';
import { loadFixtureSweep, readFixtureJson } from '../testutil.ts';

interface Fx { shorts: { file: string; fixed: { length: number; L_nH: number; rms: number }[]; free: { length: number; L_nH: number } }[] }
const fx = readFixtureJson<Fx>('tmodel_short.json');

for (const s of fx.shorts) {
  test(`shorted-jumper fit matches the Python recipe: ${s.file}`, () => {
    const sweep = loadFixtureSweep('short', s.file);
    for (const want of s.fixed) {
      const r = fitShort(sweep, { length: want.length, fitLength: false });
      assert.ok(Math.abs(r.L * 1e9 - want.L_nH) < 1, `${want.length} m: ${r.L * 1e9} nH vs ${want.L_nH}`);
      assert.ok(Math.abs(r.rms / want.rms - 1) < 0.02, `rms ${r.rms} vs ${want.rms}`);
    }
    const free = fitShort(sweep, { length: 1.3, fitLength: true });
    assert.ok(Math.abs(free.length - s.free.length) < 1e-3, `length ${free.length} vs ${s.free.length}`);
    assert.ok(Math.abs(free.L * 1e9 - s.free.L_nH) < 2, `L ${free.L * 1e9} vs ${s.free.L_nH}`);
  });
}

test('variantFromShort builds a cable/jumper variant', () => {
  const v = variantFromShort('new jumpers @ 1.245 m', { length: 1.245, L: 344e-9, rms: 0.7 });
  assert.deepEqual(v, { name: 'new jumpers @ 1.245 m', cable: { length: 1.245, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 344e-9 });
});

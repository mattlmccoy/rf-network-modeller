import assert from 'node:assert/strict';
import test from 'node:test';
import type { Cable } from '../engine/coax.ts';
import type { PlateLoad, Unit } from '../engine/transformer.ts';
import { counts } from '../blocks/ht50.ts';
import { cdChain } from '../chain/presets.ts';
import { type Block, type CapBankBlock, type Chain, type Context, type StackBlock, param } from '../chain/types.ts';
import { DriveError, drive, maxCapStressPct, reports } from './drive.ts';
import { assertClose, assertNear, pair, readFixtureJson } from '../testutil.ts';

interface Net { c_series: number; c_shunt: number; esr_series: number; esr_shunt: number; l_series: number; r_lseries: number }
interface UnitRow { i1: number[]; vm: number[]; i_r2: number[]; p_r1: number; p_core: number; p_r2: number; b_pk_mT: number; v_loop_rms: number }
interface ChainRow { z_ait: number[]; i_series: number[]; v_series_cap: number; i_shunt: number[]; v_node: number[]; i_branch: number[]; p_esr_series: number; p_esr_shunt: number; p_lseries: number; p_cable: number; v1: number[]; v2: number[]; p_cube: number; p_fix: number; units: UnitRow[] }
interface Case { name: string; units: Unit[]; load: PlateLoad; net: Net; cable: Cable; rows: { f: number; chain: ChainRow }[] }
const { cases } = readFixtureJson<{ cases: Case[] }>('rfchain_cases.json');

const custom = (id: string, pf: number, esr: number): CapBankBlock => ({ id, label: id, type: 'capBank', counts: counts(), customPf: pf, nSeries: 1, slots: 1, k: param(1), esr, searchable: false });

/** The rfchain.solve_chain topology as a chain: coax → series C → shunt C → series L → unit(s) → plates. */
function caseChain(c: Case): Chain {
  const n = c.net;
  const stacks = c.units.map((u, k): StackBlock => ({ id: `stack${k}`, label: `stack ${k}`, type: 'stack', unit: u, source: 'preset' }));
  const transformer: Block = stacks.length === 1 ? stacks[0] : { id: 'pair', label: 'pair', type: 'parallel', chains: stacks.map((s) => [s]) };
  return { name: c.name, blocks: [
    { id: 'coax', label: 'coax', type: 'coax' },
    custom('ser', n.c_series * 1e12, n.esr_series),
    { id: 'shuntArm', label: 'shunt', type: 'shunt', chain: [custom('sh', n.c_shunt * 1e12, n.esr_shunt)] },
    { id: 'lser', label: 'series L', type: 'inductor', L: param(n.l_series), R: n.r_lseries },
    transformer,
    { id: 'platesArm', label: 'plates', type: 'shunt', chain: [{ id: 'plates', label: 'plates', type: 'plates', C: param(c.load.C), G_cube: param(c.load.G_cube), G_fix: param(c.load.G_fix) }] },
  ] };
}

for (const c of cases) {
  test(`solve_chain parity at 100 W: ${c.name}`, () => {
    const chain = caseChain(c);
    const ctx: Context = { variant: { name: c.name, cable: c.cable, Lj: 0 }, sweeps: {} };
    for (const { f, chain: want } of c.rows) {
      const d = drive(chain, ctx, f, 100);
      const rep = reports(chain, d);
      const get = (id: string) => rep.get(id) ?? assert.fail(`no report for ${id}`);
      assertClose(d.zin, pair(want.z_ait), 1e-9, `z_ait @${f}`);
      assertClose(get('ser').i, pair(want.i_series), 1e-9, `i_series @${f}`);
      assertNear(get('ser').vCapRms ?? NaN, want.v_series_cap, 1e-9, `v_series_cap @${f}`);
      assertNear(get('ser').powerW, want.p_esr_series, 1e-9, `p_esr_series @${f}`);
      assertClose(get('sh').i, pair(want.i_shunt), 1e-9, `i_shunt @${f}`);
      assertClose(get('sh').v, pair(want.v_node), 1e-9, `v_node @${f}`);
      assertNear(get('sh').powerW, want.p_esr_shunt, 1e-9, `p_esr_shunt @${f}`);
      assertClose(get('lser').i, pair(want.i_branch), 1e-9, `i_branch @${f}`);
      assertNear(get('lser').powerW, want.p_lseries, 1e-9, `p_lseries @${f}`);
      assertNear(get('coax').powerW, want.p_cable, 1e-9, `p_cable @${f}`);
      assertNear(get('plates').pCube ?? NaN, want.p_cube, 1e-9, `p_cube @${f}`);
      assertNear(get('plates').pFix ?? NaN, want.p_fix, 1e-9, `p_fix @${f}`);
      c.units.forEach((_, k) => {
        const s = get(`stack${k}`);
        assertClose(s.v, pair(want.v1), 1e-9, `v1 @${f}`);
        assertClose(s.v2 ?? pair([NaN, NaN]), pair(want.v2), 1e-9, `v2 @${f}`);
        const u = s.unit ?? assert.fail('no unit state');
        const w = want.units[k];
        assertClose(u.i1, pair(w.i1), 1e-9, `i1 @${f}`);
        assertClose(u.vm, pair(w.vm), 1e-9, `vm @${f}`);
        assertClose(u.i_r2, pair(w.i_r2), 1e-9, `i_r2 @${f}`);
        for (const key of ['p_r1', 'p_core', 'p_r2', 'b_pk_mT', 'v_loop_rms'] as const) assertNear(u[key], w[key], 1e-9, `${key} @${f}`);
      });
    }
  });
}

const cdCtx: Context = { variant: { name: 'cd', cable: { length: 1.5094, vf: 0.7, z0: 50, alpha13: 0 }, Lj: 0 }, sweeps: {} };

test('every watt is accounted for: block powers sum to the drive power', () => {
  const d = drive(cdChain(), cdCtx, 13.56e6, 100);
  const total = [...reports(cdChain(), d).values()].reduce((a, r) => a + r.powerW, 0);
  assertNear(total, 100, 1e-9);
});

test('cap parts share current by capacitance; a series pair halves the voltage per part', () => {
  const one: Chain = { name: 't', blocks: [{ id: 'b', label: 'b', type: 'capBank', counts: counts(2, 1, 0), customPf: 0, nSeries: 1, slots: 4, k: param(1), esr: 0.01, searchable: false },
    { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(10) }] }] };
  const r1 = reports(one, drive(one, cdCtx, 13.56e6, 50)).get('b') ?? assert.fail('no bank');
  const [p100, p50] = r1.parts ?? [];
  assertNear(p100.iRms / p50.iRms, 2, 1e-12);
  assert.equal(p100.count, 2);
  const two: Chain = { ...one, blocks: [{ ...(one.blocks[0] as CapBankBlock), nSeries: 2 }, one.blocks[1]] };
  const r2 = reports(two, drive(two, cdCtx, 13.56e6, 50)).get('b') ?? assert.fail('no bank');
  assertNear((r2.parts ?? [])[0].vRms, (r2.vCapRms ?? NaN) / 2, 1e-12);
  assert.equal((r2.parts ?? [])[0].count, 4);
  assert.ok((maxCapStressPct(reports(one, drive(one, cdCtx, 13.56e6, 50))) ?? 0) > 0);
});

test('an open port or a lossless network is a DriveError, not NaN (review focus 5)', () => {
  const open: Chain = { name: 'o', blocks: [{ id: 'c', label: 'c', type: 'capBank', counts: counts(), customPf: 0, nSeries: 1, slots: 1, k: param(1), esr: 0, searchable: false },
    { id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(50) }] }] };
  assert.throws(() => drive(open, cdCtx, 13.56e6, 100), DriveError);
  const lossless: Chain = { name: 'l', blocks: [{ id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'c', label: 'c', type: 'primitive', kind: 'C', value: param(100e-12) }] }] };
  assert.throws(() => drive(lossless, cdCtx, 13.56e6, 100), DriveError);
});

test('a non-finite element value is a DriveError that says so, not "open" (final review I2)', () => {
  const bad: Chain = { name: 'b', blocks: [{ id: 'arm', label: 'arm', type: 'shunt', chain: [{ id: 'r', label: 'r', type: 'primitive', kind: 'R', value: param(Number.NaN) }] }] };
  assert.throws(() => drive(bad, cdCtx, 13.56e6, 100), /not finite/);
});

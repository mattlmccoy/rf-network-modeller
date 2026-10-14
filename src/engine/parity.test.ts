import test from 'node:test';
import { cx, inv } from './complex.ts';
import { type Cable, coaxY, deembed, embed } from './coax.ts';
import { type Element, type Netlist, inputImpedance } from './mna.ts';
import { type PlateLoad, type Unit, inputImpedanceUnits, loadAdmittance, unitAbcd, unitY } from './transformer.ts';
import { assertClose, pair, readFixtureJson } from '../testutil.ts';

interface Row { f: number; abcd: number[][][]; zx: number[]; zin: number[]; emb: number[]; de: number[] }
interface Net { c_series: number; c_shunt: number; esr_series: number; esr_shunt: number; l_series: number; r_lseries: number }
interface Case { name: string; units: Unit[]; load: PlateLoad; net: Net; cable: Cable; rows: Row[] }

const { cases } = readFixtureJson<{ cases: Case[] }>('rfchain_cases.json');
const w = (f: number): number => 2 * Math.PI * f;

/** rfchain.network_input as a netlist: series C → node (shunt C) → series L → paralleled units → plate load. */
function caseNetlist(c: Case, withCable: boolean): Netlist {
  const n = c.net;
  // nodes: 1 network input, 2 node, 3 primary, 4 secondary, 5 cable input (only with the cable)
  const elements: Element[] = [
    { kind: 'y', a: 1, b: 2, y: (f) => inv(cx(n.esr_series, -1 / (w(f) * n.c_series))) },
    { kind: 'y', a: 2, b: 0, y: (f) => inv(cx(n.esr_shunt, -1 / (w(f) * n.c_shunt))) },
    { kind: 'y', a: 2, b: 3, y: (f) => inv(cx(n.r_lseries, w(f) * n.l_series)) },
    ...c.units.map((u): Element => ({ kind: 'y2', a: 3, b: 4, y: (f) => unitY(u, f) })),
    { kind: 'y', a: 4, b: 0, y: (f) => loadAdmittance(c.load, f) },
  ];
  if (withCable) elements.push({ kind: 'y2', a: 5, b: 1, y: (f) => coaxY(c.cable, f) });
  return { nodeCount: withCable ? 6 : 5, port: withCable ? 5 : 1, elements };
}

for (const c of cases) {
  test(`rfchain parity: ${c.name}`, () => {
    for (const r of c.rows) {
      c.units.forEach((u, k) => unitAbcd(u, r.f).forEach((m, i) => assertClose(m, pair(r.abcd[k][i]), 1e-9, `abcd[${k}][${i}] @${r.f}`)));
      assertClose(inputImpedanceUnits(c.units, c.load, r.f), pair(r.zx), 1e-9, `input_impedance @${r.f}`);
      assertClose(inputImpedance(caseNetlist(c, false), r.f), pair(r.zin), 1e-9, `network_input @${r.f}`);
      assertClose(inputImpedance(caseNetlist(c, true), r.f), pair(r.emb), 1e-9, `netlist with cable @${r.f}`);
      assertClose(embed(pair(r.zin), c.cable, r.f), pair(r.emb), 1e-9, `embed @${r.f}`);
      assertClose(deembed(pair(r.emb), c.cable, r.f), pair(r.de), 1e-9, `deembed @${r.f}`);
    }
  });
}

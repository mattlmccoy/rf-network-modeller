import { type Complex, abs, add, conj, isFiniteC, mul, scale, sub } from '../engine/complex.ts';
import { SingularMatrixError } from '../engine/linsolve.ts';
import { solveNetlist } from '../engine/mna.ts';
import { type UnitState, unitState } from '../engine/transformer.ts';
import { type CapValue, CAP_VALUES, HT50 } from '../blocks/ht50.ts';
import { capBankFarads, groupPf } from '../chain/blockZ.ts';
import { type Compiled, compile, seriesY } from '../chain/compile.ts';
import { findBlock } from '../chain/state.ts';
import type { Block, Chain, Context } from '../chain/types.ts';

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

/** Node voltages scaled so that `watts` enters the port (the cage coax at the AIT output); input current real. */
export interface Drive {
  f: number;
  watts: number;
  zin: Complex;
  iIn: number;
  v: Complex[];
  compiled: Compiled;
}

export function drive(chain: Chain, ctx: Context, f: number, watts: number): Drive {
  const compiled = compile(chain, ctx);
  let v: Complex[];
  try {
    v = solveNetlist(compiled.net, f).v;
  } catch (e) {
    if (e instanceof SingularMatrixError) throw new DriveError('the network is open at the port, so no power can enter');
    throw e;
  }
  const zin = v[compiled.net.port];
  if (!isFiniteC(zin) || !(zin.re > 0)) {
    throw new DriveError(`Re(Z_in) = ${zin.re.toFixed(3)} Ω at ${(f / 1e6).toFixed(4)} MHz, so no real power can enter`);
  }
  const k = Math.sqrt(watts / zin.re);
  return { f, watts, zin, iIn: k, v: v.map((x) => scale(x, k)), compiled };
}

export interface PartStress {
  pf: number;
  count: number;
  vRms: number;
  iRms: number;
  pctV: number | null;
  pctI: number | null;
  pct: number | null;
}

export interface BlockReport {
  blockId: string;
  type: Block['type'];
  /** Voltage across the block (two-terminal) or at its port-1 node (two-port). */
  v: Complex;
  /** Current through the block (two-terminal) or into port 1 (two-port). */
  i: Complex;
  /** Real power absorbed by the block. */
  powerW: number;
  vCapRms?: number;
  parts?: PartStress[];
  unit?: UnitState;
  v2?: Complex;
  pCube?: number;
  pFix?: number;
}

function partStress(pf: number, count: number, vRms: number, iRms: number, rated: boolean): PartStress {
  if (!rated) return { pf, count, vRms, iRms, pctV: null, pctI: null, pct: null };
  const r = HT50[pf as CapValue];
  const pctV = (100 * vRms) / r.vRms;
  const pctI = (100 * iRms) / r.iRms;
  return { pf, count, vRms, iRms, pctV, pctI, pct: Math.max(pctV, pctI) };
}

/** Voltage, current and power for every block that carries current in the drive (spec §10). */
export function reports(chain: Chain, d: Drive): Map<string, BlockReport> {
  const out = new Map<string, BlockReport>();
  const { f, v, compiled } = d;
  const w = 2 * Math.PI * f;
  for (const run of compiled.runs) {
    const i = mul(sub(v[run.a], v[run.b]), seriesY(run.parts, f));
    for (const p of run.parts) {
      const vb = mul(i, p.z(f));
      const block = findBlock(chain, p.blockId) as Block;
      const r: BlockReport = { blockId: p.blockId, type: block.type, v: vb, i, powerW: mul(vb, conj(i)).re };
      if (block.type === 'capBank') {
        const gpf = groupPf(block);
        const iA = abs(i);
        r.vCapRms = iA / (w * capBankFarads(block));
        const vPart = iA / (w * gpf * 1e-12 * block.k.value); // voltage across one parallel group
        r.parts = [
          ...CAP_VALUES.filter((c) => block.counts[c] > 0).map((c) => partStress(c, block.counts[c] * block.nSeries, vPart, (iA * c) / gpf, true)),
          ...(block.customPf > 0 ? [partStress(block.customPf, block.nSeries, vPart, (iA * block.customPf) / gpf, false)] : []),
        ];
      }
      if (block.type === 'plates') {
        const va = abs(vb);
        r.pCube = va ** 2 * block.G_cube.value;
        r.pFix = va ** 2 * block.G_fix.value;
      }
      out.set(p.blockId, r);
    }
  }
  for (const t of compiled.twoPorts) {
    const y = t.y(f);
    const va = v[t.a];
    const vb = v[t.b];
    const ia = add(mul(y[0], va), mul(y[1], vb));
    const ib = add(mul(y[2], va), mul(y[3], vb));
    const block = findBlock(chain, t.blockId) as Block;
    const r: BlockReport = { blockId: t.blockId, type: block.type, v: va, i: ia, v2: vb, powerW: mul(va, conj(ia)).re + mul(vb, conj(ib)).re };
    if (block.type === 'stack') r.unit = unitState(block.unit, y, f, va, vb);
    out.set(t.blockId, r);
  }
  return out;
}

/** Highest % of rating over every rated cap part, or null when no rated part carries current. */
export function maxCapStressPct(reps: Map<string, BlockReport>): number | null {
  let m: number | null = null;
  for (const r of reps.values()) for (const p of r.parts ?? []) if (p.pct !== null) m = m === null ? p.pct : Math.max(m, p.pct);
  return m;
}

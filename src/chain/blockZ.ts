import { cx, inv, sub } from '../engine/complex.ts';
import { deembed } from '../engine/coax.ts';
import { countsPf } from '../blocks/ht50.ts';
import { estimateWire } from '../blocks/wire.ts';
import { type Sweep, interpClamp, zFromGamma } from '../io/sweep.ts';
import type { BranchTable, CapBankBlock, MeasuredBranchBlock, TwoTerminalBlock, Variant, ZFn } from './types.ts';

export type BlockImpedance = { kind: 'z'; z: ZFn } | { kind: 'short' } | { kind: 'open' };

const w = (f: number): number => 2 * Math.PI * f;

/** Nominal capacitance of one parallel group [pF]. */
export const groupPf = (b: CapBankBlock): number => countsPf(b.counts) + b.customPf;

/** Actual bank capacitance [F]: nominal group × scale k, divided by the number of groups in series. */
export const capBankFarads = (b: CapBankBlock): number => (groupPf(b) * 1e-12 * b.k.value) / b.nSeries;

/** z_p(f) = deembed(Z_sweep, variant cable) − jωL_j on the sweep's own grid (o7_joint.py). */
export function buildBranchTable(s: Sweep, v: Variant): BranchTable {
  const re: number[] = [];
  const im: number[] = [];
  s.f.forEach((f, i) => {
    const zp = sub(deembed(zFromGamma(s.gamma[i]), v.cable, f), cx(0, w(f) * v.Lj));
    re.push(zp.re);
    im.push(zp.im);
  });
  return { f: s.f, re, im };
}

/** Frequency at which the branch table is read: f·(1 + d) with the sense loop on (o7_loopstate.py `shifted`). */
export const branchFreq = (b: MeasuredBranchBlock, f: number): number => f * (1 + (b.loop ? b.d.value : 0));

export function branchOutOfRange(b: MeasuredBranchBlock, t: BranchTable, f: number): boolean {
  const fe = branchFreq(b, f);
  return fe < t.f[0] || fe > t.f[t.f.length - 1];
}

/** kr·Re z_p(f(1+d)) + j·Im z_p(f(1+d)) (+ jω·dLb with the loop on), clamped at the table ends. */
export function measuredZ(b: MeasuredBranchBlock, t: BranchTable): ZFn {
  return (f) => {
    const fe = branchFreq(b, f);
    const re = interpClamp(t.f, t.re, fe);
    const im = interpClamp(t.f, t.im, fe);
    return cx(b.kr.value * re, im + (b.loop ? w(f) * b.dLb.value : 0));
  };
}

function primitiveZ(kind: 'R' | 'L' | 'C' | 'short', v: number): BlockImpedance {
  if (kind === 'short') return { kind: 'short' };
  if (kind === 'R') return v === 0 ? { kind: 'short' } : { kind: 'z', z: () => cx(v) };
  if (kind === 'L') return v === 0 ? { kind: 'short' } : { kind: 'z', z: (f) => cx(0, w(f) * v) };
  return v > 0 ? { kind: 'z', z: (f) => cx(0, -1 / (w(f) * v)) } : { kind: 'open' };
}

/** Impedance of a two-terminal block; `table` supplies the measured branch for the active variant. */
export function twoTerminalZ(b: TwoTerminalBlock, table: (sweepId: string) => BranchTable): BlockImpedance {
  switch (b.type) {
    case 'capBank': {
      const c = capBankFarads(b);
      if (!(c > 0)) return { kind: 'open' };
      return { kind: 'z', z: (f) => cx(b.esr, -1 / (w(f) * c)) };
    }
    case 'inductor':
      if (b.L.value === 0 && b.R === 0) return { kind: 'short' };
      return { kind: 'z', z: (f) => cx(b.R, w(f) * b.L.value) };
    case 'wire':
      if (!(b.lengthMm > 0)) return { kind: 'short' };
      return {
        kind: 'z',
        z: (f) => {
          const e = estimateWire(b.lengthMm, b.awg, b.strands, f);
          return cx(e.R, w(f) * e.L);
        },
      };
    case 'measuredBranch':
      return { kind: 'z', z: measuredZ(b, table(b.sweepId)) };
    case 'plates': {
      const g = b.G_cube.value + b.G_fix.value;
      const c = b.C.value;
      if (g === 0 && c === 0) return { kind: 'open' };
      return { kind: 'z', z: (f) => inv(cx(g, w(f) * c)) };
    }
    case 'primitive':
      return primitiveZ(b.kind, b.value.value);
  }
}

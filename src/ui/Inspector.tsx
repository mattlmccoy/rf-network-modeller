import type { Dispatch, ReactNode } from 'react';
import { CAP_VALUES } from '../blocks/ht50.ts';
import { type Design, estimateUnit } from '../blocks/design.ts';
import { estimateWire } from '../blocks/wire.ts';
import { findBlock } from '../chain/state.ts';
import { type Block, type Param, param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary, designEquals } from '../app/units.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';
import { ParamField } from './ParamField.tsx';

type Num = (label: string, value: number, onCommit: (v: number) => void, attrs?: { min?: string; step?: string }) => ReactNode;
type Field = (k: ParamKey, label: string) => ReactNode;
type Patch = (p: Record<string, unknown>) => void;

const PRIMITIVE_DEFAULT: Record<'R' | 'L' | 'C' | 'short', Param> = {
  R: param(50),
  L: param(100e-9, 'typed', false, 1e-9, 10e-6),
  C: param(100e-12, 'typed', false, 1e-12, 10e-9),
  short: param(0),
};

function fields(b: Block, s: AppState, num: Num, field: Field, patch: Patch): ReactNode[] {
  switch (b.type) {
    case 'capBank':
      return [
        ...CAP_VALUES.map((v) => num(`${v} pF parts`, b.counts[v], (n) => patch({ counts: { ...b.counts, [v]: Math.max(0, Math.round(n)) } }), { min: '0', step: '1' })),
        num('Custom pF (per group)', b.customPf, (n) => patch({ customPf: Math.max(0, n) }), { min: '0' }),
        <div className="form-row" key="ns"><label>Groups in series</label><select value={b.nSeries} onChange={(e) => patch({ nSeries: e.target.value === '2' ? 2 : 1 })}><option value={1}>1</option><option value={2}>2</option></select></div>,
        num('Slots in this bank', b.slots, (n) => patch({ slots: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        field('k', 'Cap scale k'),
        num('ESR (Ω)', b.esr, (n) => patch({ esr: Math.max(0, n) }), { min: '0' }),
        <label className="check-row" key="search"><input type="checkbox" checked={b.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> Recommend may change this bank</label>,
      ];
    case 'inductor':
      return [field('L', 'Inductance'), num('Series R (Ω)', b.R, (n) => patch({ R: Math.max(0, n) }), { min: '0' })];
    case 'wire': {
      const e = estimateWire(b.lengthMm, b.awg, b.strands, 13.56e6);
      return [
        num('Length (mm)', b.lengthMm, (n) => patch({ lengthMm: Math.max(0, n) }), { min: '0' }),
        num('AWG', b.awg, (n) => patch({ awg: Math.round(n) }), { step: '1' }),
        num('Strands', b.strands, (n) => patch({ strands: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <small key="est">At 13.56 MHz: L ≈ {(e.L * 1e9).toFixed(1)} nH, R ≈ {(e.R * 1e3).toFixed(1)} mΩ <span className="badge est">est</span></small>,
      ];
    }
    case 'measuredBranch':
      return [
        <div className="form-row" key="sw"><label>Cap-free sweep</label><select value={b.sweepId} onChange={(e) => patch({ sweepId: e.target.value })}>{Object.values(s.sweeps).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>,
        <label className="check-row" key="loop"><input type="checkbox" checked={b.loop} onChange={(e) => patch({ loop: e.target.checked })} /> Sense loop installed</label>,
        field('kr', 'Branch R scale'),
        field('d', 'Loop shift'),
        field('dLb', 'Loop ΔL'),
      ];
    case 'stack': {
      const d: Design = b.design ?? { N_p: b.unit.N_p, N_s: Math.round(b.unit.n * b.unit.N_p), N_c: b.unit.N_c, strap: false };
      const set = (next: Design): void => {
        if (!designEquals(next, d)) patch({ design: next, unit: estimateUnit(next), source: 'estimate' }); // a no-change blur keeps a fitted model
      };
      const u = b.unit;
      return [
        num('Primary turns', d.N_p, (n) => set({ ...d, N_p: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Secondary turns', d.N_s, (n) => set({ ...d, N_s: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Cores (Material 67)', d.N_c, (n) => set({ ...d, N_c: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <label className="check-row" key="strap"><input type="checkbox" checked={d.strap} onChange={(e) => set({ ...d, strap: e.target.checked })} /> Strap primary</label>,
        <small key="unit">
          Model <span className={`badge ${b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}`}>{b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}</span>:
          {' '}n {u.n.toFixed(3)}, L_leak {(u.L_leak * 1e6).toFixed(3)} µH, L_m {(u.L_m * 1e6).toFixed(3)} µH, R1 {u.R1.toFixed(3)} Ω, R2 {u.R2.toFixed(2)} Ω, C_w {(u.C_w * 1e12).toFixed(2)} pF.
          Changing turns or cores re-estimates it with the design.py scaling laws.
        </small>,
      ];
    }
    case 'plates':
      return [field('C', 'Plate C'), field('G_cube', 'Cube conductance'), field('G_fix', 'Fixture conductance')];
    case 'primitive':
      return [
        <div className="form-row" key="kind"><label>Kind</label><select value={b.kind} onChange={(e) => { const k = e.target.value as 'R' | 'L' | 'C' | 'short'; patch({ kind: k, value: PRIMITIVE_DEFAULT[k] }); }}><option value="R">Resistor</option><option value="L">Inductor</option><option value="C">Capacitor</option><option value="short">Short</option></select></div>,
        ...(b.kind === 'short' ? [] : [field('value', 'Value')]),
      ];
    case 'ideal':
      return [num('Turns ratio n (1:n)', b.n, (n) => patch({ n: n > 0 ? n : b.n }), { min: '0' })];
    case 'coax': {
      const c = s.variants[s.primary].cable;
      return [<small key="c">Uses the cable of the variant chosen in the title bar: {c.length} m, VF {c.vf}, Z₀ {c.z0} Ω, loss {c.alpha13} Np. Editing variants comes in Plan 2b.</small>];
    }
    case 'shunt':
      return [<small key="s">Everything inside runs from this node to ground. Use "Add inside" in the circuit toolbar.</small>];
    case 'parallel':
      return [<small key="p">{b.chains.length} arms between the same two nodes. "Add inside" adds to the first arm; "Add arm" adds an arm.</small>];
  }
}

export function Inspector({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const view = variantChain(state, state.primary);
  const b = state.selected ? findBlock(view, state.selected) : undefined;
  if (!b) {
    return <fieldset><legend>Block</legend><small>Click a block in the circuit to edit it. Numbers shown are for the variant chosen in the title bar; typing a value applies it to every variant.</small></fieldset>;
  }
  const patch: Patch = (p) => dispatch({ type: 'patchBlock', id: b.id, patch: p });
  const field: Field = (k, label) => (
    <ParamField key={k} block={b} k={k} label={label} param={(b as unknown as Record<string, Param>)[k]}
      onValue={(v) => dispatch({ type: 'setParam', ref: { blockId: b.id, key: k }, value: v })}
      onFree={(free) => dispatch({ type: 'setFree', ref: { blockId: b.id, key: k }, free })} />
  );
  const num: Num = (label, value, onCommit, attrs = {}) => <div className="form-row" key={label}><label>{label}</label><DraftNumberInput step="any" {...attrs} value={value} onCommit={onCommit} /></div>;
  return (
    <fieldset>
      <legend>Block</legend>
      <div className="form-row"><label>Name</label><input value={b.label} onChange={(e) => patch({ label: e.target.value })} /></div>
      <small>{blockSummary(b)} · values for {state.variants[state.primary].name}</small>
      <div className="inspector-body">{fields(b, state, num, field, patch)}</div>
    </fieldset>
  );
}

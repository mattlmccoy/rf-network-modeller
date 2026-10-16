import type { Dispatch, ReactNode } from 'react';
import { CAP_VALUES, physicalParts, stockLeft, sumCounts } from '../blocks/ht50.ts';
import { type Design, estimateUnit } from '../blocks/design.ts';
import { estimateWire } from '../blocks/wire.ts';
import { allBlocks, findBlock } from '../chain/state.ts';
import { type Block, type CapBankBlock, type Param, param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary, designEquals } from '../app/units.ts';
import { type FieldSet, type Level, PROFILES } from '../present/level.ts';
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

const readOnly = (_b: Block): ReactNode => <small key="ro">Switch to Builder level to change it.</small>;

/** Fields by level (spec §5): Beginner edits stock picks and the loop; Builder adds physical values; Engineer sees everything. */
function fields(b: Block, s: AppState, num: Num, field: Field, patch: Patch, set: FieldSet): ReactNode[] {
  const phys = set !== 'stock';
  const all = set === 'all';
  switch (b.type) {
    case 'capBank':
      return [
        ...CAP_VALUES.map((v) => num(`${v} pF parts`, b.counts[v], (n) => patch({ counts: { ...b.counts, [v]: Math.max(0, Math.round(n)) } }), { min: '0', step: '1' })),
        ...(phys ? [
          num('Custom pF (per group)', b.customPf, (n) => patch({ customPf: Math.max(0, n) }), { min: '0' }),
          <div className="form-row" key="ns"><label>Groups in series</label><select value={b.nSeries} onChange={(e) => patch({ nSeries: e.target.value === '2' ? 2 : 1 })}><option value={1}>1</option><option value={2}>2</option></select></div>,
        ] : []),
        ...(all ? [
          num('Slots in this bank', b.slots, (n) => patch({ slots: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
          field('k', 'Cap scale k'),
          num('ESR (Ω)', b.esr, (n) => patch({ esr: Math.max(0, n) }), { min: '0' }),
          <label className="check-row" key="search"><input type="checkbox" checked={b.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> Suggestions may change this bank</label>,
        ] : []),
      ];
    case 'inductor':
      if (!phys) return [readOnly(b)];
      return [field('L', 'Inductance'), ...(all ? [num('Series R (Ω)', b.R, (n) => patch({ R: Math.max(0, n) }), { min: '0' })] : [])];
    case 'wire': {
      if (!phys) return [readOnly(b)];
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
        <label className="check-row" key="loop"><input type="checkbox" checked={b.loop} onChange={(e) => patch({ loop: e.target.checked })} /> Sense loop installed</label>,
        ...(phys ? [<div className="form-row" key="sw"><label>Measured with</label><select value={b.sweepId} onChange={(e) => patch({ sweepId: e.target.value })}>{Object.values(s.sweeps).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>] : []),
        ...(all ? [field('kr', 'Branch R scale'), field('d', 'Loop shift'), field('dLb', 'Loop ΔL')] : []),
      ];
    case 'stack': {
      if (!phys) return [readOnly(b)];
      const d: Design = b.design ?? { N_p: b.unit.N_p, N_s: Math.round(b.unit.n * b.unit.N_p), N_c: b.unit.N_c, strap: false };
      const set2 = (next: Design): void => {
        if (!designEquals(next, d)) patch({ design: next, unit: estimateUnit(next), source: 'estimate' }); // a no-change blur keeps a fitted model
      };
      const u = b.unit;
      return [
        num('Primary turns', d.N_p, (n) => set2({ ...d, N_p: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Secondary turns', d.N_s, (n) => set2({ ...d, N_s: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        num('Cores (Material 67)', d.N_c, (n) => set2({ ...d, N_c: Math.max(1, Math.round(n)) }), { min: '1', step: '1' }),
        <label className="check-row" key="strap"><input type="checkbox" checked={d.strap} onChange={(e) => set2({ ...d, strap: e.target.checked })} /> Strap primary</label>,
        ...(all ? [<small key="unit">Model <span className={`badge ${b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}`}>{b.source === 'estimate' ? 'est' : b.source === 'fit' ? 'fit' : 'typed'}</span>: n {u.n.toFixed(3)}, L_leak {(u.L_leak * 1e6).toFixed(3)} µH, L_m {(u.L_m * 1e6).toFixed(3)} µH, R1 {u.R1.toFixed(3)} Ω, R2 {u.R2.toFixed(2)} Ω, C_w {(u.C_w * 1e12).toFixed(2)} pF. Changing turns or cores re-estimates it with the design.py scaling laws.</small>] : []),
      ];
    }
    case 'plates':
      if (!phys) return [readOnly(b)];
      return [field('C', 'Plate C'), ...(all ? [field('G_cube', 'Cube conductance'), field('G_fix', 'Fixture conductance')] : [])];
    case 'primitive':
      if (!all) return [readOnly(b)];
      return [
        <div className="form-row" key="kind"><label>Kind</label><select value={b.kind} onChange={(e) => { const k = e.target.value as 'R' | 'L' | 'C' | 'short'; patch({ kind: k, value: PRIMITIVE_DEFAULT[k] }); }}><option value="R">Resistor</option><option value="L">Inductor</option><option value="C">Capacitor</option><option value="short">Short</option></select></div>,
        ...(b.kind === 'short' ? [] : [field('value', 'Value')]),
      ];
    case 'ideal':
      if (!all) return [readOnly(b)];
      return [num('Turns ratio n (1:n)', b.n, (n) => patch({ n: n > 0 ? n : b.n }), { min: '0' })];
    case 'coax': {
      const c = s.variants[s.primary].cable;
      return [<small key="c">{all ? `Uses the chosen cable assumption: ${c.length} m, VF ${c.vf}, Z₀ ${c.z0} Ω, loss ${c.alpha13} Np.` : `${c.length} m of coax from the tuner.`}</small>];
    }
    case 'shunt':
      return [<small key="s">Everything inside runs from this point to ground.</small>];
    case 'parallel':
      return [<small key="p">{b.chains.length} paths between the same two points.</small>];
  }
}

function StockLine({ s }: { s: AppState }) {
  const used = sumCounts(allBlocks(s.chain.blocks).filter((x): x is CapBankBlock => x.type === 'capBank').map((x) => physicalParts(x)));
  const left = stockLeft(s.stock, used);
  return <small className={CAP_VALUES.some((v) => left[v] < 0) ? 'bad' : ''}>{CAP_VALUES.map((v) => `${v} pF: ${s.stock[v]} on hand, ${used[v]} in circuit, ${left[v]} left`).join(' · ')}</small>;
}

export function PartEditor({ state, dispatch, level }: { state: AppState; dispatch: Dispatch<Action>; level: Level }) {
  const set = PROFILES[level].fields;
  const b = state.selected ? findBlock(variantChain(state, state.primary), state.selected) : undefined;
  if (!b) return null;
  const patch: Patch = (p) => dispatch({ type: 'patchBlock', id: b.id, patch: p });
  const field: Field = (k, label) => (
    <ParamField key={k} block={b} k={k} label={label} param={(b as unknown as Record<string, Param>)[k]} showFree={set === 'all'}
      onValue={(v) => dispatch({ type: 'setParam', ref: { blockId: b.id, key: k }, value: v })}
      onFree={(free) => dispatch({ type: 'setFree', ref: { blockId: b.id, key: k }, free })} />
  );
  const num: Num = (label, value, onCommit, attrs = {}) => <div className="form-row" key={label}><label>{label}</label><DraftNumberInput step="any" {...attrs} value={value} onCommit={onCommit} /></div>;
  return (
    <section className="panel part-editor" data-tour="editor">
      <header className="panel-head"><h3>{b.label}</h3><button onClick={() => dispatch({ type: 'select', id: null })} aria-label="Close the part editor">×</button></header>
      {set !== 'stock' ? <div className="form-row"><label>Name</label><input value={b.label} onChange={(e) => patch({ label: e.target.value })} /></div> : null}
      <small>{blockSummary(b)}{PROFILES[level].nameAssumptions ? ` · values for ${state.variants[state.primary].name}` : ''}</small>
      <div className="inspector-body">{fields(b, state, num, field, patch, set)}</div>
      {b.type === 'capBank' ? <StockLine s={state} /> : null}
    </section>
  );
}

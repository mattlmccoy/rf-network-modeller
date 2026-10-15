import type { Dispatch } from 'react';
import type { Variant, Window } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

/** Engineer rig settings (spec §8.4): the cable assumptions and what the tuner can match. */
export function RigSettings({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const set = (i: number, v: Variant): void => dispatch({ type: 'setVariants', variants: state.variants.map((x, j) => (j === i ? v : x)) });
  const edit = (v: Variant, patch: { name?: string; length?: number; Lj?: number }): Variant =>
    ({ name: patch.name ?? v.name, cable: { ...v.cable, length: patch.length ?? v.cable.length }, Lj: patch.Lj ?? v.Lj });
  const win = (k: keyof Window, n: number): void => dispatch({ type: 'setWindow', window: { ...state.window, [k]: n } });
  const p = state.variants[state.primary];
  return (
    <>
      <table className="numbers">
        <thead><tr><th>Cable assumption</th><th>Length (m)</th><th>Jumper L (nH)</th><th /></tr></thead>
        <tbody>
          {state.variants.map((v, i) => (
            <tr key={i}>
              <td><input value={v.name} onChange={(e) => set(i, { ...v, name: e.target.value })} aria-label="Cable assumption name" /></td>
              <td><DraftNumberInput min="0" step="any" value={v.cable.length} onCommit={(n) => set(i, edit(v, { length: n }))} aria-label="Cable length (m)" /></td>
              <td><DraftNumberInput step="any" value={Number((v.Lj * 1e9).toPrecision(8))} onCommit={(n) => set(i, edit(v, { Lj: n * 1e-9 }))} aria-label="Jumper inductance (nH)" /></td>
              <td><button disabled={state.variants.length < 2} onClick={() => dispatch({ type: 'setVariants', variants: state.variants.filter((_, j) => j !== i) })} aria-label={`Remove ${v.name}`}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => dispatch({ type: 'setVariants', variants: [...state.variants, { ...edit(p, {}), name: `${p.name} (copy)` }] })}>Add a cable assumption</button>
      <small>Changing a length or jumper inductance clears that assumption's fitted values; renaming keeps them.</small>
      <h4>What the tuner can match</h4>
      {(['rLo', 'rHi', 'xLo', 'xHi'] as const).map((k) => (
        <div className="form-row" key={k}>
          <label>{{ rLo: 'Resistance from (Ω)', rHi: 'Resistance to (Ω)', xLo: 'Reactance from (Ω)', xHi: 'Reactance to (Ω)' }[k]}</label>
          <DraftNumberInput step="any" value={state.window[k]} onCommit={(n) => win(k, n)} />
        </div>
      ))}
    </>
  );
}

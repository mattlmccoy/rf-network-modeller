import type { Dispatch } from 'react';
import { CAP_VALUES, physicalParts, stockLeft, sumCounts } from '../blocks/ht50.ts';
import { allBlocks } from '../chain/state.ts';
import type { CapBankBlock } from '../chain/types.ts';
import type { Action, AppState } from '../app/state.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

export function StockPanel({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const used = sumCounts(allBlocks(state.chain.blocks).filter((b): b is CapBankBlock => b.type === 'capBank').map((b) => physicalParts(b)));
  const left = stockLeft(state.stock, used);
  return (
    <fieldset>
      <legend>HT50 stock</legend>
      <div className="stock-grid">
        <b>Value</b><b>On hand</b><b>In circuit</b><b>Left</b>
        {CAP_VALUES.map((v) => [
          <span key={`v${v}`}>{v} pF</span>,
          <DraftNumberInput key={`s${v}`} min="0" step="1" value={state.stock[v]} onCommit={(n) => dispatch({ type: 'setStock', stock: { ...state.stock, [v]: Math.max(0, Math.round(n)) } })} />,
          <span key={`u${v}`}>{used[v]}</span>,
          <span key={`l${v}`} className={left[v] < 0 ? 'bad' : ''}>{left[v]}</span>,
        ])}
      </div>
      {CAP_VALUES.some((v) => left[v] < 0) ? <small className="bad">The circuit uses more parts than you have on hand.</small> : null}
    </fieldset>
  );
}

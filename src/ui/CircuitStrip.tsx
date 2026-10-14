import { type Dispatch, Fragment, useState } from 'react';
import { findBlock } from '../chain/state.ts';
import type { Block } from '../chain/types.ts';
import { type NewBlockKind, PALETTE, newBlock } from '../app/chainEdit.ts';
import { type Action, type AppState, variantChain } from '../app/state.ts';
import { blockSummary } from '../app/units.ts';
import { BlockArt } from './BlockArt.tsx';

type Pick = (id: string) => void;

function Card({ block, selected, view, onPick }: { block: Block; selected: string | null; view: 'physical' | 'symbol'; onPick: Pick }) {
  if (block.type === 'shunt' || block.type === 'parallel') {
    const arms = block.type === 'shunt' ? [block.chain] : block.chains;
    return (
      <div className={`block-group ${selected === block.id ? 'selected' : ''}`}>
        <header onClick={() => onPick(block.id)} title="Select this group">{block.type === 'shunt' ? `${block.label} ⏚` : `${block.label} ∥`}</header>
        <div className="group-arms">
          {arms.map((arm, i) => (
            <div className="group-col" key={i}>
              {arm.map((b) => <Card key={b.id} block={b} selected={selected} view={view} onPick={onPick} />)}
              {block.type === 'shunt' ? <span className="ground" aria-label="ground">⏚</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <button type="button" className={`block-card ${selected === block.id ? 'selected' : ''}`} onClick={() => onPick(block.id)} title={blockSummary(block)}>
      <BlockArt block={block} view={view} />
      <b>{block.label}</b>
      <span>{blockSummary(block)}</span>
    </button>
  );
}

export function CircuitStrip({ state, dispatch }: { state: AppState; dispatch: Dispatch<Action> }) {
  const [kind, setKind] = useState<NewBlockKind>('capBank');
  const view = variantChain(state, state.primary);
  const sel = state.selected ? findBlock(state.chain, state.selected) : undefined;
  const make = (): Block => newBlock(state.chain, kind, Object.keys(state.sweeps)[0] ?? '');
  const pick: Pick = (id) => dispatch({ type: 'select', id: state.selected === id ? null : id });
  return (
    <div className="circuit full-row">
      <div className="circuit-toolbar">
        <select value={kind} onChange={(e) => setKind(e.target.value as NewBlockKind)} aria-label="Block to add">
          {PALETTE.map((p) => <option key={p.kind} value={p.kind}>{p.label}</option>)}
        </select>
        <button onClick={() => dispatch({ type: 'insertAfter', targetId: state.selected, block: make() })}>{sel ? 'Add after selected' : 'Add at end'}</button>
        {sel && (sel.type === 'shunt' || sel.type === 'parallel') ? <button onClick={() => dispatch({ type: 'insertInto', containerId: sel.id, arm: 0, block: make() })}>Add inside</button> : null}
        {sel?.type === 'parallel' ? <button onClick={() => dispatch({ type: 'insertInto', containerId: sel.id, arm: sel.chains.length, block: make() })}>Add arm</button> : null}
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'move', id: sel.id, dir: -1 })} aria-label="Move left">◀</button>
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'move', id: sel.id, dir: 1 })} aria-label="Move right">▶</button>
        <button disabled={!sel} onClick={() => sel && dispatch({ type: 'remove', id: sel.id })}>✕ Remove</button>
        <span className="toolbar-spacer" />
        <button onClick={() => dispatch({ type: 'setView', view: state.view === 'physical' ? 'symbol' : 'physical' })}>⇄ {state.view === 'physical' ? 'Symbol view' : 'Physical view'}</button>
      </div>
      <div className="circuit-row">
        <span className="port-tag">VNA / AIT out</span>
        {view.blocks.map((b) => (
          <Fragment key={b.id}>
            <span className="wire-seg" />
            <Card block={b} selected={state.selected} view={state.view} onPick={pick} />
          </Fragment>
        ))}
        <span className="wire-seg" />
        <span className="port-tag">open end</span>
      </div>
    </div>
  );
}

import { Fragment, type ReactNode, useMemo, useState } from 'react';
import { countsPf } from '../../blocks/ht50.ts';
import { findBlock } from '../../chain/state.ts';
import { type Stage, type StageKind, stageTitle, stagesOf } from '../../present/stages.ts';
import type { Tone } from '../../present/verdict.ts';
import { COPPER, type DrawingProps, partValue } from './symbols.tsx';

const ICON: Record<StageKind, ReactNode> = {
  generator: <path className="sym" d="M6 20 q8 -14 16 0 t16 0 t16 0" />,
  tuner: <><circle cx="30" cy="20" r="13" className="sym" /><path className="sym" d="M30 20 L39 11" /></>,
  cable: <><path d="M6 26 c8 -22 16 22 24 0 s16 -22 24 -6" stroke="#8a8a8e" strokeWidth="6" fill="none" /><path d="M6 26 c8 -22 16 22 24 0 s16 -22 24 -6" stroke={COPPER} strokeWidth="2" fill="none" /></>,
  matching: <path className="sym" d="M6 12 H22 M22 4 V20 M28 4 V20 M28 12 H54 M40 12 V24 M32 24 H48 M32 29 H48 M40 29 V38" />,
  transformer: <><path className="sym" d="M22 4 v4 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 a4 4 0 0 1 0 8 v4 M38 4 v4 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 a4 4 0 0 0 0 8 v4" /><path className="sym" d="M28 4 V36 M32 4 V36" /></>,
  plates: <><path d="M14 8 H46 M14 32 H46" stroke={COPPER} strokeWidth="4" /><rect x="22" y="13" width="16" height="14" className="bed" /><rect x="26" y="16" width="8" height="8" className="cube" /></>,
};

/** Beginner drawing: the rig as stages; a stage opens to list its parts (spec §6.2). */
export function FlowView({ chain, selected, highlight, onSelect, cableM, tuner }: DrawingProps & { tuner: { text: string; tone: Tone } }) {
  const stages = useMemo(() => stagesOf(chain), [chain]);
  const [open, setOpen] = useState<StageKind>('matching');
  const line = (s: Stage): string => {
    const blocks = s.blockIds.map((id) => findBlock(chain, id));
    switch (s.kind) {
      case 'generator':
        return '13.56 MHz';
      case 'tuner':
        return 'fixes small errors';
      case 'cable':
        return `${cableM} m coax`;
      case 'matching': {
        const banks = blocks.flatMap((b) => (b?.type === 'capBank' ? [`${b.label.replace(/ bank$/i, '')} ${(countsPf(b.counts) + b.customPf) / b.nSeries} pF`] : []));
        return banks.join(' · ') || `${s.blockIds.length} parts`;
      }
      case 'transformer':
        return blocks.flatMap((b) => (b && (b.type === 'stack' || b.type === 'ideal' || b.type === 'measuredBranch') ? [b.label] : [])).join(', ');
      case 'plates':
        return 'where the heat goes';
    }
  };
  const shown = stages.find((s) => s.kind === open && s.blockIds.length > 0);
  return (
    <div className="flow">
      <div className={`tuner-tag ${tuner.tone}`}>{tuner.text}</div>
      <div className="flow-row">
        {stages.map((s, i) => (
          <Fragment key={s.kind}>
            {i ? <span className="flow-arrow" aria-hidden="true">→</span> : null}
            <button className={`stage${open === s.kind ? ' open' : ''}${s.blockIds.length ? '' : ' fixed'}${s.blockIds.some((id) => highlight.includes(id)) ? ' highlight' : ''}`} onClick={() => { if (s.blockIds.length) setOpen(s.kind); }}>
              <svg viewBox="0 0 60 40" className="stage-icon" aria-hidden="true">{ICON[s.kind]}</svg>
              <b>{stageTitle(s)}</b>
              <small>{line(s)}</small>
            </button>
          </Fragment>
        ))}
      </div>
      {shown ? (
        <div className="stage-parts">
          <small>Parts in the {stageTitle(shown).toLowerCase()}:</small>
          {shown.blockIds.map((id) => {
            const b = findBlock(chain, id);
            return <button key={id} className={selected === id ? 'selected' : ''} onClick={() => onSelect(id)}><b>{b?.label ?? id}</b> <span>{b ? partValue(b, cableM) : ''}</span></button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

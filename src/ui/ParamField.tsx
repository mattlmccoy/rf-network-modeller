import type { Block, Param } from '../chain/types.ts';
import type { ParamKey } from '../fit/params.ts';
import { displayUnit, paramCommit, toDisplay } from '../app/units.ts';
import { DraftNumberInput } from './DraftNumberInput.tsx';

const BADGE_TITLE = { fit: 'Fitted to sweeps', est: 'Estimated from geometry', typed: 'Typed by you' } as const;

/** One parameter: value in display units, its source badge, and whether Fit may change it (spec §5). */
export function ParamField({ block, k, label, param, onValue, onFree }: { block: Block; k: ParamKey; label: string; param: Param; onValue: (si: number) => void; onFree: (free: boolean) => void }) {
  const u = displayUnit(block, k);
  return (
    <div className="param-row">
      <label>{label}</label>
      <DraftNumberInput step="any" value={toDisplay(param.value, u)} onCommit={(v) => { const si = paramCommit(param, u, v); if (si !== null) onValue(si); }} />
      <span>{u.unit}</span>
      <span className={`badge ${param.badge}`} title={BADGE_TITLE[param.badge]}>{param.badge}</span>
      <label className="free-toggle" title="Let Fit adjust this value">
        <input type="checkbox" checked={param.free} onChange={(e) => onFree(e.target.checked)} />fit
      </label>
    </div>
  );
}

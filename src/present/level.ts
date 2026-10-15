export type Level = 'beginner' | 'builder' | 'engineer';
export type DrawingKind = 'flow' | 'hardware' | 'schematic';
export type ResultKind = 'verdict' | 'target' | 'plots';
export type FieldSet = 'stock' | 'physical' | 'all';
export type SheetKind = 'parts' | 'sweeps';

/** What one level shows (spec §5). */
export interface LevelProfile {
  label: string;
  drawing: DrawingKind;
  result: ResultKind;
  showOhms: boolean;
  nameAssumptions: boolean;
  fields: FieldSet;
  sheets: readonly SheetKind[];
}

export const LEVELS: readonly Level[] = ['beginner', 'builder', 'engineer'];

export const PROFILES: Readonly<Record<Level, LevelProfile>> = {
  beginner: { label: 'Beginner', drawing: 'flow', result: 'verdict', showOhms: false, nameAssumptions: false, fields: 'stock', sheets: ['parts'] },
  builder: { label: 'Builder', drawing: 'hardware', result: 'target', showOhms: true, nameAssumptions: false, fields: 'physical', sheets: ['parts', 'sweeps'] },
  engineer: { label: 'Engineer', drawing: 'schematic', result: 'plots', showOhms: true, nameAssumptions: true, fields: 'all', sheets: ['parts', 'sweeps'] },
};

export const DRAWING_LABEL: Readonly<Record<DrawingKind, string>> = { flow: 'Power flow', hardware: 'Hardware', schematic: 'Schematic' };
export const RESULT_LABEL: Readonly<Record<ResultKind, string>> = { verdict: 'Verdict', target: 'Target box', plots: 'Plots' };

/** A stored level, or Builder when it is missing or unrecognised (spec §5). */
export const parseLevel = (v: string | null): Level => (v === 'beginner' || v === 'builder' || v === 'engineer' ? v : 'builder');

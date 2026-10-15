import type { NewBlockKind, Placement } from '../app/chainEdit.ts';
import type { Level } from './level.ts';

export interface PaletteItem { kind: NewBlockKind; label: string }

const BEGINNER: readonly PaletteItem[] = [
  { kind: 'capBank', label: 'Capacitor bank' },
  { kind: 'stack', label: 'Transformer stack' },
  { kind: 'plates', label: 'Electrode plates' },
  { kind: 'wire', label: 'Strap or wire' },
];
const BUILDER: readonly PaletteItem[] = [...BEGINNER, { kind: 'inductor', label: 'Inductance' }, { kind: 'measuredBranch', label: 'Measured part (from a sweep)' }];
const ENGINEER: readonly PaletteItem[] = [
  ...BUILDER,
  { kind: 'R', label: 'Resistor' },
  { kind: 'L', label: 'Inductor (ideal)' },
  { kind: 'C', label: 'Capacitor (ideal)' },
  { kind: 'short', label: 'Short' },
  { kind: 'ideal', label: 'Ideal transformer' },
];

/** The parts each level can add (spec §8.4). */
export const paletteFor = (level: Level): readonly PaletteItem[] => (level === 'beginner' ? BEGINNER : level === 'builder' ? BUILDER : ENGINEER);

/** Where a new part can go; only Engineer can put one in parallel. */
export const placementsFor = (level: Level): readonly Placement[] => (level === 'engineer' ? ['inline', 'ground', 'parallel'] : ['inline', 'ground']);

export const PLACEMENT_LABEL: Readonly<Record<Placement, string>> = { inline: 'In line after it', ground: 'From there to ground', parallel: 'In parallel with it' };

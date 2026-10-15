import type { DrawingKind } from '../../present/level.ts';
import type { Tone } from '../../present/verdict.ts';
import { FlowView } from './FlowView.tsx';
import { HardwareView } from './HardwareView.tsx';
import { SchematicView } from './SchematicView.tsx';
import type { DrawingProps } from './symbols.tsx';

export function Drawing({ kind, tuner, ...p }: DrawingProps & { kind: DrawingKind; tuner: { text: string; tone: Tone } }) {
  if (kind === 'flow') return <FlowView {...p} tuner={tuner} />;
  return <div className="drawing-scroll">{kind === 'hardware' ? <HardwareView {...p} /> : <SchematicView {...p} />}</div>;
}

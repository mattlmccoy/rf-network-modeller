import { allBlocks } from '../chain/state.ts';
import type { Block, Chain } from '../chain/types.ts';

export type StageKind = 'generator' | 'tuner' | 'cable' | 'matching' | 'transformer' | 'plates';
export interface Stage { kind: StageKind; blockIds: string[]; measuredTogether: boolean }

const TRANSFORMER: ReadonlySet<Block['type']> = new Set(['stack', 'ideal', 'measuredBranch']);
const leaves = (b: Block): Block[] => allBlocks([b]).filter((x) => x.type !== 'shunt' && x.type !== 'parallel');

/** The power-flow grouping for the Beginner drawing: every leaf block in exactly one stage (spec §6.2). */
export function stagesOf(chain: Chain): Stage[] {
  const t = chain.blocks.findIndex((b) => leaves(b).some((x) => TRANSFORMER.has(x.type)));
  const before = (t < 0 ? chain.blocks : chain.blocks.slice(0, t)).flatMap(leaves);
  const after = (t < 0 ? [] : chain.blocks.slice(t)).flatMap(leaves);
  const first = after.find((x) => TRANSFORMER.has(x.type));
  const stage = (kind: StageKind, blocks: Block[], measuredTogether = false): Stage => ({ kind, blockIds: blocks.map((b) => b.id), measuredTogether });
  const all = [
    stage('generator', []),
    stage('tuner', []),
    stage('cable', before.filter((x) => x.type === 'coax')),
    stage('matching', before.filter((x) => x.type !== 'coax' && x.type !== 'plates')),
    stage('transformer', after.filter((x) => x.type !== 'plates'), first?.type === 'measuredBranch'),
    stage('plates', [...before, ...after].filter((x) => x.type === 'plates')),
  ];
  return all.filter((s) => s.blockIds.length > 0 || s.kind === 'generator' || s.kind === 'tuner' || s.kind === 'cable');
}

export function stageTitle(s: Stage): string {
  switch (s.kind) {
    case 'generator':
      return 'Generator';
    case 'tuner':
      return 'Auto-tuner';
    case 'cable':
      return 'Cable';
    case 'matching':
      return 'Matching box';
    case 'transformer':
      return s.measuredTogether ? 'Transformer + plates (measured together)' : 'Transformer';
    case 'plates':
      return 'Plates + part';
  }
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { allBlocks } from '../chain/state.ts';
import { type Block, type Chain, param } from '../chain/types.ts';
import { type Layout, type PartBox, type Pt, layoutChain } from './layout.ts';

const EPS = 1e-9;
const near = (a: Pt, b: Pt): boolean => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const terminals = (p: PartBox): Pt[] => (p.dir === 'h' ? [{ x: p.x, y: p.y + 0.5 }, { x: p.x + p.w, y: p.y + 0.5 }] : [{ x: p.x + 0.5, y: p.y }, { x: p.x + 0.5, y: p.y + p.h }]);
const overlap = (a: PartBox, b: PartBox): boolean => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const leafIds = (c: Chain): string[] => allBlocks(c.blocks).filter((b) => b.type !== 'shunt' && b.type !== 'parallel').map((b) => b.id).sort();

/** The three properties of spec §6.1: every leaf once, no overlapping boxes, no dangling wire ends. */
function checkProperties(c: Chain, l: Layout): void {
  assert.deepEqual(l.parts.map((p) => p.id).sort(), leafIds(c), 'every leaf block appears exactly once');
  for (let i = 0; i < l.parts.length; i += 1) for (let k = i + 1; k < l.parts.length; k += 1) assert.ok(!overlap(l.parts[i], l.parts[k]), `${l.parts[i].id} overlaps ${l.parts[k].id}`);
  const anchors = [l.port, ...l.junctions, ...l.grounds, ...l.parts.flatMap(terminals)];
  const ends = l.wires.flatMap((w) => [w.a, w.b]);
  for (const e of ends) {
    const anchored = anchors.some((a) => near(a, e));
    const shared = ends.filter((o) => near(o, e)).length >= 2;
    assert.ok(anchored || shared, `wire end (${e.x}, ${e.y}) is dangling`);
  }
}

test('O7: six parts, the shunt bank hangs down, the transformer arm ends the line as its load (spec §6.1)', () => {
  const c = o7Chain('capfree');
  const l = layoutChain(c);
  checkProperties(c, l);
  const by = (id: string): PartBox => l.parts.find((p) => p.id === id) as PartBox;
  assert.equal(by('sh').dir, 'v');
  for (const id of ['coax', 'ser', 'Ls', 'Lb', 'branch']) {
    assert.equal(by(id).dir, 'h');
    assert.ok(Math.abs(by(id).y + 0.5) < EPS, `${id} sits on the main line`);
  }
  assert.equal(by('branch').kind, 'measured');
  assert.equal(l.junctions.length, 1);
  assert.equal(l.grounds.length, 2);
});

test('C+D: the plates arm is the end load; stack and plates sit on the main line', () => {
  const c = cdChain();
  const l = layoutChain(c);
  checkProperties(c, l);
  assert.deepEqual(['stack', 'plates'].map((id) => l.parts.find((p) => p.id === id)?.dir), ['h', 'h']);
});

test('nested shunts and parallel arms still lay out without overlaps or dangling wires', () => {
  const prim = (id: string, kind: 'R' | 'L' | 'C'): Block => ({ id, label: id, type: 'primitive', kind, value: param(1) });
  const c: Chain = {
    name: 'nested',
    blocks: [
      prim('L1', 'L'),
      { id: 'S1', label: '', type: 'shunt', chain: [prim('L2', 'L'), { id: 'S2', label: '', type: 'shunt', chain: [prim('C1', 'C')] }, { id: 'P1', label: '', type: 'parallel', chains: [[prim('R1', 'R')], [prim('C2', 'C'), prim('L3', 'L')]] }] },
      prim('C3', 'C'),
      { id: 'P2', label: '', type: 'parallel', chains: [[], [prim('R2', 'R')]] },
    ],
  };
  checkProperties(c, layoutChain(c));
});

test('an empty chain is just the port', () => {
  const l = layoutChain({ name: 'blank', blocks: [] });
  assert.deepEqual([l.parts.length, l.wires.length, l.minX, l.maxX, l.minY, l.maxY], [0, 0, 0, 0, 0, 0]);
});

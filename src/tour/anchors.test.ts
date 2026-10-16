import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { allBlocks } from '../chain/state.ts';
import { LEVELS } from '../present/level.ts';
import { loadExampleState, ROOT } from '../testutil.ts';
import { stepsFor } from './run.ts';
import { TOURS } from './tours.ts';

const walk = (dir: URL): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(new URL(`${e.name}/`, dir)) : e.name.endsWith('.tsx') ? [readFileSync(new URL(e.name, dir), 'utf8')] : []));
const ui = walk(new URL('src/ui/', ROOT)).join('\n');

test('every tour target is an anchor in the UI, so tours cannot drift away from the screens (spec §7)', () => {
  const targets = new Set(TOURS.flatMap((t) => LEVELS.filter((l) => t.levels.includes(l)).flatMap((l) => stepsFor(t, l).map((s) => s.target))).filter((x): x is string => x !== null));
  const blockIds = new Set(allBlocks(loadExampleState().chain.blocks).map((b) => b.id));
  for (const id of targets) {
    if (id.startsWith('part-')) {
      assert.ok(blockIds.has(id.slice(5)), `${id} names a part of the practice project`);
      assert.ok(ui.includes('data-tour={`part-${'), 'drawings carry part anchors');
    } else if (id.startsWith('tile-')) {
      assert.ok(ui.includes('data-tour={`tile-${'), 'Home tiles carry tile anchors');
    } else {
      assert.ok(ui.includes(`data-tour="${id}"`) || ui.includes(`'${id}'`), `anchor ${id} exists in src/ui`);
    }
  }
});

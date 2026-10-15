import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROOT } from '../testutil.ts';
import { buildsOf } from '../present/builds.ts';
import { activeIsMeasured, hasModel } from '../present/circuit.ts';
import { historyCopy, historyUrl } from './copy.ts';
import { parseIndex } from './manifest.ts';

const index = parseIndex(readFileSync(new URL('public/history/index.json', ROOT), 'utf8'));
const texts = (paths: string[]) => Object.fromEntries(paths.map((p) => [p, readFileSync(new URL(`public/history/files/${p}`, ROOT), 'utf8')]));

test('a copy of a real session is measured only, tags its network sweeps, and shows the last one (review focus 1)', () => {
  const s = index.sessions.find((x) => x.sweeps.filter((w) => w.kind === 'network').length >= 2);
  assert.ok(s, 'the bundled history has a session with network sweeps');
  const st = historyCopy(s, texts(s.sweeps.map((w) => w.path)));
  const network = s.sweeps.filter((w) => w.kind === 'network');
  assert.equal(hasModel(st.chain), false);
  assert.equal(Object.keys(st.sweeps).length, s.sweeps.length, 'every sweep is loaded, also the ones that are not tagged');
  assert.deepEqual(st.tagged.map((t) => t.label), network.map((w) => w.label));
  assert.equal(st.activeSweep, st.tagged.at(-1)?.sweepId);
  assert.ok(activeIsMeasured(st.chain, st.tagged, st.activeSweep), 'the measured verdict applies to the copy as opened');
  assert.ok(buildsOf(st).length >= 1);
});

test('a session with no network sweeps opens with nothing tagged and no active sweep', () => {
  const s = index.sessions.find((x) => x.sweeps.length > 0 && x.sweeps.every((w) => w.kind !== 'network'));
  assert.ok(s, 'the bundled history has such a session');
  const st = historyCopy(s, texts(s.sweeps.map((w) => w.path)));
  assert.deepEqual(st.tagged, []);
  assert.equal(st.activeSweep, null);
});

test('history file paths are URL-encoded segment by segment', () => {
  assert.equal(historyUrl('2026-08-26/00_ORIGINAL_EXPORTS/300 300#1.s1p'), 'history/files/2026-08-26/00_ORIGINAL_EXPORTS/300%20300%231.s1p');
});

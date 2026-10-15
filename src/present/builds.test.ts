import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain } from '../chain/presets.ts';
import { loadExampleState } from '../testutil.ts';
import { buildSweep, buildsOf, dateText, stampOf } from './builds.ts';
import { reducer } from '../app/state.ts';
import { hasModel } from './circuit.ts';

const ex = loadExampleState();

test('the O7 example has five builds, one per tagged state, labelled by their parts (spec §9)', () => {
  const b = buildsOf(ex);
  assert.equal(b.length, 5);
  assert.equal(b[4].label, 'Series bank 80 pF · Shunt bank 180 pF · sense loop on');
  assert.deepEqual(b[4].sweepIds, ['o7-80-180-loop']);
});

test('two sweeps of the same build group together; no file stamp means date unknown (review focus 3)', () => {
  const again = { ...ex.sweeps['o7-80-180-loop'], id: 'again', name: 'x_nanovna-sweep-1791933400391.s1p' };
  const twice = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[4], sweepId: 'again', label: 'again' }], sweeps: { ...ex.sweeps, again } };
  const b = buildsOf(twice);
  assert.equal(b.length, 5);
  assert.deepEqual(b[4].sweepIds, ['o7-80-180-loop', 'again']);
  assert.equal(b[4].newest, 1791933400391);
  assert.equal(b[0].newest, null, 'the example files were renamed and carry no stamp');
  assert.equal(stampOf('noAIT_80ser_200sh_nanovna-sweep-1791931754256.s1p'), 1791931754256);
  assert.equal(stampOf('80-200.s1p'), null);
});

test('sweeps tagged with no circuit state (a measured-only project) group by their label (review focus 3)', () => {
  const chain = { name: 'm', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' as const }] };
  const tag = (sweepId: string, label: string) => ({ sweepId, label, state: {}, include: true, structure: 's' });
  const b = buildsOf({ chain, sweeps: {}, tagged: [tag('a', '300/300 cold'), tag('b', '300/300 cold'), tag('c', '180/250')] });
  assert.deepEqual(b.map((x) => [x.label, x.sweepIds]), [['300/300 cold', ['a', 'b']], ['180/250', ['c']]]);
});

test('a cable-only project has no circuit model; anything else does (review focus 1)', () => {
  assert.equal(hasModel({ name: 'm', blocks: [{ id: 'coax', label: 'Cage coax', type: 'coax' }] }), false);
  assert.equal(hasModel({ name: 'm', blocks: [] }), false);
  assert.equal(hasModel(cdChain()), true);
  assert.equal(hasModel(ex.chain), true);
});

test('a build compares by its newest stamped sweep, else its last one', () => {
  const again = { ...ex.sweeps['o7-80-180-loop'], id: 'again', name: 'x_nanovna-sweep-1791933400391.s1p' };
  const twice = { ...ex, tagged: [...ex.tagged, { ...ex.tagged[4], sweepId: 'again', label: 'again' }], sweeps: { ...ex.sweeps, again } };
  const b = buildsOf(twice);
  assert.equal(buildSweep(twice, b[4])?.id, 'again');
  assert.equal(buildSweep(twice, b[0])?.id, 'o7-130-230');
  assert.equal(buildSweep({ sweeps: {} }, b[0]), undefined, 'a build whose sweeps are gone has nothing to compare');
});

test('removing a part keeps builds that differed in it apart, and says so (final review I3)', () => {
  const s = reducer(ex, { type: 'remove', id: 'ser' });
  const b = buildsOf(s);
  assert.equal(b.length, 5);
  const two = b.filter((x) => x.label.startsWith('100/200') || x.label.startsWith('80/200 ('));
  assert.deepEqual(two.map((x) => x.sweepIds), [['o7-100-200'], ['o7-80-200']]);
  assert.match(two[0].label, /parts no longer in this circuit/);
});

test('a build date is the local calendar date of its newest stamp (final review M2)', () => {
  const tz = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(dateText(Date.UTC(2026, 9, 9, 0, 2)), '2026-10-08', '20:02 EDT on 10-08 is 00:02 UTC on 10-09');
    assert.equal(dateText(null), 'date unknown');
  } finally {
    process.env.TZ = tz;
  }
});

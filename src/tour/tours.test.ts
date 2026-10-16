import assert from 'node:assert/strict';
import test from 'node:test';
import { newBlock } from '../app/chainEdit.ts';
import { type AppState, reducer } from '../app/state.ts';
import { LEVELS, type Level } from '../present/level.ts';
import { loadExampleState } from '../testutil.ts';
import { stepDone, stepsFor, tourById, toursFor } from './run.ts';
import { TOURS, type StepCtx, type TourId } from './tours.ts';

const ex = loadExampleState();
const ctx = (state: AppState, atStep: AppState, task: StepCtx['task'] = 'home', level: Level = 'builder', atTask: StepCtx['task'] = 'home'): StepCtx => ({ state, atStep, task, level, atTask });
const step = (tour: TourId, id: string, level: Level = 'builder') => {
  const s = stepsFor(tourById(tour), level).find((x) => x.id === id);
  assert.ok(s, `${tour}/${id} at ${level}`);
  return s;
};

test('every tour has steps at each level it is offered at; every step has plain text', () => {
  for (const t of TOURS) {
    for (const level of t.levels) {
      const steps = stepsFor(t, level);
      assert.ok(steps.length >= 3, `${t.id} at ${level}`);
      for (const s of steps) {
        assert.ok(s.text.length > 20, `${t.id}/${s.id} at ${level} has text`);
        assert.doesNotMatch(s.text, /\bAIT\b|variant|landing/, `${t.id}/${s.id} wording`);
        assert.doesNotMatch(s.text, /\d+(\.\d+)?\s?(Ω|kHz|nH)/, `${t.id}/${s.id} states no model result (impedance, drift room, inductance)`);
      }
    }
  }
});

test('the tour menu follows the level: rig history only at Engineer', () => {
  assert.deepEqual(toursFor('beginner').map((t) => t.id), ['newSweep', 'tryChange', 'safePower', 'newNetwork', 'pastBuilds']);
  assert.deepEqual(toursFor('builder').map((t) => t.id), ['newSweep', 'tryChange', 'safePower', 'newNetwork', 'pastBuilds']);
  assert.equal(toursFor('engineer').at(-1)?.id, 'rigHistory');
  for (const level of LEVELS) for (const t of toursFor(level)) assert.equal(stepsFor(t, level)[0].target, `tile-${t.id}`, 'each tour opens its task from Home');
});

test('steps resolve per level: the result is read where that level shows it; Builder-only steps drop at Beginner', () => {
  assert.equal(step('newSweep', 'verdict', 'beginner').target, 'verdict-card');
  assert.equal(step('newSweep', 'verdict', 'builder').target, 'target-box');
  assert.equal(step('newSweep', 'verdict', 'engineer').target, 'plots');
  const beginnerSafe = stepsFor(tourById('safePower'), 'beginner').map((s) => s.id);
  assert.ok(!beginnerSafe.includes('table') && !beginnerSafe.includes('flux'));
  assert.ok(stepsFor(tourById('safePower'), 'builder').some((s) => s.id === 'flux'));
});

test('state steps complete only after the user acts, never at the state they started from (review focus 4)', () => {
  const open = step('newSweep', 'open');
  assert.equal(stepDone(open, ctx(ex, ex, 'home')), false);
  assert.equal(stepDone(open, ctx(ex, ex, 'newSweep')), true);

  const pick = step('tryChange', 'pick');
  assert.equal(stepDone(pick, ctx(ex, ex, 'tryChange')), false);
  assert.equal(stepDone(pick, ctx(reducer(ex, { type: 'select', id: 'sh' }), ex, 'tryChange')), true);

  const change = step('tryChange', 'change');
  const picked = reducer(ex, { type: 'select', id: 'sh' });
  assert.equal(stepDone(change, ctx(picked, picked, 'tryChange')), false);
  assert.equal(stepDone(change, ctx(reducer(picked, { type: 'patchBlock', id: 'sh', patch: { customPf: 10 } }), picked, 'tryChange')), true);

  const power = step('safePower', 'power');
  assert.equal(stepDone(power, ctx(ex, ex, 'safePower')), false);
  assert.equal(stepDone(power, ctx(reducer(ex, { type: 'setPower', watts: 300 }), ex, 'safePower')), true);

  const sel = reducer(ex, { type: 'select', id: 'Ls' });
  const added = reducer(sel, { type: 'place', targetId: 'Ls', where: 'inline', block: newBlock(sel.chain, 'inductor') });
  assert.equal(stepDone(step('newNetwork', 'add'), ctx(sel, sel, 'newNetwork')), false);
  assert.equal(stepDone(step('newNetwork', 'add'), ctx(added, sel, 'newNetwork')), true);
  const moved = reducer(added, { type: 'move', id: added.selected as string, dir: -1 });
  assert.equal(stepDone(step('newNetwork', 'move'), ctx(added, added, 'newNetwork')), false);
  assert.equal(stepDone(step('newNetwork', 'move'), ctx(moved, added, 'newNetwork')), true);
  const removed = reducer(moved, { type: 'remove', id: moved.selected as string });
  assert.equal(stepDone(step('newNetwork', 'remove'), ctx(removed, moved, 'newNetwork')), true);

  assert.equal(stepDone(step('rigHistory', 'copy', 'engineer'), ctx(ex, ex, 'rigHistory', 'engineer')), false);
  assert.equal(stepDone(step('rigHistory', 'copy', 'engineer'), ctx(ex, ex, 'pastBuilds', 'engineer')), true);
  assert.equal(stepDone(step('newSweep', 'power'), ctx(ex, ex, 'newSweep')), false, 'look steps never complete on their own');
});

test('a blur that commits the same value is not a change; Back onto "Open the task" waits for the user (final review I2, M4)', () => {
  const picked = reducer(ex, { type: 'select', id: 'sh' });
  const same = reducer(picked, { type: 'patchBlock', id: 'sh', patch: { customPf: 0 } });
  assert.notEqual(same.chain, picked.chain, 'the reducer builds a new circuit object');
  assert.equal(stepDone(step('tryChange', 'change'), ctx(same, picked, 'tryChange')), false, 'but nothing changed');
  assert.equal(stepDone(step('newSweep', 'open'), ctx(ex, ex, 'newSweep', 'builder', 'newSweep')), false, 'already on the task when the step began');
  assert.equal(stepDone(step('rigHistory', 'copy', 'engineer'), ctx(ex, ex, 'pastBuilds', 'engineer', 'pastBuilds')), false);
});

test('the new-sweep tour carries on into the power check: one counter, no second "Open the task", unique steps (Matt 2026-10-15)', () => {
  const builder = stepsFor(tourById('newSweep'), 'builder');
  const i = builder.findIndex((s) => s.id === 'safe');
  assert.equal(builder[i + 1].target, 'power-input', 'after "Check it at full power" comes the planned-power step');
  assert.equal(builder.length, 8 + 4);
  assert.equal(stepsFor(tourById('newSweep'), 'beginner').length, 8 + 2, 'Builder-only power steps drop at Beginner');
  assert.equal(new Set(builder.map((s) => s.id)).size, builder.length);
  assert.ok(!builder.slice(1).some((s) => s.target?.startsWith('tile-')));
});

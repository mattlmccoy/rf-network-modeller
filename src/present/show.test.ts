import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { counts } from '../blocks/ht50.ts';
import { cx } from '../engine/complex.ts';
import { updateBlock } from '../chain/state.ts';
import { zFromGamma } from '../io/sweep.ts';
import { evaluateVariants } from '../app/evaluate.ts';
import { type ExampleManifest, exampleState } from '../app/example.ts';
import { evalGrid } from '../app/grid.ts';
import { ROOT } from '../testutil.ts';
import { noChangeNeeded } from './recs.ts';
import { shownResult } from './show.ts';
import { type Verdict, landingNearF0, verdictOf } from './verdict.ts';

const read = (p: string): string => readFileSync(new URL(p, ROOT), 'utf8');
const m = JSON.parse(read('public/examples/o7/o7.json')) as ExampleManifest;
const ex = exampleState(m, Object.fromEntries([m.capFree, ...m.sweeps.map((s) => s.file)].map((f) => [f, read(`public/examples/o7/${f}`)])));
const sw = ex.sweeps['o7-80-180-loop'];
const measured = verdictOf(landingNearF0(sw.f, sw.gamma.map((g) => zFromGamma(g)), ex.window), ex.window);
const model = evaluateVariants(ex, evalGrid(ex.chain, ex.sweeps)).map((r) => verdictOf(r.landing, ex.window));

test('the measured verdict shows while the circuit is the build the active sweep was taken on (spec §7.4)', () => {
  const s = shownResult(ex, model, measured);
  assert.deepEqual([s.source, s.v.state], ['measured', 'little']);
});

test('a changed circuit shows the model majority, labelled predicted', () => {
  const s = shownResult({ ...ex, chain: updateBlock(ex.chain, 'ser', { counts: counts(2, 0, 0) }) }, model, measured);
  assert.equal(s.source, 'predicted');
  assert.equal(s.c?.state, s.v.state);
});

test('"No change needed" follows the shown verdict: measured outside beats a model that says plenty (review I3)', () => {
  const out: Verdict = { state: 'outside', z: cx(5.03, 4.3), roomUp: null, off: ['xLow'] };
  const plenty: Verdict = { state: 'plenty', z: cx(10, 20), roomUp: 3, off: [] };
  const s = shownResult(ex, [plenty, plenty, plenty], out);
  assert.equal(s.v.state, 'outside');
  assert.equal(noChangeNeeded(s.v.state, 50), false);
});

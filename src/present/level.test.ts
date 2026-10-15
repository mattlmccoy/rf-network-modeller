import assert from 'node:assert/strict';
import test from 'node:test';
import { cdChain, o7Chain } from '../chain/presets.ts';
import { findBlock } from '../chain/state.ts';
import { LEVELS, PROFILES, parseLevel } from './level.ts';
import { WORDS, wrapWords } from './words.ts';

test('each level sets the drawing, the result view and the field set (spec §5)', () => {
  assert.deepEqual(LEVELS, ['beginner', 'builder', 'engineer']);
  assert.deepEqual([PROFILES.beginner.drawing, PROFILES.builder.drawing, PROFILES.engineer.drawing], ['flow', 'hardware', 'schematic']);
  assert.deepEqual([PROFILES.beginner.result, PROFILES.builder.result, PROFILES.engineer.result], ['verdict', 'target', 'plots']);
  assert.deepEqual([PROFILES.beginner.fields, PROFILES.builder.fields, PROFILES.engineer.fields], ['stock', 'physical', 'all']);
  assert.equal(PROFILES.beginner.showOhms, false);
  assert.ok(PROFILES.engineer.nameAssumptions && !PROFILES.builder.nameAssumptions);
  assert.deepEqual(PROFILES.beginner.sheets, ['parts']);
  assert.deepEqual(PROFILES.builder.sheets, ['parts', 'sweeps']);
});

test('a missing or unknown stored level falls back to Builder', () => {
  assert.equal(parseLevel(null), 'builder');
  assert.equal(parseLevel('wizard'), 'builder');
  assert.equal(parseLevel('engineer'), 'engineer');
});

test('screen words carry none of the internal jargon (spec §11)', () => {
  for (const w of Object.values(WORDS)) assert.doesNotMatch(w, /AIT|variant|landing/i);
});

test('preset parts carry plain names', () => {
  const o7 = o7Chain('capfree');
  assert.equal(findBlock(o7, 'Ls')?.label, 'Wiring inductance');
  assert.equal(findBlock(o7, 'Lb')?.label, 'Loop inductance');
  assert.equal(findBlock(o7, 'branch')?.label, 'Transformer pair + plates');
  assert.equal(findBlock(cdChain(), 'Ls')?.label, 'Wiring inductance');
  assert.equal(findBlock(cdChain(), 'Lb')?.label, 'Loop inductance');
});

test('wrapWords packs words into lines of at most the given length; a long single word stays whole', () => {
  assert.deepEqual(wrapWords('Transformer pair + plates', 16), ['Transformer pair', '+ plates']);
  assert.deepEqual(wrapWords('1×100 + 1×50 + 1×30 = 180 pF', 20), ['1×100 + 1×50 + 1×30', '= 180 pF']);
  assert.deepEqual(wrapWords('Supercalifragilistic', 8), ['Supercalifragilistic']);
  assert.deepEqual(wrapWords('', 8), ['']);
});

test('no text drawn on a canvas uses internal jargon; page-text checks cannot see it (review I6)', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { ROOT } = await import('../testutil.ts');
  const dir = new URL('src/ui/', ROOT);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/fillText\(\s*(['`])(.*?)\1/g)) {
      assert.doesNotMatch(m[2], /AIT|variant|landing/i, `${f}: "${m[2]}"`);
    }
  }
});

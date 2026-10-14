import assert from 'node:assert/strict';
import test from 'node:test';
import { cx } from '../src/engine/complex.ts';
import { type ReplayResult, type ReplayRow, gateOk, renderReport, replayPasses } from './replay.ts';

const row = (ts: [number, number], py: [number, number]): ReplayRow => ({ variant: '1.245 m + 342 nH', step: '80/200 predicted from 130/230 + 100/200', ts: cx(...ts), python: cx(...py), measured: cx(5.03, 4.3) });

test('the gate allows ±0.5 Ω in both R and X and nothing more', () => {
  assert.equal(gateOk(row([6.6, 12.6], [6.64, 12.59]), 0.5), true);
  assert.equal(gateOk(row([7.2, 12.6], [6.6, 12.6]), 0.5), false);
  assert.equal(gateOk(row([6.6, 13.2], [6.6, 12.6]), 0.5), false);
});

test('the report states the gate result and labels what is reported, not gated', () => {
  const r: ReplayResult = {
    tolOhm: 0.5,
    rows: [row([6.6, 12.6], [6.64, 12.59]), row([7.2, 12.6], [6.6, 12.6])],
    cd: { ts: cx(10, 20), python: cx(10, 20), measured: cx(12, 25), f: 13.5622e6 },
    shorts: [{ length: 1.245, tsNh: 344, pythonNh: 344, recordedNh: 342 }],
  };
  assert.equal(replayPasses(r), false);
  const md = renderReport(r, '2026-10-14');
  assert.match(md, /Result: \*\*FAIL\*\*/);
  assert.match(md, /\| PASS \|/);
  assert.match(md, /\| FAIL \|/);
  assert.match(md, /reported, not gated/i);
  assert.match(md, /2026-10-14/);
});

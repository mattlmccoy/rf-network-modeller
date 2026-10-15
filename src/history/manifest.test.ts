import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseS1p } from '../io/s1p.ts';
import { ROOT } from '../testutil.ts';
import { type ManifestSession, csvKind, csvToS1p, parseIndex, planSession, sameS11, sessionOrder, validateManifest } from './manifest.ts';

const fx = (n: string): string => readFileSync(new URL(`fixtures/history/${n}`, ROOT), 'utf8');
const sweep = (file: string, over: object = {}) => ({ file, kind: 'network', series_pF: null, shunt_pF: null, loop: null, load: 'unknown', condition: null, label: file, evidence: 'file name', uncertain: null, csvFormat: file.endsWith('.csv') ? 'vna-export' : null, ...over });
const session = (sweeps: object[], over: object = {}): ManifestSession => ({ id: '2026-08-25', dir: '2026-08-25', date: '2026-08-25', title: 't', rig: { transformer: 'unknown', turns: 'unknown', cores: 'unknown', plates: 'unknown' }, evidence: 'file names only', modelPreset: null, sweeps, ...over }) as ManifestSession;
const manifest = (sessions: object[]) => ({ format: 'rfnm-history/1', source: 'MANUAL_MATCHING_NETWORK', sessions });

test('validateManifest accepts a curated session and names the session and file of a bad sweep', () => {
  assert.equal(validateManifest(manifest([session([sweep('a.s1p')])])).sessions.length, 1);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { kind: 'tuned' })])])), /2026-08-25.*a\.s1p.*kind/);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { evidence: '' })])])), /a\.s1p.*evidence/);
  assert.throws(() => validateManifest(manifest([session([sweep('a.s1p', { series_pF: '300' })])])), /a\.s1p.*series_pF/);
  assert.throws(() => validateManifest(manifest([session([]), session([])])), /duplicate session id 2026-08-25/);
  assert.throws(() => validateManifest({ format: 'x', sessions: [] }), /format/);
});

test('sessions run newest first, undated last', () => {
  const order = sessionOrder([{ id: 'a', date: '2026-08-25' }, { id: 'root', date: null }, { id: 'b', date: '2026-10-13' }]);
  assert.deepEqual(order.map((s) => s.id), ['b', 'a', 'root']);
});

test('CSV kinds come from the header of captured real files (review focus 4)', () => {
  assert.equal(csvKind(fx('vna-export-header.csv')), 'vna-export');
  assert.equal(csvKind(fx('vna-export-plain.csv')), 'vna-export');
  assert.equal(csvKind(fx('telemetry.csv')), 'telemetry');
  assert.equal(csvKind(fx('table.csv')), 'table');
});

test('a VNA export converts to an S11-only .s1p with its numbers copied verbatim', () => {
  const out = csvToS1p(fx('vna-export-header.csv'), 'x.csv');
  assert.match(out, /^! S11 from x\.csv/);
  assert.match(out, /^# HZ S RI R 50$/m);
  assert.match(out, /^10000000 -0\.35031968 0\.882837888$/m);
  const t = parseS1p(out);
  assert.equal(t.f.length, 3);
  assert.ok(sameS11(t, parseS1p(csvToS1p(fx('vna-export-header.csv'), 'y.csv'))));
  assert.ok(!sameS11(t, parseS1p(csvToS1p(fx('vna-export-plain.csv'), 'z.csv'))));
});

test('the import plan keeps Touchstone files, collapses identical copies, converts new CSV sweeps and skips the rest with reasons', () => {
  const csv = fx('vna-export-header.csv');
  const s1p = csvToS1p(fx('vna-export-plain.csv'), 'p.csv');
  const s = session([
    sweep('a_nanovna-sweep-1787693115696.s1p'),
    sweep('00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p', { label: 'duplicate' }),
    sweep('a_nanovna-sweep-1787693115696.csv'),
    sweep('b_nanovna-sweep-1787696761263.csv'),
    sweep('b-again.txt'),
    sweep('fullcyl_T1', { kind: 'network+tuner' }),
    sweep('power_telemetry.csv', { csvFormat: 'telemetry', kind: 'other' }),
    sweep('gone.s1p'),
  ]);
  const p = planSession(s, {
    'a_nanovna-sweep-1787693115696.s1p': s1p,
    '00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p': s1p,
    'a_nanovna-sweep-1787693115696.csv': fx('vna-export-plain.csv'),
    'b_nanovna-sweep-1787696761263.csv': csv,
    'b-again.txt': csv.replace('# Device: 1.2.44\n', ''),
    fullcyl_T1: csvToS1p(csv, 'c.csv'),
    'power_telemetry.csv': fx('telemetry.csv'),
  });
  assert.deepEqual(p.session.sweeps.map((w) => [w.path, w.converted, w.sources.length]), [
    ['2026-08-25/a_nanovna-sweep-1787693115696.s1p', false, 2],
    ['2026-08-25/fullcyl_T1.s1p', false, 1],
  ]);
  assert.deepEqual(p.session.sweeps[0].sources, ['2026-08-25/a_nanovna-sweep-1787693115696.s1p', '2026-08-25/00_ORIGINAL_EXPORTS/a_nanovna-sweep-1787693115696.s1p']);
  assert.deepEqual(p.files.map((f) => f.path), p.session.sweeps.map((w) => w.path));
  assert.deepEqual(p.session.skipped.map((k) => [k.file, k.reason]), [
    ['gone.s1p', 'missing from the source folder'],
    ['a_nanovna-sweep-1787693115696.csv', 'same data as a_nanovna-sweep-1787693115696.s1p'],
    ['b_nanovna-sweep-1787696761263.csv', 'same data as fullcyl_T1'],
    ['b-again.txt', 'same data as fullcyl_T1'],
    ['power_telemetry.csv', 'generator or scope telemetry, not a sweep'],
  ]);
});

test('a CSV sweep with new data is converted; one save stamp shared by different data keeps both (real 08-25 case)', () => {
  const p = planSession(session([
    sweep('mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p'),
    sweep('mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p'),
    sweep('x.txt'),
  ]), {
    'mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p': csvToS1p(fx('vna-export-plain.csv'), 'p.csv'),
    'mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p': csvToS1p(fx('vna-export-header.csv'), 'h.csv'),
    'x.txt': fx('vna-export-plain.csv').replace('-0.381344608', '-0.381'),
  });
  assert.deepEqual(p.session.sweeps.map((w) => [w.path, w.converted]), [
    ['2026-08-25/mounted_trans_direct_no_electrodes_nanovna-sweep-1787680737283.s1p', false],
    ['2026-08-25/mounted_trans_no_electrodes_nanovna-sweep-1787680737283.s1p', false],
    ['2026-08-25/x.s1p', true],
  ]);
  assert.deepEqual(p.session.skipped, []);
});

test('the undated root session reads its files from the folder root', () => {
  const p = planSession(session([sweep('IN-BOX_BASELINE_nocap_PLA.s1p', { kind: 'other' })], { id: 'undated-root', dir: '', date: null }), { 'IN-BOX_BASELINE_nocap_PLA.s1p': csvToS1p(fx('vna-export-plain.csv'), 'p.csv') });
  assert.deepEqual(p.session.sweeps[0].sources, ['IN-BOX_BASELINE_nocap_PLA.s1p']);
  assert.equal(p.session.sweeps[0].path, 'undated-root/IN-BOX_BASELINE_nocap_PLA.s1p');
});

test('parseIndex reads the importer output and rejects anything else', () => {
  assert.equal(parseIndex(JSON.stringify({ format: 'rfnm-history-index/1', source: 's', sessions: [] })).sessions.length, 0);
  assert.throws(() => parseIndex('{"format":"rfnm/1"}'), /expected format/);
  assert.throws(() => parseIndex('<html>'), /expected format/);
});

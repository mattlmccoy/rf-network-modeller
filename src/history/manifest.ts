import { type Touchstone, parseS1p } from '../io/s1p.ts';

export type SweepKind = 'network' | 'network+tuner' | 'branch' | 'calibration' | 'short' | 'other';
export type LoadKind = 'cube' | 'electrodes' | 'none' | 'unknown';
export interface Rig { transformer: string; turns: string; cores: string; plates: string }
export interface ManifestSweep { file: string; kind: SweepKind; series_pF: number | null; shunt_pF: number | null; loop: boolean | null; load: LoadKind; condition: string | null; label: string; evidence: string; uncertain: string | null; csvFormat: 'vna-export' | 'telemetry' | 'table' | null }
export interface ManifestSession { id: string; dir: string; date: string | null; title: string; rig: Rig; evidence: string; modelPreset: 'o7' | 'cd' | null; sweeps: ManifestSweep[] }
export interface Manifest { format: 'rfnm-history/1'; source: string; sessions: ManifestSession[] }
export interface IndexSweep extends Omit<ManifestSweep, 'file' | 'csvFormat'> { path: string; sources: string[]; converted: boolean }
export interface Skipped { file: string; reason: string }
export interface IndexSession extends Omit<ManifestSession, 'dir' | 'sweeps'> { sweeps: IndexSweep[]; skipped: Skipped[] }
export interface HistoryIndex { format: 'rfnm-history-index/1'; source: string; sessions: IndexSession[] }
export interface PlannedSession { session: IndexSession; files: { path: string; text: string }[] }

const KINDS: readonly SweepKind[] = ['network', 'network+tuner', 'branch', 'calibration', 'short', 'other'];
const LOADS: readonly LoadKind[] = ['cube', 'electrodes', 'none', 'unknown'];
const CSV_FORMATS = ['vna-export', 'telemetry', 'table', null];

type J = Record<string, unknown>;
const isObj = (v: unknown): v is J => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown): boolean => v === null || str(v);
const numOrNull = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v));

function check(ok: boolean, where: string, problem: string): asserts ok {
  if (!ok) throw new Error(`manifest: ${where}: ${problem}`);
}

/** Validates the curated manifest (spec §10): every field present and of its type, every sweep with evidence. */
export function validateManifest(x: unknown): Manifest {
  check(isObj(x) && x.format === 'rfnm-history/1', 'top level', 'format must be rfnm-history/1');
  check(str(x.source) && Array.isArray(x.sessions), 'top level', 'needs source and sessions');
  const ids = new Set<string>();
  for (const s of x.sessions as unknown[]) {
    check(isObj(s) && str(s.id) && s.id !== '', 'session', 'needs an id');
    const at = `session ${s.id}`;
    check(!ids.has(s.id), at, `duplicate session id ${s.id}`);
    ids.add(s.id);
    check(str(s.dir), at, 'dir must be text');
    check(s.date === null || (str(s.date) && /^\d{4}-\d{2}-\d{2}$/.test(s.date)), at, 'date must be YYYY-MM-DD or null');
    check(str(s.title) && str(s.evidence) && s.evidence !== '', at, 'needs a title and evidence');
    check(isObj(s.rig) && ['transformer', 'turns', 'cores', 'plates'].every((k) => str((s.rig as J)[k])), at, 'rig needs transformer, turns, cores and plates as text');
    check(s.modelPreset === null || s.modelPreset === 'o7' || s.modelPreset === 'cd', at, 'modelPreset must be o7, cd or null');
    check(Array.isArray(s.sweeps), at, 'needs sweeps');
    for (const w of s.sweeps as unknown[]) {
      check(isObj(w) && str(w.file) && w.file !== '', at, 'a sweep needs a file');
      const wa = `${at} sweep ${w.file}`;
      check(KINDS.includes(w.kind as SweepKind), wa, `kind must be one of ${KINDS.join(', ')}`);
      check(numOrNull(w.series_pF), wa, 'series_pF must be a number or null');
      check(numOrNull(w.shunt_pF), wa, 'shunt_pF must be a number or null');
      check(w.loop === null || typeof w.loop === 'boolean', wa, 'loop must be true, false or null');
      check(LOADS.includes(w.load as LoadKind), wa, `load must be one of ${LOADS.join(', ')}`);
      check(strOrNull(w.condition) && strOrNull(w.uncertain), wa, 'condition and uncertain must be text or null');
      check(str(w.label) && w.label !== '', wa, 'needs a label');
      check(str(w.evidence) && w.evidence !== '', wa, 'needs evidence');
      check(CSV_FORMATS.includes(w.csvFormat as string | null), wa, 'csvFormat must be vna-export, telemetry, table or null');
    }
  }
  return x as unknown as Manifest;
}

/** Newest first; undated sessions last (spec §10). */
export const sessionOrder = <T extends { id: string; date: string | null }>(s: readonly T[]): T[] =>
  [...s].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date === null ? 1 : b.date === null ? -1 : b.date.localeCompare(a.date)));

/** The first row that is not blank or a comment ('#' in VNA exports, '!' in Touchstone), split on commas. */
const headerOf = (text: string): string[] => (text.split(/\r?\n/).find((l) => l.trim() !== '' && !/^\s*[#!]/.test(l)) ?? '').split(',').map((c) => c.trim());

/** A CSV's kind from its header row: a NanoVNA web export, generator or scope telemetry, or an analysis table. */
export function csvKind(text: string): 'vna-export' | 'telemetry' | 'table' {
  const h = headerOf(text);
  if (['frequency_hz', 's11_real', 's11_imag'].every((c) => h.includes(c))) return 'vna-export';
  return h[0] === 'host_timestamp_ns' ? 'telemetry' : 'table';
}

/** A VNA export as an S11-only Touchstone 1.x file; the numbers are copied as written, never reformatted. */
export function csvToS1p(text: string, name: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '' && !l.startsWith('#'));
  const h = lines[0].split(',').map((c) => c.trim());
  const [fi, ri, ii] = ['frequency_hz', 's11_real', 's11_imag'].map((c) => h.indexOf(c));
  const rows = lines.slice(1).map((l) => {
    const c = l.split(',');
    return `${c[fi].trim()} ${c[ri].trim()} ${c[ii].trim()}`;
  });
  return [`! S11 from ${name}, converted by the rf-network-modeller history importer`, '# HZ S RI R 50', ...rows, ''].join('\n');
}

/** Same frequencies and the same reflection to 1e-6: one sweep saved twice. */
export const sameS11 = (a: Touchstone, b: Touchstone): boolean =>
  a.f.length === b.f.length && a.f.every((f, i) => Math.abs(f - b.f[i]) < 1e-3 && Math.abs(a.gamma[i].re - b.gamma[i].re) < 1e-6 && Math.abs(a.gamma[i].im - b.gamma[i].im) < 1e-6);

const SKIP_CSV: Record<'telemetry' | 'table', string> = { telemetry: 'generator or scope telemetry, not a sweep', table: 'an analysis table, not a sweep' };
const baseName = (p: string): string => p.slice(p.lastIndexOf('/') + 1);
const asS1p = (f: string): string => `${f.replace(/\.(csv|txt|s1p)$/i, '')}.s1p`;

/**
 * What one session imports (spec §10). A file is a CSV when its header row is comma-separated, whatever its extension
 * (some sweeps are .txt or have none). Touchstone files come first, then VNA-export CSVs whose data no kept file holds:
 * a shared save stamp is not proof of the same sweep (three 08-25 files share one with different data). Identical copies
 * collapse to one sweep listing every source; every skip has its reason.
 */
export function planSession(s: ManifestSession, texts: Record<string, string | undefined>): PlannedSession {
  const src = (file: string): string => (s.dir ? `${s.dir}/${file}` : file);
  const kept: { w: IndexSweep; raw: string; text: string; t: Touchstone; file: string }[] = [];
  const skipped: Skipped[] = [];
  const read = s.sweeps.map((m) => ({ m, raw: texts[m.file] }));
  for (const { m } of read.filter((r) => r.raw === undefined)) skipped.push({ file: m.file, reason: 'missing from the source folder' });
  const present = read.filter((r): r is { m: ManifestSweep; raw: string } => r.raw !== undefined).map((r) => ({ ...r, csv: headerOf(r.raw).length > 1 }));
  for (const { m, raw, csv } of [...present.filter((r) => !r.csv), ...present.filter((r) => r.csv)]) {
    const ck = csv ? csvKind(raw) : 'vna-export';
    if (ck !== 'vna-export') {
      skipped.push({ file: m.file, reason: SKIP_CSV[ck] });
      continue;
    }
    const twin = kept.find((k) => k.raw === raw);
    if (twin) {
      twin.w.sources.push(src(m.file));
      continue;
    }
    const text = csv ? csvToS1p(raw, baseName(m.file)) : raw;
    let t: Touchstone;
    try {
      t = parseS1p(text);
    } catch (e) {
      skipped.push({ file: m.file, reason: `unreadable: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const same = csv ? kept.find((k) => sameS11(k.t, t)) : undefined;
    if (same) {
      skipped.push({ file: m.file, reason: `same data as ${same.file}` });
      continue;
    }
    let path = `${s.id}/${asS1p(m.file)}`;
    for (let n = 2; kept.some((k) => k.w.path === path); n += 1) path = `${s.id}/${asS1p(m.file).replace(/\.s1p$/, `-${n}.s1p`)}`;
    const { file: _f, csvFormat: _c, ...meta } = m;
    kept.push({ w: { ...meta, path, sources: [src(m.file)], converted: csv }, raw, text, t, file: m.file });
  }
  const { dir: _d, sweeps: _s, ...head } = s;
  return { session: { ...head, sweeps: kept.map((k) => k.w), skipped }, files: kept.map((k) => ({ path: k.w.path, text: k.text })) };
}

/** The importer's index, or an error saying it is not one (never an empty history). */
export function parseIndex(text: string): HistoryIndex {
  try {
    const x = JSON.parse(text) as unknown;
    if (isObj(x) && x.format === 'rfnm-history-index/1' && Array.isArray(x.sessions)) return x as unknown as HistoryIndex;
  } catch {
    // fall through to the format error
  }
  throw new Error("the rig history file isn't in the expected format");
}

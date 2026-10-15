import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type HistoryIndex, planSession, sessionOrder, validateManifest } from '../../src/history/manifest.ts';

/** Builds public/history/ from history/manifest.json and the read-only source folder (spec §10). */
const source = process.argv[2];
if (!source) throw new Error('usage: npm run history -- <path to MANUAL_MATCHING_NETWORK>');
const root = new URL('../../', import.meta.url).pathname;
const manifest = validateManifest(JSON.parse(readFileSync(join(root, 'history/manifest.json'), 'utf8')));
const out = join(root, 'public/history');
rmSync(out, { recursive: true, force: true });

const read = (p: string): string | undefined => {
  try {
    return readFileSync(join(source, p), 'utf8');
  } catch {
    return undefined;
  }
};
const index: HistoryIndex = { format: 'rfnm-history-index/1', source: manifest.source, sessions: [] };
let files = 0;
for (const s of sessionOrder(manifest.sessions)) {
  const p = planSession(s, Object.fromEntries(s.sweeps.map((w) => [w.file, read(s.dir ? `${s.dir}/${w.file}` : w.file)])));
  for (const f of p.files) {
    mkdirSync(dirname(join(out, 'files', f.path)), { recursive: true });
    writeFileSync(join(out, 'files', f.path), f.text);
  }
  files += p.files.length;
  index.sessions.push(p.session);
}
writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

// Coverage: every sweep-like file in the source folder should be listed in the manifest.
const listed = new Set(manifest.sessions.flatMap((s) => s.sweeps.map((w) => (s.dir ? `${s.dir}/${w.file}` : w.file))));
const walk = (d: string): string[] => readdirSync(join(source, d)).flatMap((n) => {
  const rel = d ? `${d}/${n}` : n;
  return statSync(join(source, rel)).isDirectory() ? walk(rel) : [rel];
});
const unlisted = walk('').filter((p) => /\.s1p$/i.test(p) || /sweep[^/]*\.csv$/i.test(p)).filter((p) => !listed.has(p));
const skipped = index.sessions.flatMap((s) => s.skipped);
const reasons = new Map<string, number>();
for (const k of skipped) reasons.set(k.reason.replace(/ as .*| \(.*/, ''), (reasons.get(k.reason.replace(/ as .*| \(.*/, '')) ?? 0) + 1);
const sweeps = index.sessions.flatMap((s) => s.sweeps);
console.log(`${index.sessions.length} sessions; ${files} sweep files written (${sweeps.filter((w) => w.converted).length} converted from CSV; ${sweeps.reduce((n, w) => n + w.sources.length - 1, 0)} identical copies collapsed)`);
console.log(`skipped ${skipped.length}:`, Object.fromEntries(reasons));
console.log(`files in the source folder not in the manifest: ${unlisted.length}`, unlisted.slice(0, 10));

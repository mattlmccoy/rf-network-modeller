import { mkdirSync, writeFileSync } from 'node:fs';
import { renderReport, replayPasses, runReplay } from './replay.ts';

const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const root = new URL('../', import.meta.url);
const result = runReplay(root);
const md = renderReport(result, date);
mkdirSync(new URL('docs/validation/', root), { recursive: true });
const out = new URL(`docs/validation/${date}-validation.md`, root);
writeFileSync(out, md);
console.log(md);
console.log(`wrote ${out.pathname}`);
process.exit(replayPasses(result) ? 0 : 1);

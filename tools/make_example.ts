import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ExampleManifest } from '../src/app/example.ts';
import type { TModel } from '../src/app/state.ts';
import { DEFAULT_VARIANTS, O7_FILES } from '../src/chain/presets.ts';

/** Builds public/examples/o7/ from the fixtures: six sweeps (copied byte for byte) and the Python fits. */
const root = new URL('../', import.meta.url);
const out = new URL('public/examples/o7/', root);
mkdirSync(out, { recursive: true });
const fx = JSON.parse(readFileSync(new URL('fixtures/python/o7_fit.json', root), 'utf8')) as { variants: { length: number; fit3: { x: number[] }; loop: { q: number } }[] };
if (fx.variants.length !== DEFAULT_VARIANTS.length || fx.variants.some((v, i) => v.length !== DEFAULT_VARIANTS[i].cable.length)) {
  throw new Error('o7_fit.json variants do not match DEFAULT_VARIANTS');
}
const files: [string, string][] = [
  ['capfree.s1p', O7_FILES.capFree],
  ['130-230.s1p', O7_FILES.s130_230],
  ['100-200.s1p', O7_FILES.s100_200],
  ['80-200.s1p', O7_FILES.s80_200],
  ['80-200-loop.s1p', O7_FILES.s80_200_loop],
  ['80-180-loop.s1p', O7_FILES.s80_180_loop],
];
for (const [dst, src] of files) copyFileSync(new URL(`fixtures/sweeps/${src}`, root), new URL(dst, out));
const manifest: ExampleManifest = {
  name: 'O7 parallel 3:15 (2026-10-13 sweeps)',
  capFree: 'capfree.s1p',
  sweeps: [
    { id: 'o7-130-230', file: '130-230.s1p', label: '130/230', series: [1, 0, 1], shunt: [2, 0, 1], loop: false },
    { id: 'o7-100-200', file: '100-200.s1p', label: '100/200', series: [1, 0, 0], shunt: [2, 0, 0], loop: false },
    { id: 'o7-80-200', file: '80-200.s1p', label: '80/200', series: [0, 1, 1], shunt: [2, 0, 0], loop: false },
    { id: 'o7-80-200-loop', file: '80-200-loop.s1p', label: '80/200 + loop', series: [0, 1, 1], shunt: [2, 0, 0], loop: true },
    { id: 'o7-80-180-loop', file: '80-180-loop.s1p', label: '80/180 + loop', series: [0, 1, 1], shunt: [1, 1, 1], loop: true },
  ],
  fits: fx.variants.map((v, i) => ({
    variant: DEFAULT_VARIANTS[i].name,
    x: v.fit3.x,
    q: v.loop.q,
    source: '3-sweep fit + loop shift (o7_loopstate.py recipe, Python), captured by tools/capture_fixtures.py',
  })),
};
const tm = JSON.parse(readFileSync(new URL('fixtures/python/tmodel_short.json', root), 'utf8')).tmodel as { variant: string; unit: TModel['unit']; load: TModel['load']; rms_rel: number };
if (Number(tm.variant) !== DEFAULT_VARIANTS[0].cable.length) throw new Error('tmodel_short.json was not fitted for the first cable assumption');
manifest.tmodel = { variant: DEFAULT_VARIANTS[0].name, unit: tm.unit, load: tm.load, rmsRel: tm.rms_rel };
writeFileSync(new URL('o7.json', out), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`wrote ${files.length} sweeps and o7.json to ${out.pathname}`);

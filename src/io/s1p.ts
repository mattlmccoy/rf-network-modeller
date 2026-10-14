import { type Complex, cx } from '../engine/complex.ts';

/** A one-port Touchstone sweep: frequencies [Hz] and S11. */
export interface Touchstone {
  f: number[];
  gamma: Complex[];
}

function pairOf(a: number, b: number, format: string): Complex {
  if (format === 'MA') {
    const t = (b * Math.PI) / 180;
    return cx(a * Math.cos(t), a * Math.sin(t));
  }
  if (format === 'DB') {
    const m = 10 ** (a / 20);
    const t = (b * Math.PI) / 180;
    return cx(m * Math.cos(t), m * Math.sin(t));
  }
  return cx(a, b);
}

/** Parses a Touchstone 1.x .s1p file (adapted from nanovna-web src/lib/files.ts parseTouchstone). */
export function parseS1p(text: string): Touchstone {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/!.*/, '').trim()).filter(Boolean);
  if (lines.some((line) => line.startsWith('['))) throw new Error('Touchstone 2.0 keyword files are not supported; export as Touchstone 1.x.');
  const option = lines.find((line) => line.startsWith('#'))?.toUpperCase().split(/\s+/) ?? ['#', 'GHZ', 'S', 'MA', 'R', '50'];
  const unit = option[1] ?? 'GHZ';
  const parameter = option[2] ?? 'S';
  const format = option[3] ?? 'MA';
  if (parameter !== 'S') throw new Error('Only Touchstone S-parameter files are supported.');
  if (!['RI', 'MA', 'DB'].includes(format)) throw new Error(`Unsupported Touchstone format: ${format}`);
  const ri = option.indexOf('R');
  const reference = ri >= 0 ? Number(option[ri + 1]) : 50;
  if (!Number.isFinite(reference) || Math.abs(reference - 50) > 1e-9) {
    throw new Error(`Only 50 Ω reference impedance is supported; this file declares ${reference} Ω.`);
  }
  const factor = ({ HZ: 1, KHZ: 1e3, MHZ: 1e6, GHZ: 1e9 } as Record<string, number>)[unit];
  if (!factor) throw new Error(`Unsupported Touchstone frequency unit: ${unit}`);
  const values = lines.filter((line) => !line.startsWith('#')).flatMap((line) => line.split(/\s+/)).map(Number);
  if (values.some((v) => !Number.isFinite(v))) throw new Error('Touchstone data contain a non-numeric token.');
  if (values.length % 3 !== 0) throw new Error('Touchstone data end with an incomplete 1-port record.');
  const f: number[] = [];
  const gamma: Complex[] = [];
  for (let i = 0; i < values.length; i += 3) {
    f.push(values[i] * factor);
    gamma.push(pairOf(values[i + 1], values[i + 2], format));
  }
  if (!f.length) throw new Error('No S-parameter rows were found.');
  for (let i = 1; i < f.length; i += 1) {
    if (f[i] <= f[i - 1]) throw new Error('Frequencies must be strictly increasing without duplicates.');
  }
  return { f, gamma };
}

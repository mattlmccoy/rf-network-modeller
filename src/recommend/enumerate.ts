import { type BankParts, type Counts, CAP_VALUES, counts, physicalParts, sumCounts } from '../blocks/ht50.ts';

/** Every non-empty parallel group of at most `slots` parts, in o7_joint.py combos() order (100 pF outermost). */
export function bankCombos(slots: number): Counts[] {
  const out: Counts[] = [];
  for (let a = 0; a <= slots; a += 1) {
    for (let b = 0; b <= slots; b += 1) {
      for (let c = 0; c <= slots; c += 1) {
        const n = a + b + c;
        if (n > 0 && n <= slots) out.push(counts(a, b, c));
      }
    }
  }
  return out;
}

export type Pick = BankParts;
export interface Candidate { picks: Record<string, Pick> }
export interface BankSpec { id: string; slots: number }

/** Cartesian product over the searched banks (first bank outermost) within the stock left after the reserved parts. */
export function candidates(banks: BankSpec[], stock: Counts, reserved: Counts, allowSeriesPairs = false): Candidate[] {
  const options = banks.map((b) => [
    ...bankCombos(b.slots).map((c): Pick => ({ counts: c, nSeries: 1 })),
    ...(allowSeriesPairs ? bankCombos(Math.floor(b.slots / 2)).map((c): Pick => ({ counts: c, nSeries: 2 })) : []),
  ]);
  const out: Candidate[] = [];
  const rec = (k: number, acc: Record<string, Pick>): void => {
    if (k === banks.length) {
      const used = sumCounts([reserved, ...Object.values(acc).map(physicalParts)]);
      if (CAP_VALUES.every((v) => used[v] <= stock[v])) out.push({ picks: { ...acc } });
      return;
    }
    for (const p of options[k]) rec(k + 1, { ...acc, [banks[k].id]: p });
  };
  rec(0, {});
  return out;
}

/** Parts removed plus parts added, summed over the picked banks (o7_joint.py "moves"). */
export function moveCount(current: Record<string, Pick>, pick: Record<string, Pick>): number {
  return Object.keys(pick).reduce((sum, id) => {
    const a = physicalParts(pick[id]);
    const b = physicalParts(current[id]);
    return sum + CAP_VALUES.reduce((s, v) => s + Math.abs(a[v] - b[v]), 0);
  }, 0);
}

/** Plain-language moves per bank, e.g. "Shunt bank: remove 1×100; add 1×50 + 1×30" (spec §9). */
export function describeMoves(labels: Record<string, string>, current: Record<string, Pick>, pick: Record<string, Pick>): string[] {
  return Object.keys(pick).map((id) => {
    const a = physicalParts(pick[id]);
    const b = physicalParts(current[id]);
    const rm = CAP_VALUES.filter((v) => b[v] > a[v]).map((v) => `${b[v] - a[v]}×${v}`);
    const ad = CAP_VALUES.filter((v) => a[v] > b[v]).map((v) => `${a[v] - b[v]}×${v}`);
    const rewire = pick[id].nSeries !== current[id].nSeries ? `; rewire as ${pick[id].nSeries === 2 ? 'two groups in series' : 'one group'}` : '';
    const name = labels[id] ?? id;
    if (!rm.length && !ad.length && !rewire) return `${name}: no change`;
    const parts = [rm.length ? `remove ${rm.join(' + ')}` : '', ad.length ? `add ${ad.join(' + ')}` : ''].filter(Boolean).join('; ');
    return `${name}: ${parts}${rewire}`;
  });
}

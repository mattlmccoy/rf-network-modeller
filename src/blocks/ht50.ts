/** HEC HT50 parts at 13.56 MHz (model/match.py HT50) and the stock on hand (pass5/stock/stock_net.py STOCK). */
export type CapValue = 100 | 50 | 30;
export const CAP_VALUES: readonly CapValue[] = [100, 50, 30];

export interface Rating {
  vRms: number;
  iRms: number;
}

export const HT50: Readonly<Record<CapValue, Rating>> = {
  100: { vRms: 1080, iRms: 9.2 },
  50: { vRms: 1530, iRms: 6.5 },
  30: { vRms: 1980, iRms: 5.1 },
};

export type Counts = Record<CapValue, number>;
export const counts = (n100 = 0, n50 = 0, n30 = 0): Counts => ({ 100: n100, 50: n50, 30: n30 });
export const DEFAULT_STOCK: Counts = counts(10, 3, 2);
export const countsPf = (c: Counts): number => 100 * c[100] + 50 * c[50] + 30 * c[30];
export const partTotal = (c: Counts): number => c[100] + c[50] + c[30];

/** A bank's parts: one parallel group, or two identical groups in series. */
export interface BankParts {
  counts: Counts;
  nSeries: 1 | 2;
}

export const physicalParts = (b: BankParts): Counts =>
  counts(b.counts[100] * b.nSeries, b.counts[50] * b.nSeries, b.counts[30] * b.nSeries);
export const sumCounts = (list: Counts[]): Counts =>
  list.reduce((a, c) => counts(a[100] + c[100], a[50] + c[50], a[30] + c[30]), counts());
export const stockLeft = (stock: Counts, used: Counts): Counts =>
  counts(stock[100] - used[100], stock[50] - used[50], stock[30] - used[30]);
export const overdrawn = (left: Counts): CapValue[] => CAP_VALUES.filter((v) => left[v] < 0);

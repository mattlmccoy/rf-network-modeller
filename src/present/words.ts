/** Plain names for internal terms; every view takes its wording from here (spec §11). */
export const WORDS = {
  window: 'what the tuner can match',
  landing: 'where the tuner lands',
  atTuner: 'at the tuner',
  assumption: 'cable assumption',
  measuredPart: 'measured part',
  room: 'room to drift',
} as const;

/** Tooltips for the acronyms that stay on screen. */
export const ACRONYMS: Readonly<Record<string, string>> = {
  VNA: 'Vector network analyzer: the instrument that measures the sweep',
  HT50: 'The high-voltage doorknob capacitors the banks are built from',
  S11: 'Reflection coefficient: how much power bounces back',
  VSWR: 'Voltage standing-wave ratio: 1 is a perfect match',
};

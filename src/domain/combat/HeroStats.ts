/** Converts a non-negative raw attribute with diminishing logarithmic returns. Raw 1 maps to the supplied baseline. */
export function logarithmicStat(raw: number, baseline: number): number {
  return baseline * Math.log2(Math.max(0, raw) + 1);
}

export function logarithmicChance(raw: number, baselinePercent: number): number {
  return Math.min(1, logarithmicStat(raw, baselinePercent) / 100);
}

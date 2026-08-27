/** Converts a non-negative raw attribute with diminishing logarithmic returns. Raw 1 maps to the supplied baseline. */
export function logarithmicStat(raw: number, baseline: number): number {
  return baseline * Math.log2(Math.max(0, raw) + 1);
}

export function logarithmicChance(raw: number, baselinePercent: number): number {
  return Math.min(1, logarithmicStat(raw, baselinePercent) / 100);
}

/** Converts accumulated raw evasion to a chance before any direct chance sources are added. */
export function rawEvasionChance(raw: number, scale: number, rawTarget: number, cap: number): number {
  const nonNegativeRaw = Math.max(0, raw);
  return Math.min(cap, cap * Math.log(1 + nonNegativeRaw / scale) / Math.log(1 + rawTarget / scale));
}

/** Direct sources are decimal probability bonuses and deliberately combine additively. */
export function totalEvasionChance(rawChance: number, directChances: Iterable<number>, cap: number): number {
  let total = rawChance;
  for (const chance of directChances) total += Math.max(0, chance);
  return Math.min(cap, Math.max(0, total));
}

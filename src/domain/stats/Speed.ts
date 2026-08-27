/** Converts the sum of all raw Speed sources into the capped movement multiplier. */
export function speedMultiplier(rawSpeed: number, scale: number, rawTarget: number, maxMultiplier: number): number {
  const nonNegativeRaw = Math.max(0, rawSpeed);
  return Math.min(maxMultiplier, 1 + (maxMultiplier - 1) * Math.log(1 + nonNegativeRaw / scale) / Math.log(1 + rawTarget / scale));
}

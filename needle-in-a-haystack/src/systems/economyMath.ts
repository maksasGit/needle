/** Pure runtime formulas, also used by the offline economic model. */
export const capacityAt = (base: number, step: number, level: number) => base + step * level;
export const movementAt = (base: number, step: number, level: number) => base * (1 + step * level);
export const durationAt = (base: number, multiplier: number, level: number, toolTime: number, wideLevel = 0, wideMultiplier = .9) => base * multiplier ** level * toolTime * wideMultiplier ** wideLevel;
export const amountAt = (base: number, step: number, level: number) => base + step * level;
export const saleHundredthsAt = (level: number) => 100 + level * 25;
export function payoutAt(hundredths: number, remainder: number) {
  const total = hundredths + remainder;
  return { earned: Math.floor(total / 100), remainder: total % 100 };
}

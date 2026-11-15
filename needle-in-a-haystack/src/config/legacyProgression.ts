// Frozen pre-rebalance prices for validating historical purchases.
export const toolSpecs = [
  { duration: 0.8, volumeStep: 1, volumePrice: 8, specialPrice: 15, special: 'rakeFeature' },
  { duration: 0.95, volumeStep: 2, volumePrice: 20, specialPrice: 40, special: 'forkFeature' },
  { duration: 1.2, volumeStep: 3, volumePrice: 45, specialPrice: 80, special: 'wideFeature' },
  { duration: 0.9, volumeStep: 4, volumePrice: 100, specialPrice: 160, special: 'vacuumFeature' },
] as const;
export const toolUpgradeLimits = { volume: 8, special: 5 } as const;
export type ToolUpgrade = keyof typeof toolUpgradeLimits;
export function toolUpgradePrice(tool: number, kind: ToolUpgrade, level: number) {
  const spec = toolSpecs[tool - 1];
  return Math.ceil((kind === 'volume' ? spec.volumePrice : spec.specialPrice) * 1.65 ** level);
}
export const pigBalance = { prices: [80, 220, 600], intervals: [4.5, 4, 3.5], portions: [1, 2, 3], speed: 0.8 } as const;

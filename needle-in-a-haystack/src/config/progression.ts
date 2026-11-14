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
export const barnItems = {
  rake: { tool: 1, x: -0.1, z: -5.85, radius: 0.35 },
  fork: { tool: 2, x: 0.85, z: -5.85, radius: 0.35 },
  widefork: { tool: 3, x: 1.8, z: -5.85, radius: 0.35 },
  vacuum: { tool: 4, x: 2.75, z: -5.85, radius: 0.35 },
  backpack: { tool: 0, x: 3.7, z: -5.85, radius: 0.35 },
  pig: { tool: 0, x: 5, z: -3.9, radius: 0.5 },
} as const;
export type BarnTarget = keyof typeof barnItems;
export function isBarnTarget(target: string): target is BarnTarget { return Object.hasOwn(barnItems, target); }
export const barnWalls = [
  { x: -0.78, z: -4.7, halfX: 0.12, halfZ: 1.5 },
  { x: 4.38, z: -4.7, halfX: 0.12, halfZ: 1.5 },
  { x: 1.8, z: -6.2, halfX: 2.7, halfZ: 0.12 },
] as const;

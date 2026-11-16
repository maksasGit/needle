export const toolSpecs = [
  { duration: 0.8, volumeStep: 1, volumePrice: 90, specialPrice: 180, special: 'rakeFeature', rareStep: .1, rangeBase: 0, rangeStep: 0, specialDuration: 1 },
  { duration: 0.95, volumeStep: 2, volumePrice: 300, specialPrice: 600, special: 'forkFeature', rareStep: 0, rangeBase: .25, rangeStep: .18, specialDuration: 1 },
  { duration: 1.2, volumeStep: 3, volumePrice: 1000, specialPrice: 2000, special: 'wideFeature', rareStep: 0, rangeBase: 0, rangeStep: 0, specialDuration: .9 },
  { duration: 0.9, volumeStep: 4, volumePrice: 3200, specialPrice: 6400, special: 'vacuumFeature', rareStep: 0, rangeBase: 1.8, rangeStep: .35, specialDuration: 1 },
] as const;
export const toolUpgradeLimits = { volume: 12, special: 8 } as const;
export type ToolUpgrade = keyof typeof toolUpgradeLimits;
export function previousToolUpgradePrice(tool: number, kind: ToolUpgrade, level: number) {
  const spec = toolSpecs[tool - 1];
  return Math.ceil((kind === 'volume' ? spec.volumePrice : spec.specialPrice) * 1.85 ** level);
}
export const pigBalance = { prices: [560, 1680, 5040], intervals: [4.5, 4, 3.5], portions: [1, 2, 3], speed: 0.8 } as const;
export const barnLayout = { x: 7, z: -9, yaw: -Math.PI / 6, localX: 1.8, localZ: -4.7 } as const;
export function barnWorld(x: number, z: number) {
  const dx = x - barnLayout.localX, dz = z - barnLayout.localZ;
  const c = Math.cos(barnLayout.yaw), s = Math.sin(barnLayout.yaw);
  return { x: barnLayout.x + c * dx + s * dz, z: barnLayout.z - s * dx + c * dz };
}
export const barnLocalItems = {
  rake: { tool: 1, x: -0.1, z: -5.85, radius: 0.35 },
  fork: { tool: 2, x: 0.85, z: -5.85, radius: 0.35 },
  widefork: { tool: 3, x: 1.8, z: -5.85, radius: 0.35 },
  vacuum: { tool: 4, x: 2.75, z: -5.85, radius: 0.35 },
  backpack: { tool: 0, x: 3.7, z: -5.85, radius: 0.35 },
  pig: { tool: 0, x: 5, z: -3.9, radius: 0.5 },
} as const;
const place = <T extends { x: number; z: number }>(item: T) => ({ ...item, ...barnWorld(item.x, item.z) });
export const barnItems = {
  rake: place(barnLocalItems.rake), fork: place(barnLocalItems.fork), widefork: place(barnLocalItems.widefork),
  vacuum: place(barnLocalItems.vacuum), backpack: place(barnLocalItems.backpack), pig: place(barnLocalItems.pig),
};
export type BarnTarget = keyof typeof barnItems;
export function isBarnTarget(target: string): target is BarnTarget { return Object.hasOwn(barnItems, target); }
export const barnLocalWalls = [
  { x: -0.78, z: -4.7, halfX: 0.12, halfZ: 1.5 },
  { x: 4.38, z: -4.7, halfX: 0.12, halfZ: 1.5 },
  { x: 1.8, z: -6.2, halfX: 2.7, halfZ: 0.12 },
] as const;
export const barnWalls = barnLocalWalls.map(wall => ({ ...place(wall), yaw: barnLayout.yaw }));

export type PigUpgrade = "portion" | "speed";
export const pigUpgrades = { maxLevel: 12, portionStep: 1, intervalMultiplier: .9 } as const;
export function previousPigUpgradePrice(kind: PigUpgrade, level: number) { return Math.ceil((kind === "portion" ? 450 : 650) * 1.8 ** level); }

export const previousPigPrices = [800, 2400, 7200] as const;
export function toolUpgradePrice(tool: number, kind: ToolUpgrade, level: number) { return Math.max(1, Math.floor(previousToolUpgradePrice(tool, kind, level) * 70 / 100)); }
export function pigUpgradePrice(kind: PigUpgrade, level: number) { return Math.max(1, Math.floor(previousPigUpgradePrice(kind, level) * 70 / 100)); }

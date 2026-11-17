export const config = {
  mapScale: 0.7,
  worldHalfSize: 9.1,
  layoutVersion: 2,
  playerSpawn: { x: -3.5, z: 0 },
  playerRadius: 0.28,
  movementSpeed: 2.6,
  locomotion: { jumpSpeed: 5.5, gravity: 14, stepHeight: 0.24, surfaceSlope: 3 },
  interactionGap: 0.25,
  collectionRangeMultiplier: 1.5,
  gridStep: 0.25,
  maxPixelRatio: 1.75,
  input: { joystickDeadZone: 0.12 },
  firstPerson: { fov: 72, eyeHeight: 1.55, startPitch: -0.12, lookSensitivity: 0.004 },
  totalHay: 20000,
  capacity: 15,
  collectionSeconds: 0.45,
  salePrice: 1,
  interactionTolerance: 0.08,
  actionFeedbackSeconds: 0.18,
  presentation: {
    pickupFeedback: 0.22, cartFloor: 0.735,
  },
  cartCargo: { segments: 12, rings: 4, radius: 0.72, minHeight: 0.055, maxHeight: 0.95, minFootprint: 0.3 },
  hayVisual: {
    profileVersion: 1,
    radius: 2.12, spacing: 0.15, rings: 17, layerHeight: 0.04, floor: 0.045, slope: 0.33,
    contactScale: 0.75,
    horizontalJitter: 0.04, verticalJitter: 0.009,
    stalkWidth: 0.0255, stalkLength: 0.25875,
    gravity: 5, rollSpeed: 8, stableLayers: 2, maxTransfers: 24, maxActive: 96,
    maxFlights: 24, flightSeconds: 0.35,
  },
  hay: { x: -3.5, z: -3.5, radius: 2.32 },
  needle: { x: -3.5, z: -3.5, radius: 0.25 },
  cart: { x: -5.6, z: 6.3, radius: 1.9, yaw: Math.PI / 6 },
} as const;

export const upgrades = {
  capacity: { name: 'Вместимость', basePrice: 30, growth: 1.8, lateGrowth: 1.4, legacyLevels: 5, maxLevel: 15, step: 40 },
  movement: { name: 'Скорость ходьбы', basePrice: 120, growth: 1.85, maxLevel: 8, step: 0.25 },
  collection: { name: 'Скорость сбора', basePrice: 150, growth: 1.9, maxLevel: 15, multiplier: 0.9 },
  sale: { name: 'Цена продажи', basePrice: 2500, growth: 1.8, maxLevel: 20, step: 0.25 },
  tools: { name: 'Инструмент', basePrice: 120, growth: 4, maxLevel: 4, amounts: [1, 3, 6, 10, 14], names: ['Руки', 'Грабли', 'Вилы', 'Широкие вилы', 'Пылесос'] },
} as const;
export type UpgradeId = keyof typeof upgrades;
export function previousUpgradePrice(id: UpgradeId, level: number): number {
  const item = upgrades[id];
  if (id === 'capacity' && level >= upgrades.capacity.legacyLevels) {
    const pivot = upgrades.capacity.legacyLevels - 1;
    return Math.ceil(item.basePrice * item.growth ** pivot * upgrades.capacity.lateGrowth ** (level - pivot));
  }
  return Math.ceil(item.basePrice * item.growth ** level);
}


export function upgradePrice(id: UpgradeId, level: number) {
  return Math.max(1, Math.floor(previousUpgradePrice(id, level) * (id === "sale" ? 28 : 70) / 100));
}
/** Existing production profile. Candidate v2 is not active. */
export const economyVersion = 1;

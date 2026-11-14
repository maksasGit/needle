export const config = {
  worldHalfSize: 6.5,
  playerRadius: 0.28,
  movementSpeed: 2.6,
  locomotion: { jumpSpeed: 5.5, gravity: 14, stepHeight: 0.24, surfaceSlope: 3 },
  interactionGap: 0.25,
  gridStep: 0.25,
  maxPixelRatio: 1.75,
  input: { joystickDeadZone: 0.12 },
  firstPerson: { fov: 72, eyeHeight: 1.55, startPitch: -0.12, lookSensitivity: 0.004 },
  totalHay: 20000,
  capacity: 5,
  collectionSeconds: 0.45,
  salePrice: 1,
  interactionTolerance: 0.08,
  actionFeedbackSeconds: 0.18,
  presentation: {
    pickupFeedback: 0.22, unloadSeconds: 0.6, unloadStagger: 0.012, unloadArc: 0.35,
    cartColumns: 5, cartRows: 36, cartColumnStep: 0.27, cartRowStep: 0.035,
    cartFloor: 0.735, cartLayerHeight: 0.022,
  },
  hayVisual: {
    profileVersion: 1,
    radius: 2.12, spacing: 0.15, rings: 17, layerHeight: 0.04, floor: 0.045, slope: 0.33,
    contactScale: 0.75,
    horizontalJitter: 0.04, verticalJitter: 0.009,
    stalkWidth: 0.0255, stalkLength: 0.25875,
    gravity: 5, rollSpeed: 8, stableLayers: 2, maxTransfers: 24, maxActive: 96,
    maxFlights: 24, flightSeconds: 0.35,
  },
  hay: { x: -1.6, z: -0.8, radius: 2.32 },
  needle: { x: -1.6, z: -0.8, radius: 0.25 },
  cart: { x: 2.7, z: 0.6, radius: 1.35 },
} as const;

export const upgrades = {
  capacity: { name: 'Вместимость', basePrice: 5, growth: 1.8, lateGrowth: 1.35, legacyLevels: 5, maxLevel: 15, step: 5 },
  movement: { name: 'Скорость ходьбы', basePrice: 10, growth: 1.9, maxLevel: 4, step: 0.25 },
  collection: { name: 'Скорость сбора', basePrice: 10, growth: 1.8, maxLevel: 10, multiplier: 0.8 },
  tools: { name: 'Инструмент', basePrice: 15, growth: 2, maxLevel: 3, amounts: [1, 3, 6, 10], names: ['Руки', 'Грабли', 'Вилы', 'Широкие вилы'] },
} as const;
export type UpgradeId = keyof typeof upgrades;
export function upgradePrice(id: UpgradeId, level: number): number {
  const item = upgrades[id];
  if (id === 'capacity' && level >= upgrades.capacity.legacyLevels) {
    const pivot = upgrades.capacity.legacyLevels - 1;
    return Math.ceil(item.basePrice * item.growth ** pivot * upgrades.capacity.lateGrowth ** (level - pivot));
  }
  return Math.ceil(item.basePrice * item.growth ** level);
}


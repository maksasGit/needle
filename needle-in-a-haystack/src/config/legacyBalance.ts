// Frozen pre-rebalance prices for validating historical purchases.
export const upgrades = {
  capacity: { name: 'Вместимость', basePrice: 5, growth: 1.8, lateGrowth: 1.35, legacyLevels: 5, maxLevel: 15, step: 5 },
  movement: { name: 'Скорость ходьбы', basePrice: 10, growth: 1.9, maxLevel: 4, step: 0.25 },
  collection: { name: 'Скорость сбора', basePrice: 10, growth: 1.8, maxLevel: 10, multiplier: 0.8 },
  sale: { name: 'Цена продажи', basePrice: 25, growth: 2, maxLevel: 5, step: 1 },
  tools: { name: 'Инструмент', basePrice: 15, growth: 2, maxLevel: 4, amounts: [1, 3, 6, 10, 14], names: ['Руки', 'Грабли', 'Вилы', 'Широкие вилы', 'Пылесос'] },
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


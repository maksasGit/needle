import { config, upgrades, upgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import { t, toolName } from '../ui/i18n';

/** Only explicit commands mutate the inventory; no automatic collection loop. */
export class EconomySystem {
  remaining: number = config.totalHay;
  inventory = 0;
  coins = 0;
  discoveryCoins = 0;
  readonly levels: Record<UpgradeId, number> = { capacity: 0, movement: 0, collection: 0, tools: 0 };
  get capacity() { return config.capacity + this.levels.capacity * upgrades.capacity.step; }
  get movementSpeed() { return config.movementSpeed * (1 + this.levels.movement * upgrades.movement.step); }
  get collectionSeconds() { return config.collectionSeconds * upgrades.collection.multiplier ** this.levels.collection; }
  get collectionAmount() { return upgrades.tools.amounts[this.levels.tools]; }
  get toolName() { return toolName(this.levels.tools); }
  price(id: UpgradeId): number | null {
    const item = upgrades[id];
    return this.levels[id] >= item.maxLevel ? null : upgradePrice(id, this.levels[id]);
  }
  buy(id: UpgradeId): boolean {
    const price = this.price(id);
    if (price === null || this.coins < price) return false;
    this.coins -= price;
    this.levels[id]++;
    return true;
  }
  effect(id: UpgradeId, next = false): string {
    const level = Math.min(this.levels[id] + Number(next), upgrades[id].maxLevel);
    switch (id) {
      case 'capacity': return `${config.capacity + level * upgrades.capacity.step} ${t('unit')}`;
      case 'movement': return `${(config.movementSpeed * (1 + level * upgrades.movement.step)).toFixed(2)} ${t('speedUnit')}`;
      case 'collection': return `${(config.collectionSeconds * upgrades.collection.multiplier ** level).toFixed(2)} ${t('seconds')}`;
      case 'tools': return `${toolName(level)} · ${upgrades.tools.amounts[level]} ${t('perTap')}`;
    }
  }

  collect(): number {
    const amount = Math.min(this.collectionAmount, this.capacity - this.inventory, this.remaining);
    this.inventory += amount;
    this.remaining -= amount;
    return amount;
  }

  unload(): number {
    const earned = this.inventory * config.salePrice;
    this.coins += earned;
    this.inventory = 0;
    return earned;
  }
  creditDiscovery(bonus: number) {
    if (!Number.isSafeInteger(bonus) || bonus < 0) throw new Error('Invalid discovery reward');
    this.discoveryCoins += bonus; this.coins += bonus;
  }
}

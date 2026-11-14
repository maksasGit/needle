import { config, upgrades, upgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import { t, toolName } from '../ui/i18n';
import { pigBalance, toolSpecs, toolUpgradePrice, toolUpgradeLimits } from '../config/progression';
import type { ToolUpgrade, BarnTarget } from '../config/progression';
import { barnItems } from '../config/progression';

/** Only explicit commands mutate the inventory; no automatic collection loop. */
export class EconomySystem {
  remaining: number = config.totalHay;
  inventory = 0;
  coins = 0;
  discoveryCoins = 0;
  saleRevenue = 0;
  pigCount = 0;
  pigEaten = 0;
  activeTool = 0;
  readonly toolVolumes = [0, 0, 0, 0];
  readonly toolSpecials = [0, 0, 0, 0];
  readonly levels: Record<UpgradeId, number> = { capacity: 0, movement: 0, collection: 0, tools: 0, sale: 0 };
  get capacity() { return config.capacity + this.levels.capacity * upgrades.capacity.step; }
  get movementSpeed() { return config.movementSpeed * (1 + this.levels.movement * upgrades.movement.step); }
  get collectionSeconds() { return config.collectionSeconds * upgrades.collection.multiplier ** this.levels.collection * (toolSpecs[this.activeTool - 1]?.duration ?? 1) * (this.activeTool === 3 ? 0.9 ** this.toolSpecials[2] : 1); }
  get collectionAmount() { return upgrades.tools.amounts[this.activeTool] + (this.activeTool ? this.toolVolumes[this.activeTool - 1] * toolSpecs[this.activeTool - 1].volumeStep : 0); }
  get toolName() { return toolName(this.activeTool); }
  get salePrice() { return config.salePrice + this.levels.sale * upgrades.sale.step; }
  get collectionReach() { return this.activeTool === 4 ? 1.8 + this.toolSpecials[3] * 0.35 : this.activeTool === 2 ? 0.25 + this.toolSpecials[1] * 0.18 : 0; }
  get discoveryMultiplier() { return this.activeTool === 1 ? 1 + this.toolSpecials[0] * 0.1 : 1; }
  price(id: UpgradeId): number | null {
    const item = upgrades[id];
    return this.levels[id] >= item.maxLevel ? null : upgradePrice(id, this.levels[id]);
  }
  buy(id: UpgradeId): boolean {
    const price = this.price(id);
    if (price === null || this.coins < price) return false;
    this.coins -= price;
    this.levels[id]++;
    if (id === 'tools') this.activeTool = this.levels.tools;
    return true;
  }
  effect(id: UpgradeId, next = false): string {
    const level = Math.min(this.levels[id] + Number(next), upgrades[id].maxLevel);
    switch (id) {
      case 'capacity': return `${config.capacity + level * upgrades.capacity.step} ${t('unit')}`;
      case 'movement': return `${(config.movementSpeed * (1 + level * upgrades.movement.step)).toFixed(2)} ${t('speedUnit')}`;
      case 'collection': return `${(config.collectionSeconds * upgrades.collection.multiplier ** level).toFixed(2)} ${t('seconds')}`;
      case 'tools': return `${toolName(level)} · ${upgrades.tools.amounts[level]} ${t('perTap')}`;
      case 'sale': return `${config.salePrice + level * upgrades.sale.step} ${t('money')} / ${t('unit')}`;
    }
  }

  collect(): number {
    const amount = Math.min(this.collectionAmount, this.capacity - this.inventory, this.remaining);
    this.inventory += amount;
    this.remaining -= amount;
    return amount;
  }

  unload(): number {
    const earned = this.inventory * this.salePrice;
    this.coins += earned;
    this.saleRevenue += earned;
    this.inventory = 0;
    return earned;
  }
  creditDiscovery(bonus: number) {
    if (!Number.isSafeInteger(bonus) || bonus < 0) throw new Error('Invalid discovery reward');
    this.discoveryCoins += bonus; this.coins += bonus;
  }
  equip(tool: number) {
    if (!Number.isInteger(tool) || tool < 0 || tool > this.levels.tools) return false;
    this.activeTool = tool; return true;
  }
  upgradeTool(tool: number, kind: ToolUpgrade) {
    if (!Number.isInteger(tool) || tool < 1 || tool > this.levels.tools) return false;
    const levels = kind === 'volume' ? this.toolVolumes : this.toolSpecials;
    if (levels[tool - 1] >= toolUpgradeLimits[kind]) return false;
    const price = toolUpgradePrice(tool, kind, levels[tool - 1]);
    if (this.coins < price) return false;
    this.coins -= price; levels[tool - 1]++; return true;
  }
  barnOffer(target: BarnTarget) {
    const tool = barnItems[target].tool;
    if (tool) return { name: toolName(tool), price: tool <= this.levels.tools ? null : upgradePrice('tools', tool - 1), owned: tool <= this.levels.tools, locked: tool > this.levels.tools + 1 };
    if (target === 'backpack') return { name: t('backpack'), price: this.price('capacity'), owned: false, locked: false };
    return { name: t('pig'), price: pigBalance.prices[this.pigCount] ?? null, owned: false, locked: false };
  }
  buyAtBarn(target: BarnTarget) {
    const offer = this.barnOffer(target), tool = barnItems[target].tool;
    if (offer.owned && tool) return this.equip(tool);
    if (offer.locked || offer.price === null || this.coins < offer.price) return false;
    if (tool) return this.buy('tools');
    if (target === 'backpack') return this.buy('capacity');
    this.coins -= offer.price; this.pigCount++; return true;
  }
  feedPig(requested: number) {
    const amount = Math.min(Math.max(0, Math.floor(requested)), this.remaining);
    this.remaining -= amount; this.pigEaten += amount;
    const earned = amount * this.salePrice;
    this.saleRevenue += earned; this.coins += earned;
    return { amount, earned };
  }
}

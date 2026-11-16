import { config, upgrades, upgradePrice } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import { t, toolName } from '../ui/i18n';
import { pigBalance, pigUpgrades, pigUpgradePrice, toolSpecs, toolUpgradePrice, toolUpgradeLimits } from '../config/progression';
import type { PigUpgrade } from '../config/progression';
import type { LegacyProgress, PriceBaseline } from './SaveSystem';
import type { ToolUpgrade, BarnTarget } from '../config/progression';
import { barnItems } from '../config/progression';

/** Collection is command-driven; only an actively held vacuum repeats commands. */
export class EconomySystem {
  remaining: number = config.totalHay;
  inventory = 0;
  coins = 0;
  discoveryCoins = 0;
  saleRevenue = 0;
  pigCount = 0;
  pigEaten = 0;
  pigPortionLevel = 0;
  pigSpeedLevel = 0;
  saleRemainder = 0;
  eventRevenue = 0;
  eventRemainder = 0;
  legacyProgress?: LegacyProgress;
  priceBaseline?: PriceBaseline;
  activeTool = 0;
  readonly toolVolumes = [0, 0, 0, 0];
  readonly toolSpecials = [0, 0, 0, 0];
  readonly levels: Record<UpgradeId, number> = { capacity: 0, movement: 0, collection: 0, tools: 0, sale: 0 };
  get capacity() { return config.capacity + this.levels.capacity * upgrades.capacity.step; }
  get movementSpeed() { return config.movementSpeed * (1 + this.levels.movement * upgrades.movement.step); }
  get collectionSeconds() { return config.collectionSeconds * upgrades.collection.multiplier ** this.levels.collection * (toolSpecs[this.activeTool - 1]?.duration ?? 1) * (this.activeTool === 3 ? 0.9 ** this.toolSpecials[2] : 1); }
  get collectionAmount() { return upgrades.tools.amounts[this.activeTool] + (this.activeTool ? this.toolVolumes[this.activeTool - 1] * toolSpecs[this.activeTool - 1].volumeStep : 0); }
  get toolName() { return toolName(this.activeTool); }
  get salePrice() { return config.salePrice * (1 + this.levels.sale * upgrades.sale.step); }
  pigPortion(index: number) { return pigBalance.portions[index] + this.pigPortionLevel * pigUpgrades.portionStep; }
  get pigIntervalMultiplier() { return pigUpgrades.intervalMultiplier ** this.pigSpeedLevel; }
  upgradePig(kind: PigUpgrade) {
    const level = kind === 'portion' ? this.pigPortionLevel : this.pigSpeedLevel;
    if (!this.pigCount || level >= pigUpgrades.maxLevel) return false;
    const price = pigUpgradePrice(kind, level);
    if (this.coins < price) return false;
    this.coins -= price;
    if (kind === 'portion') this.pigPortionLevel++; else this.pigSpeedLevel++;
    return true;
  }
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
      case 'sale': return `×${(1 + level * upgrades.sale.step).toFixed(2)} (+${level * 25}%)`;
    }
  }

  collect(): number {
    const amount = Math.min(this.collectionAmount, this.capacity - this.inventory, this.remaining);
    this.inventory += amount;
    this.remaining -= amount;
    return amount;
  }

  unload(multiplier: 1 | 2 = 1): number {
    const earned = this.salePayout(this.inventory);
    let bonus = 0;
    if (multiplier === 2 && this.inventory > 0) {
      const hundredths = this.inventory * (100 + this.levels.sale * 25) + this.eventRemainder;
      bonus = Math.floor(hundredths / 100); this.eventRemainder = hundredths % 100;
      this.eventRevenue += bonus;
    }
    this.coins += earned + bonus;
    this.saleRevenue += earned;
    this.inventory = 0;
    return earned + bonus;
  }
  private salePayout(amount: number) {
    // Integer hundredths retain fractional rewards across deliveries and pig bites.
    const hundredths = amount * (100 + this.levels.sale * 25) + this.saleRemainder;
    this.saleRemainder = hundredths % 100;
    return Math.floor(hundredths / 100);
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
    const earned = this.salePayout(amount);
    this.saleRevenue += earned; this.coins += earned;
    return { amount, earned };
  }
}

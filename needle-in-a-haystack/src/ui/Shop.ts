import { upgrades } from '../config/balance';
import { toolSpecs, toolUpgradePrice, toolUpgradeLimits } from '../config/progression';
import type { ToolUpgrade } from '../config/progression';
import type { EconomySystem } from '../systems/EconomySystem';
import { t, toolName } from './i18n';

export type ShopAction = { kind: 'character'; id: 'movement' | 'collection' | 'sale' } | { kind: 'volume' | 'special' | 'equip'; tool: number };
export class Shop {
  private controller = new AbortController();
  private dialog = document.querySelector<HTMLDialogElement>('#shop-dialog')!;
  private tab = 'character';
  constructor(private economy: EconomySystem, private onBuy: (action: ShopAction) => void, private onReject: () => void = () => {}) {
    document.querySelector<HTMLButtonElement>('#shop')!.onclick = () => { this.render(true); if (!this.dialog.open) this.dialog.showModal(); };
    this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.dialog.close();
    this.dialog.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (button.dataset.unavailable === 'true') { this.onReject(); return; }
      if (button.dataset.tab) { this.tab = button.dataset.tab; this.render(); return; }
      const kind = button.dataset.action;
      if (kind === 'character') {
        const id = button.dataset.upgrade;
        if (id === 'movement' || id === 'collection' || id === 'sale') this.onBuy({ kind, id });
      } else if (kind === 'volume' || kind === 'special' || kind === 'equip') this.onBuy({ kind, tool: Number(button.dataset.tool) });
    }, { signal: this.controller.signal });
  }
  private buyButton(price: number | null, attrs: string) {
    const disabled = price === null || this.economy.coins < price;
    return `<button ${attrs} aria-disabled="${disabled}" data-unavailable="${disabled}">${price === null ? t('max') : `${t('buy')} &middot; ${price} ${t('money')}`}</button>`;
  }
  private characterPage() {
    const avatar = '<svg class="book-avatar" viewBox="0 0 64 80" aria-hidden="true"><rect x="20" y="4" width="24" height="24" rx="7" fill="#ffcf8b"/><rect x="14" y="31" width="36" height="30" rx="7" fill="#23b8ff"/><rect x="5" y="34" width="8" height="25" rx="4" fill="#ffcf8b"/><rect x="51" y="34" width="8" height="25" rx="4" fill="#ffcf8b"/><path d="M19 65h11v13H19zM34 65h11v13H34z" fill="#526985"/></svg>';
    return `<div class="character-summary">${avatar}<p>${t('characterHint')}</p></div>` + (['movement','collection','sale'] as const).map(id => {
      const level = this.economy.levels[id], price = this.economy.price(id);
      return `<article class="upgrade"><h3>${t(id)} <small>${level} / ${upgrades[id].maxLevel}</small></h3><p>${this.economy.effect(id)}${price === null ? '' : ` &rarr; ${this.economy.effect(id, true)}`}</p>${this.buyButton(price, `data-action="character" data-upgrade="${id}"`)}</article>`;
    }).join('');
  }
  private featureValue(tool: number, level: number) {
    if (tool === 1) return `+${level * 10}% ${t('rareBonus')}`;
    if (tool === 2) return `${(.25 + level * .18).toFixed(2)} ${t('rangeExtra')}`;
    if (tool === 3) return `${Math.round((1 - .9 ** level) * 100)}% ${t('faster')}`;
    return `${(1.8 + level * .35).toFixed(2)} ${t('rangeExtra')}`;
  }
  private toolPage(tool: number) {
    if (tool < 1 || tool > this.economy.levels.tools) return this.characterPage();
    const spec = toolSpecs[tool - 1], active = this.economy.activeTool === tool;
    const head = `<h3>${toolName(tool)}</h3><p>${t((`trait${tool}`) as 'trait1')}</p><button data-action="equip" data-tool="${tool}" ${active ? 'disabled' : ''}>${t(active ? 'equipped' : 'equip')}</button>`;
    return head + (['volume','special'] as ToolUpgrade[]).map(kind => {
      const level = (kind === 'volume' ? this.economy.toolVolumes : this.economy.toolSpecials)[tool - 1];
      const price = level >= toolUpgradeLimits[kind] ? null : toolUpgradePrice(tool, kind, level);
      const value = (n: number) => kind === 'volume' ? `${upgrades.tools.amounts[tool] + n * spec.volumeStep} ${t('perTap')}` : this.featureValue(tool, n);
      return `<article class="upgrade"><h3>${t(kind === 'volume' ? 'volumeUpgrade' : spec.special)} <small>${level} / ${toolUpgradeLimits[kind]}</small></h3><p>${value(level)}${price === null ? '' : ` &rarr; ${value(level + 1)}`}</p>${this.buyButton(price, `data-action="${kind}" data-tool="${tool}"`)}</article>`;
    }).join('');
  }
  render(force = false) {
    if (!force && !this.dialog.open) return;
    this.dialog.querySelector('[data-wallet]')!.textContent = `${this.economy.coins} ${t('money')}`;
    const tabs = [{ id: 'character', name: t('character') }];
    for (let tool = 1; tool <= this.economy.levels.tools; tool++) tabs.push({ id: `tool${tool}`, name: toolName(tool) });
    if (this.economy.levels.capacity > 0) tabs.push({ id: 'backpack', name: t('backpack') });
    if (this.economy.pigCount > 0) tabs.push({ id: 'pigs', name: t('pigs') });
    if (!tabs.some(tab => tab.id === this.tab)) this.tab = 'character';
    const nav = this.dialog.querySelector('[data-book-tabs]')!;
    nav.innerHTML = tabs.map(tab => `<button role="tab" aria-selected="${tab.id === this.tab}" data-tab="${tab.id}">${tab.name}</button>`).join('');
    const list = this.dialog.querySelector('[data-upgrades]')!;
    if (this.tab === 'character') list.innerHTML = this.characterPage();
    else if (this.tab === 'backpack') list.innerHTML = `<h3>${t('backpack')}</h3><p>${t('backpackInfo', { n: this.economy.capacity })}</p><p>${t('atBarn')}</p>`;
    else if (this.tab === 'pigs') list.innerHTML = `<h3>${t('pigs')}</h3><p>${t('pigsInfo', { n: this.economy.pigCount, eaten: this.economy.pigEaten })}</p><p>${t('atBarn')}</p>`;
    else list.innerHTML = this.toolPage(Number(this.tab.slice(4)));
  }
  invalidate() { this.render(); }
  dispose() { this.controller.abort(); document.querySelector<HTMLButtonElement>('#shop')!.onclick = null; this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = null; }
}

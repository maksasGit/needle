import { upgrades } from '../config/balance';
import { pigBalance, pigUpgrades, pigUpgradePrice, toolSpecs, toolUpgradePrice, toolUpgradeLimits } from '../config/progression';
import type { ToolUpgrade } from '../config/progression';
import type { EconomySystem } from '../systems/EconomySystem';
import { t, toolName } from './i18n';
import { icon } from './icons';
import type { IconName } from './icons';
import { presentation } from '../config/presentation';

export type ShopAction = { kind: 'character'; id: 'movement' | 'collection' | 'sale' } | { kind: 'volume' | 'special' | 'equip'; tool: number } | { kind: 'pig'; upgrade: 'portion' | 'speed' };
export class Shop {
  private controller = new AbortController();
  private dialog = document.querySelector<HTMLDialogElement>('#shop-dialog')!;
  private tab = 'character';
  private busy = false;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private economy: EconomySystem, private onBuy: (action: ShopAction) => boolean, private onReject: (text: string) => void = () => {}) {
    document.querySelector<HTMLButtonElement>('#shop')!.onclick = () => { const feedback = this.dialog.querySelector<HTMLElement>('[data-book-feedback]')!; feedback.textContent = ''; delete feedback.dataset.feedbackState; this.render(true); if (!this.dialog.open) this.dialog.showModal(); };
    this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.dialog.close();
    this.dialog.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      if (this.busy && button.dataset.action) return;
      if (button.dataset.unavailable === 'true') {
        const price = Number(button.dataset.price);
        this.onReject(button.dataset.reason === 'max' ? t('denyMax') : Number.isFinite(price) && price > this.economy.coins ? t('denyFunds', { n: price - this.economy.coins }) : t('denyUnavailable'));
        return;
      }
      if (button.dataset.tab) { this.tab = button.dataset.tab; this.render(); return; }
      const kind = button.dataset.action;
      if (kind === 'character') {
        const id = button.dataset.upgrade;
        if (id === 'movement' || id === 'collection' || id === 'sale') this.purchase({ kind, id });
      } else if (kind === 'pig') {
        const upgrade = button.dataset.upgrade;
        if (upgrade === 'portion' || upgrade === 'speed') this.purchase({ kind, upgrade });
      } else if (kind === 'volume' || kind === 'special' || kind === 'equip') this.purchase({ kind, tool: Number(button.dataset.tool) });
    }, { signal: this.controller.signal });
  }
  private purchase(action: ShopAction) {
    if (this.busy) return;
    this.busy = true;
    const success = this.onBuy(action);
    const feedback = this.dialog.querySelector<HTMLElement>('[data-book-feedback]')!;
    if (success) { feedback.textContent = t(action.kind === 'equip' ? 'equipped' : 'upgradeDone'); feedback.dataset.feedbackState = 'success'; }
    else if (!feedback.textContent) { feedback.textContent = t('denyUnavailable'); feedback.dataset.feedbackState = 'error'; }
    this.timer = setTimeout(() => { this.busy = false; }, presentation.purchaseGuardMs);
  }
  private buyButton(price: number | null, attrs: string) {
    const disabled = price === null || this.economy.coins < price;
    return `<button ${attrs} aria-disabled="${disabled}" data-unavailable="${disabled}" data-reason="${price === null ? 'max' : 'funds'}" data-price="${price ?? ''}">${price === null ? t('max') : `${t('buy')} &middot; ${price} ${t('money')}`}</button>`;
  }
  private characterPage() {
    const avatar = '<svg class="book-avatar" viewBox="0 0 64 80" aria-hidden="true"><rect x="20" y="4" width="24" height="24" rx="7" fill="#ffcf8b"/><rect x="14" y="31" width="36" height="30" rx="7" fill="#23b8ff"/><rect x="5" y="34" width="8" height="25" rx="4" fill="#ffcf8b"/><rect x="51" y="34" width="8" height="25" rx="4" fill="#ffcf8b"/><path d="M19 65h11v13H19zM34 65h11v13H34z" fill="#526985"/></svg>';
    return `<div class="character-summary">${avatar}<p>${t('characterHint')}</p></div>` + (['movement','collection','sale'] as const).map(id => {
      const level = this.economy.levels[id], price = this.economy.price(id);
      return `<article class="upgrade"><h3>${t(id)} <small>${level} / ${upgrades[id].maxLevel}</small></h3><p>${this.economy.effect(id)}${price === null ? '' : ` &rarr; ${this.economy.effect(id, true)}`}</p>${this.buyButton(price, `data-action="character" data-upgrade="${id}"`)}</article>`;
    }).join('');
  }
  private featureValue(tool: number, level: number) {
    const spec = toolSpecs[tool - 1];
    if (tool === 1) return `+${Math.round(level * spec.rareStep * 100)}% ${t('rareBonus')}`;
    if (tool === 3) return `${Math.round((1 - spec.specialDuration ** level) * 100)}% ${t('faster')}`;
    return `${(spec.rangeBase + level * spec.rangeStep).toFixed(2)} ${t('rangeExtra')}`;
  }
  private toolPage(tool: number) {
    if (tool < 1 || tool > this.economy.levels.tools) return this.characterPage();
    const spec = toolSpecs[tool - 1], active = this.economy.activeTool === tool;
    const head = `<h3>${toolName(tool)}</h3><p>${t((`trait${tool}`) as 'trait1')}</p><button data-action="equip" data-tool="${tool}" ${active ? 'disabled' : ''}>${t(active ? 'equipped' : 'equip')}</button>`;
    return head + (['volume','special'] as ToolUpgrade[]).map(kind => {
      const level = (kind === 'volume' ? this.economy.toolVolumes : this.economy.toolSpecials)[tool - 1];
      const price = level >= toolUpgradeLimits[kind] ? null : toolUpgradePrice(tool, kind, level);
      const value = (n: number) => kind === 'volume' ? `${upgrades.tools.amounts[tool] + n * spec.volumeStep} ${t(tool === 4 ? 'perCycle' : 'perTap')}` : this.featureValue(tool, n);
      return `<article class="upgrade"><h3>${t(kind === 'volume' ? 'volumeUpgrade' : spec.special)} <small>${level} / ${toolUpgradeLimits[kind]}</small></h3><p>${value(level)}${price === null ? '' : ` &rarr; ${value(level + 1)}`}</p>${this.buyButton(price, `data-action="${kind}" data-tool="${tool}"`)}</article>`;
    }).join('');
  }
  render(force = false) {
    if (!force && !this.dialog.open) return;
    const focused = this.dialog.contains(document.activeElement) ? document.activeElement as HTMLButtonElement : undefined;
    const focusSelector = focused?.dataset.tab ? `[data-tab="${focused.dataset.tab}"]`
      : focused?.dataset.action ? `[data-action="${focused.dataset.action}"]${focused.dataset.upgrade ? `[data-upgrade="${focused.dataset.upgrade}"]` : focused.dataset.tool ? `[data-tool="${focused.dataset.tool}"]` : ''}` : undefined;
    this.dialog.querySelector('[data-wallet]')!.textContent = `${this.economy.coins} ${t('money')}`;
    const tabs = [{ id: 'character', name: t('character') }];
    for (let tool = 1; tool <= this.economy.levels.tools; tool++) tabs.push({ id: `tool${tool}`, name: toolName(tool) });
    if (this.economy.levels.capacity > 0) tabs.push({ id: 'backpack', name: t('backpack') });
    if (this.economy.pigCount > 0) tabs.push({ id: 'pigs', name: t('pigs') });
    if (!tabs.some(tab => tab.id === this.tab)) this.tab = 'character';
    const nav = this.dialog.querySelector('[data-book-tabs]')!;
    nav.innerHTML = tabs.map(tab => `<button role="tab" aria-selected="${tab.id === this.tab}" data-tab="${tab.id}">${icon((tab.id === "character" ? "book" : tab.id === "pigs" ? "pig" : tab.id === "backpack" ? "backpack" : ["rake","fork","widefork","vacuum"][Number(tab.id.slice(4)) - 1]) as IconName)}${tab.name}</button>`).join('');
    const list = this.dialog.querySelector('[data-upgrades]')!;
    if (this.tab === 'character') list.innerHTML = this.characterPage();
    else if (this.tab === 'backpack') list.innerHTML = `<h3>${t('backpack')}</h3><p>${t('backpackInfo', { n: this.economy.capacity })}</p><p>${t('atBarn')}</p>`;
    else if (this.tab === 'pigs') list.innerHTML = this.pigPage();
    else list.innerHTML = this.toolPage(Number(this.tab.slice(4)));
    if (focusSelector) {
      const next = this.dialog.querySelector<HTMLButtonElement>(focusSelector);
      (next && !next.disabled ? next : this.dialog.querySelector<HTMLButtonElement>('[aria-selected="true"]'))?.focus({ preventScroll: true });
    }
  }
  private pigPage() {
    return `<h3>${t('pigs')}</h3><p>${t('pigsInfo', { n: this.economy.pigCount, eaten: this.economy.pigEaten })}</p><p>${t('pigUpgradeHint')}</p>` + (['portion', 'speed'] as const).map(kind => {
      const level = kind === 'portion' ? this.economy.pigPortionLevel : this.economy.pigSpeedLevel;
      const price = level >= pigUpgrades.maxLevel ? null : pigUpgradePrice(kind, level);
      const value = (n: number) => kind === 'portion'
        ? `${pigBalance.portions.slice(0, this.economy.pigCount).map(base => base + n * pigUpgrades.portionStep).join(' / ')} ${t('perBite')}`
        : `${pigBalance.intervals.slice(0, this.economy.pigCount).map(base => (base * pigUpgrades.intervalMultiplier ** n).toFixed(1)).join(' / ')} ${t('seconds')}`;
      return `<article class="upgrade"><h3>${t(kind === 'portion' ? 'pigPortion' : 'pigSpeed')} <small>${level} / ${pigUpgrades.maxLevel}</small></h3><p>${value(level)}${price === null ? '' : ` &rarr; ${value(level + 1)}`}</p>${this.buyButton(price, `data-action="pig" data-upgrade="${kind}"`)}</article>`;
    }).join('');
  }
  invalidate() { this.render(); }
  dispose() { clearTimeout(this.timer); this.controller.abort(); document.querySelector<HTMLButtonElement>('#shop')!.onclick = null; this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = null; }
}

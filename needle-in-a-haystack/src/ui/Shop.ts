import { upgrades } from '../config/balance';
import type { UpgradeId } from '../config/balance';
import type { EconomySystem } from '../systems/EconomySystem';
import { t } from './i18n';

export class Shop {
  private controller = new AbortController();
  private dialog = document.querySelector<HTMLDialogElement>('#shop-dialog')!;
  constructor(private economy: EconomySystem, private onBuy: (id: UpgradeId) => void) {
    document.querySelector<HTMLButtonElement>('#shop')!.onclick = () => { this.render(); this.dialog.showModal(); };
    this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => this.dialog.close();
    this.dialog.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');
      if (button && !button.disabled) this.onBuy(button.dataset.upgrade as UpgradeId);
    }, { signal: this.controller.signal });
  }
  render() {
    this.dialog.querySelector('[data-wallet]')!.textContent = `${this.economy.coins} ${t('money')}`;
    const list = this.dialog.querySelector('[data-upgrades]')!;
    if (!list.children.length) {
      list.innerHTML = (Object.keys(upgrades) as UpgradeId[]).map(id => `<article class="upgrade"><h3>${t(id)} <small data-level="${id}"></small></h3><p data-effect="${id}"></p><button data-upgrade="${id}"></button></article>`).join('');
    }
    for (const id of Object.keys(upgrades) as UpgradeId[]) {
      const price = this.economy.price(id);
      list.querySelector(`[data-level="${id}"]`)!.textContent = `${this.economy.levels[id]} / ${upgrades[id].maxLevel}`;
      list.querySelector(`[data-effect="${id}"]`)!.textContent = this.economy.effect(id) + (price === null ? '' : ` → ${this.economy.effect(id, true)}`);
      const button = list.querySelector<HTMLButtonElement>(`[data-upgrade="${id}"]`)!;
      button.disabled = price === null || this.economy.coins < price;
      button.textContent = price === null ? t('max') : `${t('buy')} · ${price} ${t('money')}${this.economy.coins < price ? ` (${t('missing', { n: price - this.economy.coins })})` : ''}`;
    }
  }
  dispose() { this.controller.abort(); document.querySelector<HTMLButtonElement>('#shop')!.onclick = null; this.dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick = null; }
}

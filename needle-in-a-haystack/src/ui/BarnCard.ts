import type { BarnTarget } from '../config/progression';
import { barnItems } from '../config/progression';
import { toolSpecs } from '../config/progression';
import { upgrades } from '../config/balance';
import { presentation } from '../config/presentation';
import type { EconomySystem } from '../systems/EconomySystem';
import { t } from './i18n';
import parchmentUrl from '../assets/ui/shop-parchment.jpg?url';

export class BarnCard {
  private dialog = document.querySelector<HTMLDialogElement>('#barn-dialog')!;
  private target?: BarnTarget;
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private busy = false;
  constructor(private economy: EconomySystem, private purchase: (target: BarnTarget) => boolean, private reject: (text: string) => void) {
    this.dialog.querySelector('[data-close]')!.addEventListener('click', () => this.dialog.close(), { signal: this.controller.signal });
    this.dialog.querySelector('[data-barn-confirm]')!.addEventListener('click', () => {
      if (this.busy || !this.target) return;
      const offer = this.economy.barnOffer(this.target);
      if (offer.locked || (!offer.owned && (offer.price === null || offer.price > this.economy.coins))) {
        const text = offer.locked ? t('denyPrevious') : offer.price === null ? t('denyMax') : t('denyFunds', { n: offer.price - this.economy.coins });
        this.reject(text); return;
      }
      this.busy = true;
      const success = this.purchase(this.target);
      this.render();
      if (success) this.dialog.dataset.success = 'true';
      const feedback = this.dialog.querySelector<HTMLElement>('[data-barn-feedback]')!;
      if (success) { feedback.textContent = offer.owned ? t('equipped') : t('boughtItem', { name: offer.name }); feedback.dataset.feedbackState = 'success'; }
      else if (!feedback.textContent) { feedback.textContent = t('denyUnavailable'); feedback.dataset.feedbackState = 'error'; }
      this.timer = setTimeout(() => { this.busy = false; delete this.dialog.dataset.success; this.render(); }, presentation.purchaseGuardMs);
    }, { signal: this.controller.signal });
  }
  show(target: BarnTarget) { this.dialog.style.setProperty('--shop-parchment', `url("${parchmentUrl}")`); this.target = target; const feedback = this.dialog.querySelector<HTMLElement>('[data-barn-feedback]')!; feedback.textContent = ''; delete feedback.dataset.feedbackState; this.render(true); if (!this.dialog.open) this.dialog.showModal(); }
  render(force = false) {
    if (!this.target || (!force && !this.dialog.open)) return;
    const offer = this.economy.barnOffer(this.target), tool = barnItems[this.target].tool;
    this.dialog.querySelector('[data-barn-name]')!.textContent = offer.name;
    const detail = this.dialog.querySelector('[data-barn-detail]')!;
    detail.textContent = tool ? t((`trait${tool}`) as 'trait1') : this.target === 'backpack' ? this.economy.effect('capacity') + (offer.price === null ? '' : ` → ${this.economy.effect('capacity', true)}`) : t('pigCardHint');
    if (tool) {
      const amount = upgrades.tools.amounts[tool] + this.economy.toolVolumes[tool - 1] * toolSpecs[tool - 1].volumeStep;
      detail.textContent += ` · ${this.economy.collectionAmount} → ${amount} ${t(tool === 4 ? 'perCycle' : 'perTap')}`;
    }
    this.dialog.querySelector('[data-barn-price]')!.textContent = offer.owned ? t('owned') : offer.price === null ? t('max') : `${offer.price} ${t('money')}`;
    this.dialog.querySelector('.barn-price-tag > svg')!.toggleAttribute('hidden', offer.owned || offer.price === null);
    this.dialog.querySelector('[data-barn-wallet]')!.textContent = `${this.economy.coins} ${t('money')}`;
    const button = this.dialog.querySelector<HTMLButtonElement>('[data-barn-confirm]')!;
    const equipped = !!tool && offer.owned && this.economy.activeTool === tool;
    const unavailable = offer.locked || (!offer.owned && (offer.price === null || offer.price > this.economy.coins));
    button.disabled = this.busy || equipped;
    button.setAttribute('aria-disabled', String(unavailable || button.disabled));
    button.textContent = equipped ? t('equipped') : offer.owned ? t('equip') : offer.locked ? t('previousTool') : offer.price === null ? t('max') : offer.price > this.economy.coins ? t('missing', { n: offer.price - this.economy.coins }) : t(tool ? 'buyEquip' : 'buy');
  }
  dispose() { clearTimeout(this.timer); this.controller.abort(); if (this.dialog.open) this.dialog.close(); }
}

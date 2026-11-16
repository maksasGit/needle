import type { PerspectiveCamera } from 'three';
import { Vector3 as Point } from 'three';
import { config } from '../config/balance';
import { barnItems, pigBalance, pigUpgrades, pigUpgradePrice, toolUpgradeLimits, toolUpgradePrice } from '../config/progression';
import type { EconomySystem } from '../systems/EconomySystem';
import { t } from './i18n';
import { icon } from './icons';

const KEY = 'needle.tutorial.v1';
export class Onboarding {
  private panel = document.querySelector<HTMLElement>('#tutorial')!;
  private pointer = document.querySelector<HTMLElement>('#tutorial-pointer')!;
  private step = 0;
  private done = false;
  private learned = false;
  private age = Infinity;
  private last = '';
  private point = new Point();
  private highlighted?: Element;
  constructor() { try { this.done = localStorage.getItem(KEY) === 'done'; } catch { /* Memory-only guidance. */ } this.learned = this.done; this.hide(); }
  get completed() { return this.learned; }
  replay() { this.step = 0; this.done = false; this.last = ''; this.age = Infinity; }
  action(kind: 'collect' | 'sell' | 'upgrade' | 'needle') {
    if (this.done) return;
    if (kind === 'collect' && this.step <= 1) this.step = 2;
    else if (kind === 'sell' && (this.step === 2 || this.step === 3)) this.step = 4;
    else if (kind === 'upgrade' && this.step === 4) this.step = 5;
    else if ((kind === 'collect' && this.step === 5) || kind === 'needle') {
      this.done = true;
      this.learned = true;
      try { localStorage.setItem(KEY, 'done'); } catch { /* Optional persistence. */ }
    }
    this.last = ''; this.age = Infinity;
  }
  private highlight(element?: Element | null) {
    if (element === this.highlighted) return;
    this.highlighted?.classList.remove('tutorial-highlight');
    this.highlighted = element ?? undefined; this.highlighted?.classList.add('tutorial-highlight');
  }
  hide() { if (!this.panel.hidden) this.panel.hidden = true; if (!this.pointer.hidden) this.pointer.hidden = true; this.highlight(); }
  update(dt: number, paused: boolean, economy: EconomySystem, inHayRange: boolean, inCartRange: boolean, camera: PerspectiveCamera, reduced: boolean) {
    if (paused || this.done) { this.hide(); return; }
    this.age += dt; if (this.age < .1) return; this.age = 0;
    if (this.step === 0 && inHayRange) this.step = 1;
    if (this.step <= 1 && economy.inventory >= economy.capacity) this.step = 2;
    if (this.step === 2 && inCartRange) this.step = 3;
    let target: { x: number; z: number } = config.hay, key: Parameters<typeof t>[0] = 'guideHay', glyph: Parameters<typeof icon>[0] = 'hay';
    let element: Element | null = null;
    if (this.step === 1) { key = 'guideCollect'; element = document.querySelector('#interact'); }
    if (this.step === 2 || this.step === 3) { target = config.cart; key = this.step === 2 ? 'guideCart' : 'guideSell'; glyph = 'coins'; if (this.step === 3) element = document.querySelector('#interact'); }
    if (this.step === 4) {
      glyph = 'backpack';
      const capacity = economy.price('capacity');
      const bookPrices = (['movement','collection','sale'] as const).map(id => economy.price(id)).filter((price): price is number => price !== null);
      for (let tool = 1; tool <= economy.levels.tools; tool++) for (const kind of ['volume','special'] as const) {
        const level = (kind === 'volume' ? economy.toolVolumes : economy.toolSpecials)[tool - 1];
        if (level < toolUpgradeLimits[kind]) bookPrices.push(toolUpgradePrice(tool, kind, level));
      }
      if (economy.pigCount) {
        if (economy.pigPortionLevel < pigUpgrades.maxLevel) bookPrices.push(pigUpgradePrice('portion', economy.pigPortionLevel));
        if (economy.pigSpeedLevel < pigUpgrades.maxLevel) bookPrices.push(pigUpgradePrice('speed', economy.pigSpeedLevel));
      }
      const nextTool = economy.price('tools'), nextPig = pigBalance.prices[economy.pigCount];
      if (capacity !== null && economy.coins >= capacity) { target = barnItems.backpack; key = 'guideUpgrade'; }
      else if (bookPrices.some(price => economy.coins >= price)) { key = 'guideBook'; element = document.querySelector('#shop'); }
      else if (nextTool !== null && economy.coins >= nextTool) { target = Object.values(barnItems).find(item => item.tool === economy.levels.tools + 1)!; key = 'guideBarn'; }
      else if (nextPig !== undefined && economy.coins >= nextPig) { target = barnItems.pig; key = 'guideBarn'; }
      else if (!bookPrices.length && capacity === null && nextTool === null && nextPig === undefined) this.step = 5;
      else { target = economy.inventory >= economy.capacity ? config.cart : config.hay; key = 'guideEarn'; }
    }
    if (this.step === 5) { key = 'guideTry'; glyph = 'needle'; target = config.hay; }
    if (!economy.remaining) { key = 'guideComplete'; glyph = 'needle'; target = config.needle; element = null; }
    const stamp = `${key}/${economy.activeTool}/${t('close')}`;
    if (stamp !== this.last) {
      this.panel.innerHTML = `${icon(glyph)}<span>${t(key)}</span><small>${this.step + 1} / 6</small>`;
      this.panel.setAttribute('aria-label', t(key)); this.last = stamp;
    }
    this.panel.hidden = false; this.highlight(element);
    this.pointer.hidden = !!element;
    if (!element) this.position(target, camera, reduced);
  }
  private position(target: { x: number; z: number }, camera: PerspectiveCamera, reduced: boolean) {
    this.point.set(target.x, 1.8, target.z).project(camera);
    const behind = this.point.z > 1;
    let x = (this.point.x * .5 + .5) * innerWidth, y = (-this.point.y * .5 + .5) * innerHeight;
    if (behind) { x = innerWidth - x; y = innerHeight - y; }
    x = Math.max(54, Math.min(innerWidth - 54, x)); y = Math.max(Math.min(180, innerHeight * .4), Math.min(innerHeight - 150, y));
    this.pointer.style.left = `${x}px`; this.pointer.style.top = `${y}px`;
    this.pointer.classList.toggle('is-static', reduced);
  }
  dispose() { this.hide(); }
}

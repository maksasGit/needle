import { t } from './i18n';
import { iconPaths } from './icons';
import { presentation } from '../config/presentation';

type Kind = 'hay' | 'coins' | 'full' | 'notice';
const paths = iconPaths;

/** Four reusable DOM elements; rapid actions never create an unbounded queue. */
export class FloatingFeedback {
  private items: { node: HTMLDivElement; icon: SVGSVGElement; path: SVGPathElement; label: HTMLSpanElement; animation?: Animation }[] = [];
  private totals = { hay: 0, coins: 0 };
  private windows = { hay: -Infinity, coins: -Infinity };
  private lastFull = -Infinity;
  reducedMotion = false;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(host: HTMLElement) {
    for (let i = 0; i < 4; i++) {
      const node = document.createElement('div'); node.className = 'floating-feedback';
      node.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path/></svg><span></span>';
      host.append(node); this.items.push({ node, icon: node.querySelector('svg')!, path: node.querySelector('path')!, label: node.querySelector('span')! });
    }
  }
  notice(text: string) { this.show('notice', 0, text); }
  show(kind: Kind, amount = 0, text = '') {
    const now = performance.now();
    if (kind === 'full') {
      if (now - this.lastFull < 450) return;
      this.lastFull = now;
    } else if (kind !== 'notice' && amount <= 0) return;
    // Separate sectors around the crosshair; rapid rewards merge, never stack.
    const slot = kind === 'hay' ? 0 : kind === 'coins' ? 1 : kind === 'notice' ? 2 : 3, item = this.items[slot];
    if (kind === 'hay' || kind === 'coins') {
      if (now - this.windows[kind] > presentation.messageMs) { this.windows[kind] = now; this.totals[kind] = 0; }
      this.totals[kind] += amount; amount = this.totals[kind];
    }
    item.animation?.cancel(); item.node.dataset.kind = kind;
    item.icon.style.display = kind === 'full' || kind === 'notice' ? 'none' : '';
    if (kind === 'hay' || kind === 'coins') item.path.setAttribute('d', paths[kind]);
    item.label.textContent = kind === 'full' ? t('inventoryFull') : kind === 'notice' ? text : `+${amount}`;
    const reduced = this.reducedMotion || this.motion.matches;
    item.animation = item.node.animate([
      { opacity: 0, transform: `translateY(${reduced ? 0 : 5}px)` },
      { opacity: 1, transform: 'translateY(0)', offset: 0.14 },
      { opacity: 1, transform: 'translateY(0)', offset: 0.7 },
      { opacity: 0, transform: `translateY(${reduced ? 0 : -5}px)` },
    ], { duration: kind === 'full' ? presentation.fullMessageMs : presentation.messageMs, easing: presentation.easing, fill: 'forwards' });
  }
  stop() { for (const item of this.items) item.animation?.cancel(); this.windows.hay = this.windows.coins = -Infinity; }
  dispose() {
    for (const item of this.items) { item.animation?.cancel(); item.node.remove(); }
    this.items.length = 0;
  }
}

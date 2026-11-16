import { t } from './i18n';
import { iconPaths } from './icons';
import { presentation } from '../config/presentation';

type Kind = 'hay' | 'coins' | 'full' | 'notice';
const paths = iconPaths;

/** Four reusable DOM elements; rapid actions never create an unbounded queue. */
export class FloatingFeedback {
  private items: { node: HTMLDivElement; icon: SVGSVGElement; path: SVGPathElement; label: HTMLSpanElement; animation?: Animation }[] = [];
  private cursor = 0;
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
    const slot = this.cursor++ % this.items.length, item = this.items[slot];
    item.animation?.cancel(); item.node.dataset.kind = kind;
    item.icon.style.display = kind === 'full' || kind === 'notice' ? 'none' : '';
    if (kind === 'hay' || kind === 'coins') item.path.setAttribute('d', paths[kind]);
    item.label.textContent = kind === 'full' ? t('inventoryFull') : kind === 'notice' ? text : `+${amount}`;
    const x = kind === 'full' || kind === 'notice' ? 0 : (slot - 1.5) * 24;
    const y = kind === 'hay' ? 24 : kind === 'coins' ? -20 : 0;
    const reduced = this.reducedMotion || this.motion.matches;
    item.animation = item.node.animate([
      { opacity: 0, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : 8)}px) scale(${reduced ? 1 : .9})` },
      { opacity: 1, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(1)`, offset: 0.14 },
      { opacity: 1, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : -22)}px) scale(1)`, offset: 0.6 },
      { opacity: 0, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : -48)}px) scale(1)` },
    ], { duration: kind === 'full' ? presentation.fullMessageMs : presentation.messageMs, easing: presentation.easing, fill: 'forwards' });
  }
  stop() { for (const item of this.items) item.animation?.cancel(); }
  dispose() {
    for (const item of this.items) { item.animation?.cancel(); item.node.remove(); }
    this.items.length = 0;
  }
}

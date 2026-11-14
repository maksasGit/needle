import { t } from './i18n';

type Kind = 'hay' | 'coins' | 'full';
const paths = {
  hay: 'M3 21 12 3l9 18H3 M7 20l5-13 5 13 M9 17h6',
  coins: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M14 8h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3 M12 6v12',
};

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
  show(kind: Kind, amount = 0) {
    const now = performance.now();
    if (kind === 'full') {
      if (now - this.lastFull < 450) return;
      this.lastFull = now;
    } else if (amount <= 0) return;
    const slot = this.cursor++ % this.items.length, item = this.items[slot];
    item.animation?.cancel(); item.node.dataset.kind = kind;
    item.icon.style.display = kind === 'full' ? 'none' : '';
    if (kind !== 'full') item.path.setAttribute('d', paths[kind]);
    item.label.textContent = kind === 'full' ? t('inventoryFull') : `+${amount}`;
    const x = kind === 'full' ? 0 : (slot - 1.5) * 24;
    const y = kind === 'hay' ? 24 : kind === 'coins' ? -20 : 0;
    const reduced = this.reducedMotion || this.motion.matches;
    item.animation = item.node.animate([
      { opacity: 0, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : 8)}px) scale(${reduced ? 1 : .9})` },
      { opacity: 1, transform: `translate(calc(-50% + ${x}px), ${y}px) scale(1)`, offset: 0.14 },
      { opacity: 1, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : -22)}px) scale(1)`, offset: 0.6 },
      { opacity: 0, transform: `translate(calc(-50% + ${x}px), ${y + (reduced ? 0 : -48)}px) scale(1)` },
    ], { duration: kind === 'full' ? 850 : 1050, easing: 'ease-out', fill: 'forwards' });
  }
  dispose() {
    for (const item of this.items) { item.animation?.cancel(); item.node.remove(); }
    this.items.length = 0;
  }
}

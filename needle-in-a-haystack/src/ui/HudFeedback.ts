import { presentation } from '../config/presentation';
import { icon } from './icons';

/** One interruptible counter animation and a fixed decorative pool. */
export class HudFeedback {
  private coins = document.querySelector<HTMLElement>('#coins')!;
  private inventory = document.querySelector<HTMLElement>('#inventory')!;
  private remaining = document.querySelector<HTMLElement>('#remaining')!;
  private progress = document.querySelector<HTMLProgressElement>('#hay-progress')!;
  private current = [0, 0, 0];
  private from = [0, 0, 0];
  private target = [0, 0, 0];
  private capacity = 0;
  private initialized = false;
  private start = 0;
  private frame = 0;
  private pulses = new Map<Element, Animation>();
  private particles: { node: HTMLElement; animation?: Animation }[] = [];
  private host = document.createElement('div');
  reducedMotion = false;
  private motion = matchMedia('(prefers-reduced-motion: reduce)');
  constructor() {
    this.host.className = 'coin-flights'; this.host.setAttribute('aria-hidden', 'true');
    document.querySelector('#app')!.append(this.host);
    for (let i = 0; i < presentation.maxCoins; i++) {
      const node = document.createElement('span'); node.className = 'flight-coin'; node.innerHTML = icon('coins');
      this.host.append(node); this.particles.push({ node });
    }
  }
  private get reduced() { return this.reducedMotion || this.motion.matches; }
  set(coins: number, inventory: number, capacity: number, remaining: number, total: number) {
    this.capacity = capacity; this.from = [...this.current]; this.target = [coins, inventory, remaining];
    this.coins.dataset.actual = String(coins); this.inventory.dataset.actual = String(inventory);
    this.inventory.closest('div')?.classList.toggle('is-full', inventory >= capacity);
    // Progress semantics and the full state always use actual gameplay data.
    this.progress.max = total; this.progress.value = remaining;
    if (!this.initialized || this.reduced || document.querySelector('dialog[open]')) this.flush();
    else if (!this.current.every((value, i) => value === this.target[i])) {
      this.start = performance.now(); if (!this.frame) this.frame = requestAnimationFrame(this.tick);
    }
    this.initialized = true;
  }
  private write() {
    this.coins.textContent = String(Math.round(this.current[0]));
    this.inventory.textContent = `${Math.round(this.current[1])} / ${this.capacity}`;
    this.remaining.textContent = String(Math.round(this.current[2]));
  }
  private tick = (now: number) => {
    this.frame = 0;
    if (document.hidden || this.reduced) { this.flush(); return; }
    const p = Math.min(1, (now - this.start) / presentation.counterMs), ease = 1 - (1 - p) ** presentation.counterPower;
    for (let i = 0; i < 3; i++) this.current[i] = this.from[i] + (this.target[i] - this.from[i]) * ease;
    this.write(); if (p < 1) this.frame = requestAnimationFrame(this.tick);
  };
  flush() { cancelAnimationFrame(this.frame); this.frame = 0; this.current = [...this.target]; this.write(); }
  pulse(kind: 'hay' | 'coins' | 'full' | 'purchase') {
    const node = kind === 'hay' || kind === 'full' ? this.inventory.parentElement : kind === 'purchase' ? document.querySelector('#shop') : this.coins.parentElement;
    if (!node || this.reduced) return;
    this.pulses.get(node)?.cancel();
    this.pulses.set(node, node.animate([{ transform: 'scale(1)' }, { transform: `scale(${presentation.pulseScale})`, offset: .35 }, { transform: 'scale(1)' }], { duration: presentation.pulseMs, easing: presentation.easing }));
  }
  sale(x: number, y: number) {
    this.pulse('coins'); if (this.reduced) return;
    const rect = this.coins.getBoundingClientRect(), tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2;
    for (const [i, particle] of this.particles.entries()) {
      particle.animation?.cancel();
      const sx = x + (i % 3 - 1) * 16, sy = y + (i % 2) * 12;
      particle.animation = particle.node.animate([
        { transform: `translate(${sx}px,${sy}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${sx}px,${sy - 35}px) scale(1)`, opacity: 1, offset: .2 },
        { transform: `translate(${tx}px,${ty}px) scale(.45)`, opacity: 0 },
      ], { duration: presentation.coinMs, delay: i * presentation.coinStaggerMs });
      if (i === this.particles.length - 1) particle.animation.onfinish = () => this.pulse('coins');
    }
  }
  stop() { this.flush(); for (const item of this.particles) item.animation?.cancel(); for (const animation of this.pulses.values()) animation.cancel(); }
  dispose() { this.stop(); this.host.remove(); this.pulses.clear(); }
}

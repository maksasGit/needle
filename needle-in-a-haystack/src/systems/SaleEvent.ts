import { saleEvent } from '../config/presentation';
export type SaleEventState = { wait: number; remaining: number };
/** Active-play time only. No offline rewards or reward reroll. */
export class SaleEvent {
  private state: SaleEventState;
  constructor(saved?: SaleEventState, private durationMultiplier = 1) { this.state = saved ? { ...saved } : { wait: this.next(), remaining: 0 }; }
  private next() { return saleEvent.minWait + Math.random() * (saleEvent.maxWait - saleEvent.minWait); }
  get active() { return this.state.remaining > 0; }
  get remainingSeconds() { return Math.ceil(this.state.remaining); }
  get remainingTime() { return this.state.remaining; }
  update(dt: number, enabled: boolean) {
    if (!enabled && !this.active) return false;
    const before = this.active;
    if (this.active) {
      this.state.remaining = Math.max(0, this.state.remaining - dt);
      if (!this.active) this.state.wait = this.next();
    } else {
      this.state.wait = Math.max(0, this.state.wait - dt);
      if (!this.state.wait) this.state.remaining = saleEvent.duration * this.durationMultiplier;
    }
    return before !== this.active;
  }
  snapshot(): SaleEventState { return { ...this.state }; }
}
